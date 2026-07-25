// WebAudio のノード生成・接続・音量制御のみを担当する。
// スペクトル整形の実体は NoiseSourceBuilder 側にある。

import {
  createGaussianNoiseBuffer,
  createDeemphasisShaper,
  createAudioBandLimiter,
  createIntercarrierTone,
} from './NoiseSourceBuilder.js';

const RAMP_SECONDS = 0.12;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.beatGain = null;
    this.nodes = [];
    this.running = false;
    this.volume = 0.0;
    this.beat = 0.0;
    this.videoMode = false;
    this.videoBeat = 0.0;
  }

  get isRunning() {
    return this.running;
  }

  async start() {
    if (this.running) return;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) throw new Error('WebAudio が利用できません。');
    if (!this.ctx) this.ctx = new Ctor();
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = createGaussianNoiseBuffer(ctx);
    source.loop = true;

    const shaper = createDeemphasisShaper(ctx);
    const limiter = createAudioBandLimiter(ctx);
    const master = ctx.createGain();
    master.gain.value = 0.0;

    source.connect(shaper).connect(limiter).connect(master).connect(ctx.destination);

    const osc = createIntercarrierTone(ctx);
    const beatGain = ctx.createGain();
    beatGain.gain.value = 0.0;
    osc.connect(beatGain).connect(master);

    source.start();
    osc.start();

    this.master = master;
    this.beatGain = beatGain;
    this.nodes = [source, osc, shaper, limiter, master, beatGain];
    this.running = true;
    this.applyVolume(this.volume);
    this.applyBeat(this.beat);
  }

  stop() {
    if (!this.running) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0.0, now, 0.04);
    const nodes = this.nodes;
    setTimeout(() => nodes.forEach((n) => { try { n.disconnect(); } catch (e) { /* noop */ } }), 300);
    this.nodes = [];
    this.master = null;
    this.beatGain = null;
    this.running = false;
  }

  applyVolume(value) {
    this.volume = value;
    if (!this.running) return;
    const now = this.ctx.currentTime;
    this.master.gain.linearRampToValueAtTime(value * 0.6 * this.noiseScale(), now + RAMP_SECONDS);
  }

  applyBeat(value) {
    this.beat = value;
    if (!this.running) return;
    const now = this.ctx.currentTime;
    this.beatGain.gain.linearRampToValueAtTime((value + this.videoBeat) * 0.08, now + RAMP_SECONDS);
  }

  // 映像入力の有無で音の性格を切り替える。
  //   映像なし: フルの砂嵐ノイズ
  //   映像あり: ノイズを大きく下げ、弱いインターキャリア音（サー感）を足す
  setVideoMode(hasVideo) {
    this.videoMode = hasVideo;
    this.videoBeat = hasVideo ? 0.5 : 0.0;   // 弱いインターキャリア音
    this.applyVolume(this.volume);
    this.applyBeat(this.beat);
  }

  noiseScale() {
    return this.videoMode ? 0.12 : 1.0;   // 映像時はノイズを 12% へ
  }
}
