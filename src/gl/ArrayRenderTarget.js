// フィールドバッファをテクスチャ配列 1 枚にまとめる。
//
// 2 枚の 2D テクスチャに分けると、表示パスで両方をフェッチして mix する必要があり
// テクスチャフェッチ数が 2 倍になっていた。配列にすればレイヤ指定 1 回で済む。

export class ArrayRenderTarget {
  constructor(gl, width, height, layers) {
    this.gl = gl;
    this.width = width;
    this.height = height;
    this.layers = layers;

    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texture);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, width, height, layers);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.framebuffers = [];
    for (let i = 0; i < layers; i += 1) {
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, this.texture, 0, i);
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error('テクスチャ配列のフレームバッファ作成に失敗しました: 0x' + status.toString(16));
      }
      this.framebuffers.push(fb);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  bindLayer(index) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[index]);
    gl.viewport(0, 0, this.width, this.height);
  }

  clear() {
    const gl = this.gl;
    for (let i = 0; i < this.layers; i += 1) {
      this.bindLayer(i);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
  }

  dispose() {
    this.gl.deleteTexture(this.texture);
    this.framebuffers.forEach((fb) => this.gl.deleteFramebuffer(fb));
  }
}
