// フィールド処理（FieldRenderer）と CRT 表示を束ねるパイプライン。
// タイミング制御は FieldScheduler / AppController 側が持ち、
// ここは「渡されたパラメータで 1 フィールド／1 フレームを描く」処理だけを担当する。

import { NTSC, TEXTURE_SIZE } from '../config/NtscConstants.js';
import { ShaderProgram } from '../gl/ShaderProgram.js';
import { RenderTarget, bindScreen } from '../gl/RenderTarget.js';
import { ArrayRenderTarget } from '../gl/ArrayRenderTarget.js';
import { QuadRenderer } from '../gl/QuadRenderer.js';
import { FieldRenderer } from './FieldRenderer.js';
import { QUAD_VERTEX_SOURCE } from '../shaders/QuadVertex.js';
import { DISPLAY_FRAGMENT_SOURCE } from '../shaders/DisplayFragment.js';
import { PRESENT_FRAGMENT_SOURCE } from '../shaders/PresentFragment.js';

export class NtscPipeline {
  constructor(gl, canvas) {
    this.gl = gl;
    this.canvas = canvas;
    this.quad = new QuadRenderer(gl);
    this.field = new FieldRenderer(gl, this.quad);

    this.displayProgram = new ShaderProgram(gl, QUAD_VERTEX_SOURCE, DISPLAY_FRAGMENT_SOURCE);
    this.presentProgram = new ShaderProgram(gl, QUAD_VERTEX_SOURCE, PRESENT_FRAGMENT_SOURCE);

    const w = TEXTURE_SIZE.FIELD_WIDTH;
    const h = TEXTURE_SIZE.FIELD_HEIGHT;
    this.fieldTarget = new ArrayRenderTarget(gl, w, h, 2);
    this.displayTargets = [
      new RenderTarget(gl, canvas.width, canvas.height, { linear: true }),
      new RenderTarget(gl, canvas.width, canvas.height, { linear: true }),
    ];

    this.fieldParity = 0;
    this.displayIndex = 0;
    this.videoTexture = null;   // AppController が設定する
  }

  setVideoTexture(videoTexture) {
    this.videoTexture = videoTexture;
  }

  resize(width, height) {
    this.displayTargets[0].resize(width, height);
    this.displayTargets[1].resize(width, height);
  }

  // 1 フィールドぶんの受信〜デコードを実行する
  renderField(params, seed, fieldPeriodSec, hasVideo) {
    // 映像入力時はエンコーダがバースト位相を送っているため局部発振はロックする。
    // 砂嵐時のみバースト欠如でフリーランし、色相がゆっくり回る。
    const drift = hasVideo ? 0.0 : params.chromaDrift;
    this.field.advancePhase(drift, fieldPeriodSec, hasVideo);
    this.field.drawNoise(seed);
    this.field.drawEncode(params, this.videoTexture, hasVideo);
    this.field.drawDetect(params, seed, hasVideo);

    const parity = this.fieldParity;
    this.field.drawDecode(params, () => this.fieldTarget.bindLayer(parity));

    // ノンインターレース時は常に同じレイヤーを使い、全走査線を 59.94Hz で更新する
    this.fieldParity = params.interlace > 0.5 ? this.fieldParity ^ 1 : 0;
  }

  // 表示 1 フレーム（残光合成 + 画面転送）
  renderDisplay(params, powerUniforms) {
    const gl = this.gl;
    const current = this.displayTargets[this.displayIndex];
    const previous = this.displayTargets[this.displayIndex ^ 1];

    current.bind();
    this.displayProgram.use().setUniforms({
      uFieldSize: [TEXTURE_SIZE.FIELD_WIDTH, TEXTURE_SIZE.FIELD_HEIGHT],
      uActiveLines: NTSC.ACTIVE_LINES_PER_FRAME,
      uInterlaceOn: params.interlace,
      uPersistence: params.persistence,
      uSpotV: params.spotV,
      uSpotH: params.spotH,
      uScanline: params.scanline,
      uCurvature: params.curvature,
      uVignette: params.vignette,
      uOverscan: params.overscan,
      uPixelsPerLine: current.height / NTSC.ACTIVE_LINES_PER_FRAME,
      uWarmup: powerUniforms.uWarmup,
      uCollapseV: powerUniforms.uCollapseV,
      uCollapseH: powerUniforms.uCollapseH,
      uFlash: powerUniforms.uFlash,
    });
    this.displayProgram.setTexture('uFields', this.fieldTarget.texture, 0, gl.TEXTURE_2D_ARRAY);
    this.displayProgram.setTexture('uPrev', previous.texture, 1);
    this.quad.draw();

    bindScreen(gl, this.canvas.width, this.canvas.height);
    this.presentProgram.use().setUniforms({
      uTexel: [1.0 / current.width, 1.0 / current.height],
      uBloom: params.bloom,
      uGamma: 0.95,
    });
    this.presentProgram.setTexture('uSource', current.texture, 0);
    this.quad.draw();

    this.displayIndex ^= 1;
  }

  clear() {
    const gl = this.gl;
    this.field.clear();
    this.fieldTarget.clear();
    for (const t of this.displayTargets) {
      t.bind();
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    bindScreen(gl, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  dispose() {
    this.quad.dispose();
    this.field.dispose();
    this.displayProgram.dispose();
    this.presentProgram.dispose();
    this.fieldTarget.dispose();
    this.displayTargets.forEach((t) => t.dispose());
  }
}
