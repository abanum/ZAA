// getDisplayMedia のライフサイクルのみを管理する。
// WebGL は知らない。停止・エラー・トラック終了をコールバックで通知する。

export class ScreenCapture {
  constructor() {
    this.stream = null;
    this.video = null;
    this.onStateChange = null;
    this.frameReady = false;    // 新しい映像フレームが届いたか
    this.rvfcHandle = 0;        // requestVideoFrameCallback のハンドル
    this.useRvfc = false;
  }

  get isActive() {
    return this.stream !== null;
  }

  get isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  }

  notify(state, detail) {
    if (this.onStateChange) this.onStateChange(state, detail);
  }

  async start() {
    if (!this.isSupported) {
      this.notify('error', 'このブラウザは画面キャプチャに対応していません。');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 60 },
        audio: false,
      });
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();

      stream.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', () => this.stop());
      });

      this.stream = stream;
      this.video = video;
      this.startFrameTracking(video);
      this.notify('started', video);
      return true;
    } catch (err) {
      const msg = err && err.name === 'NotAllowedError'
        ? 'キャプチャがキャンセルされました。'
        : 'キャプチャを開始できませんでした: ' + (err && err.message ? err.message : err);
      this.notify('error', msg);
      return false;
    }
  }

  // 新フレーム到着を requestVideoFrameCallback で検出する。
  // 未対応ブラウザでは毎フレーム転送にフォールバックする。
  startFrameTracking(video) {
    this.frameReady = true;   // 最初の 1 枚は必ず転送する
    if (typeof video.requestVideoFrameCallback === 'function') {
      this.useRvfc = true;
      const onFrame = () => {
        this.frameReady = true;
        if (this.video === video) {
          this.rvfcHandle = video.requestVideoFrameCallback(onFrame);
        }
      };
      this.rvfcHandle = video.requestVideoFrameCallback(onFrame);
    } else {
      this.useRvfc = false;   // 毎フレーム転送（hasFrame 側で判定）
    }
  }

  // 転送すべき新フレームがあるか。rVFC 対応時は到着したときだけ true。
  consumeFrameReady() {
    if (!this.useRvfc) return this.hasFrame;   // 非対応: 毎フレーム
    if (!this.frameReady) return false;
    this.frameReady = false;
    return this.hasFrame;
  }

  stop() {
    if (!this.stream) return;
    if (this.video && this.rvfcHandle && typeof this.video.cancelVideoFrameCallback === 'function') {
      this.video.cancelVideoFrameCallback(this.rvfcHandle);
    }
    this.rvfcHandle = 0;
    this.frameReady = false;
    this.stream.getTracks().forEach((track) => track.stop());
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
    this.stream = null;
    this.notify('stopped', null);
  }

  // 現フレームが転送可能かどうか
  get hasFrame() {
    return !!this.video && this.video.readyState >= 2 && this.video.videoWidth > 0;
  }

  get frameSize() {
    if (!this.video) return [0, 0];
    return [this.video.videoWidth, this.video.videoHeight];
  }
}
