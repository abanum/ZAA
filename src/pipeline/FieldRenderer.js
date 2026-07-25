// 1 フィールドぶんの信号処理チェーンを担当する。
//   映像なし: 雑音生成 → 検波(砂嵐) → デコード
//   映像あり: 雑音生成 → エンコード → ライス検波 → デコード
// 表示・タイミングは扱わない。

import { NTSC, TEXTURE_SIZE, BURST_PHASE_RAD, fieldBasePhase } from '../config/NtscConstants.js';
import { ShaderProgram } from '../gl/ShaderProgram.js';
import { RenderTarget } from '../gl/RenderTarget.js';
import { QUAD_VERTEX_SOURCE } from '../shaders/QuadVertex.js';
import { NOISE_FRAGMENT_SOURCE } from '../shaders/NoiseFragment.js';
import { ENCODER_FRAGMENT_SOURCE } from '../shaders/EncoderFragment.js';
import { RICE_DETECTOR_FRAGMENT_SOURCE } from '../shaders/RiceDetectorFragment.js';
import { DECODER_FRAGMENT_SOURCE } from '../shaders/DecoderFragment.js';

const CHROMA_DEMOD_LPF_HZ = 600000.0;
const MHZ = 1.0e6;

export class FieldRenderer {
  constructor(gl, quad) {
    this.gl = gl;
    this.quad = quad;
    this.size = [TEXTURE_SIZE.FIELD_WIDTH, TEXTURE_SIZE.FIELD_HEIGHT];

    this.noiseProgram = new ShaderProgram(gl, QUAD_VERTEX_SOURCE, NOISE_FRAGMENT_SOURCE);
    this.encoderProgram = new ShaderProgram(gl, QUAD_VERTEX_SOURCE, ENCODER_FRAGMENT_SOURCE);
    this.detectorProgram = new ShaderProgram(gl, QUAD_VERTEX_SOURCE, RICE_DETECTOR_FRAGMENT_SOURCE);
    this.decoderProgram = new ShaderProgram(gl, QUAD_VERTEX_SOURCE, DECODER_FRAGMENT_SOURCE);

    const w = TEXTURE_SIZE.FIELD_WIDTH;
    const h = TEXTURE_SIZE.FIELD_HEIGHT;
    this.noiseTarget = new RenderTarget(gl, w, h, { linear: false });
    this.compositeTarget = new RenderTarget(gl, w, h, { linear: false });
    this.detectorTarget = new RenderTarget(gl, w, h, { linear: false });

    this.chromaPhase = 0.0;
    this.fieldIndex4 = 0;   // 0..3 の 4 フィールドシーケンス
  }

  // フィールド境界で進める位相状態
  advancePhase(chromaDrift, fieldPeriodSec, hasVideo) {
    // 映像入力時は局部発振がバーストにロックするため、蓄積した位相を 0 へ戻す。
    this.chromaPhase = hasVideo
      ? 0.0
      : (this.chromaPhase + chromaDrift * fieldPeriodSec) % (Math.PI * 2);
    this.fieldIndex4 = (this.fieldIndex4 + 1) & 3;
  }

  drawNoise(seed) {
    this.noiseTarget.bind();
    this.noiseProgram.use().setUniforms({ uSize: this.size });
    this.noiseProgram.setUnsigned('uFieldSeed', seed);
    this.quad.draw();
  }

  drawEncode(params, videoTexture, hasVideo) {
    if (!hasVideo) return;
    this.compositeTarget.bind();
    this.encoderProgram.use().setUniforms({
      uSize: this.size,
      uLumaCutoff: (params.lumaBandwidth * MHZ) / NTSC.SAMPLE_RATE_HZ,
      uCutoffI: (params.chromaBandI * MHZ) / NTSC.SAMPLE_RATE_HZ,
      uCutoffQ: (params.chromaBandQ * MHZ) / NTSC.SAMPLE_RATE_HZ,
      uChromaGain: params.encChromaGain,
      uBurstPhase: BURST_PHASE_RAD,
      uFieldBasePhase: fieldBasePhase(this.fieldIndex4),
      uAspectMode: params.aspectMode,
      uInputAspect: videoTexture.aspect,
    });
    this.encoderProgram.setTexture('uVideo', videoTexture.texture, 0);
    this.quad.draw();
  }

  drawDetect(params, seed, hasVideo) {
    this.detectorTarget.bind();
    this.detectorProgram.use().setUniforms({
      uSize: this.size,
      uIfCutoff: (params.ifBandwidth * MHZ * 0.5) / NTSC.SAMPLE_RATE_HZ,
      uFieldStrength: params.fieldStrength,
      uNoiseFloor: params.noiseFloor,
      uJitter: params.agcJitter,
      uHasVideo: hasVideo ? 1.0 : 0.0,
      uSnowLevel: params.agcLevel,
    });
    this.detectorProgram.setUnsigned('uFieldSeed', seed);
    this.detectorProgram.setTexture('uNoise', this.noiseTarget.texture, 0);
    this.detectorProgram.setTexture('uComposite', this.compositeTarget.texture, 1);
    this.quad.draw();
  }

  drawDecode(params, targetBinder) {
    const killerOn = params.colorKiller > 0.5;
    targetBinder();
    this.decoderProgram.use().setUniforms({
      uSize: this.size,
      uLumaCutoff: (params.lumaBandwidth * MHZ) / NTSC.SAMPLE_RATE_HZ,
      uChromaCutoff: CHROMA_DEMOD_LPF_HZ / NTSC.SAMPLE_RATE_HZ,
      uChromaGain: killerOn ? 0.0 : params.chromaGain,
      uChromaPhase: this.chromaPhase,
      uContrast: params.contrast,
      uBrightness: params.brightness,
      uYcMode: params.ycSeparation,
      uFieldBasePhase: fieldBasePhase(this.fieldIndex4),
      uBurstPhase: BURST_PHASE_RAD,
    });
    this.decoderProgram.setTexture('uDetector', this.detectorTarget.texture, 0);
    this.quad.draw();
  }

  clear() {
    const gl = this.gl;
    for (const t of [this.noiseTarget, this.compositeTarget, this.detectorTarget]) {
      t.bind();
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
  }

  dispose() {
    [this.noiseProgram, this.encoderProgram, this.detectorProgram, this.decoderProgram]
      .forEach((p) => p.dispose());
    this.noiseTarget.dispose();
    this.compositeTarget.dispose();
    this.detectorTarget.dispose();
  }
}
