// <video> 要素の現フレームを WebGL テクスチャへ転送する。
// MediaStream のライフサイクルは知らない（ScreenCapture 側の責務）。

export class VideoTexture {
  constructor(gl) {
    this.gl = gl;
    this.texture = gl.createTexture();
    this.width = 0;
    this.height = 0;

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // 1x1 の黒で初期化しておく（映像未取得時はこれが入力になる）
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255]));
  }

  // video の現フレームを取り込む。成功時 true。
  update(video) {
    if (!video || video.readyState < 2 || video.videoWidth === 0) return false;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    this.width = video.videoWidth;
    this.height = video.videoHeight;
    return true;
  }

  // 映像を手放したときに黒へ戻す
  clearToBlack() {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255]));
    this.width = 0;
    this.height = 0;
  }

  get aspect() {
    return this.height > 0 ? this.width / this.height : 4 / 3;
  }

  dispose() {
    this.gl.deleteTexture(this.texture);
  }
}
