// アプリケーションの制御構造。
// 各処理（描画・音声・UI）は下位モジュールに委譲し、ここは呼び出し順と状態遷移のみを持つ。

import { createGLContext, resizeCanvasToDisplay, queryRendererName } from '../gl/GLContext.js';
import { NtscPipeline } from '../pipeline/NtscPipeline.js';
import { FieldScheduler } from '../pipeline/FieldScheduler.js';
import { PowerEnvelope } from '../pipeline/PowerEnvelope.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { ParameterStore } from '../ui/ParameterStore.js';
import { buildControlPanel } from '../ui/ControlPanel.js';
import { CaptureCoordinator } from '../capture/CaptureCoordinator.js';

const MIN_WIDTH = 480;
const MAX_WIDTH = 2560;
const MAX_DPR = 2.0;

export class AppController {
  constructor() {
    this.store = new ParameterStore();
    this.scheduler = new FieldScheduler();
    this.audio = new AudioEngine();
    this.pipeline = null;
    this.gl = null;
    this.elements = null;
    this.powered = false;
    this.frameHandle = 0;
    this.resolution = { width: 0, height: 0 };
    this.meter = { frames: 0, lastTime: 0, fps: 0, cost: 0 };
    this.capture = null;
    this.envelope = new PowerEnvelope();
    this.envelope.onShutdownComplete = () => this.handleShutdownComplete();
    this.lastFrameTime = 0;
  }

  initialize(elements) {
    this.elements = elements;
    const canvas = elements.canvas;
    this.gl = createGLContext(canvas);
    this.applyResolution(canvas);
    this.pipeline = new NtscPipeline(this.gl, canvas);
    this.pipeline.clear();

    this.capture = new CaptureCoordinator(this.gl);
    this.pipeline.setVideoTexture(this.capture.videoTexture);
    this.capture.onStatus = (state, detail) => this.handleCaptureStatus(state, detail);

    buildControlPanel(elements.panel, this.store);
    if (elements.renderer) elements.renderer.textContent = queryRendererName(this.gl);
    this.bindParameterEffects();
    this.bindControls();
  }

  // 表示サイズ x devicePixelRatio x 描画解像度 から内部解像度を決める
  applyResolution(canvas) {
    const rect = canvas.getBoundingClientRect();
    const cssWidth = rect.width > 0 ? rect.width : canvas.clientWidth || 960;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const scale = this.store.get('renderScale');
    let width = Math.round(cssWidth * dpr * scale);
    width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width));
    const height = Math.round((width * 3) / 4);
    if (this.resolution.width === width && this.resolution.height === height) return;
    this.resolution = { width, height };
    resizeCanvasToDisplay(canvas, this.gl, width, height);
    if (this.pipeline) this.pipeline.resize(width, height);
  }

  bindParameterEffects() {
    this.store.subscribe((key, value) => {
      if (key === 'volume') this.audio.applyVolume(value);
      if (key === 'intercarrier') this.audio.applyBeat(value);
      if (key === 'renderScale') this.applyResolution(this.elements.canvas);
    });
    this.audio.applyVolume(this.store.get('volume'));
    this.audio.applyBeat(this.store.get('intercarrier'));
  }

  bindControls() {
    const { power, reset, fullscreen, stage, canvas, capture } = this.elements;
    if (power) power.addEventListener('click', () => this.togglePower());
    if (capture) {
      capture.disabled = !this.capture.isSupported;
      capture.addEventListener('click', () => this.toggleCapture());
    }
    if (reset) reset.addEventListener('click', () => this.store.resetAll());
    if (fullscreen && stage) {
      fullscreen.addEventListener('click', () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else stage.requestFullscreen?.();
      });
    }
    let pending = 0;
    const onResize = () => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => this.applyResolution(canvas));
    };
    window.addEventListener('resize', onResize);
    document.addEventListener('fullscreenchange', onResize);
  }

  async togglePower() {
    if (this.powered) this.powerOff();
    else await this.powerOn();
  }

  async powerOn() {
    if (this.envelope.state === 'warming' || this.envelope.state === 'on') return;
    this.powered = true;
    this.envelope.powerOn();
    if (this.elements.stage) this.elements.stage.classList.add('tube-active');
    this.updatePowerLabel();
    const now = performance.now();
    this.scheduler.reset(now);
    this.meter.lastTime = now;
    this.meter.frames = 0;
    this.lastFrameTime = now;
    try {
      await this.audio.start();
      this.audio.applyVolume(this.store.get('volume'));
      this.audio.applyBeat(this.store.get('intercarrier'));
    } catch (err) {
      this.setStatus('音声を開始できませんでした: ' + err.message);
    }
    if (!this.frameHandle) this.loop(now);
  }

  powerOff() {
    if (!this.powered) return;
    this.powered = false;
    // キャプチャはシャットダウン完了時に止める（つぶれる間は最後の映像を保持）。
    this.envelope.powerOff();
    this.audio.stop();
    this.updatePowerLabel();
  }

  handleShutdownComplete() {
    cancelAnimationFrame(this.frameHandle);
    this.frameHandle = 0;
    this.capture.stop();
    this.pipeline.clear();
    // 完全に消えてから案内オーバーレイを復帰させる。
    if (this.elements.stage) this.elements.stage.classList.remove('tube-active');
    this.setStatus('待機中');
  }

  updatePowerLabel() {
    const { power, lamp, stage } = this.elements;
    if (power) power.textContent = this.powered ? '電源を切る' : '電源を入れる';
    if (lamp) lamp.classList.toggle('is-on', this.powered);
    if (stage) stage.classList.toggle('is-on', this.powered);
  }

  async toggleCapture() {
    if (!this.powered) await this.powerOn();
    const active = await this.capture.toggle();
    this.updateCaptureLabel(active);
  }

  updateCaptureLabel(active) {
    const btn = this.elements.capture;
    if (btn) btn.textContent = active ? '映像を停止' : '映像を取り込む';
    const stage = this.elements.stage;
    if (stage) stage.classList.toggle('has-video', active);
  }

  handleCaptureStatus(state, detail) {
    if (state === 'error') { this.setStatus(detail); this.updateCaptureLabel(false); }
    if (state === 'stopped') {
      this.updateCaptureLabel(false);
      this.audio.setVideoMode(false);
      // 砂嵐へ戻るのでカラーキラーを既定（ON=モノクロ）へ戻す
      this.store.set('colorKiller', 1);
    }
    if (state === 'started') {
      this.updateCaptureLabel(true);
      this.audio.setVideoMode(true);
      // 実機はバースト検出でカラーへ切り替わる。キラーを自動解除しクロマゲインを確保。
      this.store.set('colorKiller', 0);
      if (this.store.get('chromaGain') < 0.5) this.store.set('chromaGain', 1.0);
    }
  }

  loop(timestamp) {
    const dt = (timestamp - this.lastFrameTime) / 1000.0;
    this.lastFrameTime = timestamp;
    this.envelope.update(Number.isFinite(dt) ? dt : 0.016);

    if (!this.envelope.shouldRender) {
      this.frameHandle = 0;
      return;   // 完全消灯。次回 powerOn で再開。
    }

    const params = this.store.snapshot();
    const begin = performance.now();

    // シャットダウン中も検波は回し続ける（砂嵐が動いたままつぶれる）。
    // ただし残光段階まで来たら映像更新は不要なので止めて負荷を抑える。
    const collapsing = this.envelope.state === 'shutting';
    const stillLive = this.powered || (collapsing && this.envelope.elapsed < 0.41);
    const hasVideo = stillLive ? this.capture.update() : false;
    if (stillLive) {
      const fields = this.scheduler.advance(timestamp);
      for (let i = 0; i < fields; i += 1) {
        this.pipeline.renderField(params, this.scheduler.nextSeed() + i, this.scheduler.fieldPeriod, hasVideo);
      }
    }
    this.pipeline.renderDisplay(params, this.envelope.uniforms());

    this.meter.cost += performance.now() - begin;
    this.updateStatus(timestamp, hasVideo);
    this.frameHandle = requestAnimationFrame((t) => this.loop(t));
  }

  updateStatus(timestamp, hasVideo) {
    const m = this.meter;
    m.frames += 1;
    const elapsed = timestamp - m.lastTime;
    if (elapsed < 500) return;
    m.fps = Math.round((m.frames * 1000) / elapsed);
    const perFrame = (m.cost / m.frames).toFixed(2);
    m.frames = 0;
    m.cost = 0;
    m.lastTime = timestamp;
    let head;
    if (this.envelope.state === 'warming') head = 'WARMING UP';
    else if (this.envelope.state === 'shutting') head = 'POWERING OFF';
    else head = hasVideo ? 'VIDEO IN' : 'NO SIGNAL';
    this.setStatus(
      head + ' / FIELD ' + this.scheduler.fieldCount.toString().padStart(7, '0') +
      ' / ' + this.resolution.width + '×' + this.resolution.height +
      ' / ' + m.fps + ' fps / CPU ' + perFrame + ' ms'
    );
  }

  setStatus(text) {
    if (this.elements.status) this.elements.status.textContent = text;
  }

  run() {
    this.setStatus('待機中');
    this.updatePowerLabel();
  }
}
