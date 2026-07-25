// ScreenCapture（MediaStream）と VideoTexture（WebGL）を仲介する。
// AppController からはこのファサード 1 つだけを扱う。

import { ScreenCapture } from './ScreenCapture.js';
import { VideoTexture } from './VideoTexture.js';

export class CaptureCoordinator {
  constructor(gl) {
    this.capture = new ScreenCapture();
    this.texture = new VideoTexture(gl);
    this.onStatus = null;
    this.capture.onStateChange = (state, detail) => this.handleState(state, detail);
  }

  get videoTexture() {
    return this.texture;
  }

  get isSupported() {
    return this.capture.isSupported;
  }

  get isActive() {
    return this.capture.isActive;
  }

  handleState(state, detail) {
    if (state === 'stopped' || state === 'error') this.texture.clearToBlack();
    if (this.onStatus) this.onStatus(state, detail);
  }

  async toggle() {
    if (this.capture.isActive) {
      this.capture.stop();
      return false;
    }
    return this.capture.start();
  }

  stop() {
    this.capture.stop();
  }

  // 毎フレーム呼ぶ。新しい映像フレームが届いたときだけ転送する。
  // 転送を省いても直近のテクスチャが残るため、映像は途切れない。
  update() {
    if (!this.capture.isActive) return false;
    if (this.capture.consumeFrameReady()) this.texture.update(this.capture.video);
    return true;
  }

  dispose() {
    this.capture.stop();
    this.texture.dispose();
  }
}
