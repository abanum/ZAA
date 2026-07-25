// GLSL のコンパイル / リンク / uniform 設定を担当する。
// 呼び出し側は型を意識せず setUniforms({name: value}) で渡せる。

function compile(gl, type, source) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, source);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error('シェーダのコンパイルに失敗しました:\n' + log);
  }
  return sh;
}

export class ShaderProgram {
  constructor(gl, vertexSource, fragmentSource) {
    this.gl = gl;
    const vs = compile(gl, gl.VERTEX_SHADER, vertexSource);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.bindAttribLocation(program, 0, 'aPos');
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error('シェーダのリンクに失敗しました:\n' + log);
    }
    this.program = program;
    this.locations = new Map();
  }

  location(name) {
    if (!this.locations.has(name)) {
      this.locations.set(name, this.gl.getUniformLocation(this.program, name));
    }
    return this.locations.get(name);
  }

  use() {
    this.gl.useProgram(this.program);
    return this;
  }

  setUniforms(values) {
    const gl = this.gl;
    for (const name in values) {
      const loc = this.location(name);
      if (loc === null) continue;
      const v = values[name];
      if (typeof v === 'number') {
        gl.uniform1f(loc, v);
      } else if (typeof v === 'boolean') {
        gl.uniform1i(loc, v ? 1 : 0);
      } else if (Array.isArray(v)) {
        if (v.length === 2) gl.uniform2f(loc, v[0], v[1]);
        else if (v.length === 3) gl.uniform3f(loc, v[0], v[1], v[2]);
        else if (v.length === 4) gl.uniform4f(loc, v[0], v[1], v[2], v[3]);
      }
    }
    return this;
  }

  setUnsigned(name, value) {
    const loc = this.location(name);
    if (loc !== null) this.gl.uniform1ui(loc, value >>> 0);
    return this;
  }

  setTexture(name, texture, unit, target) {
    const gl = this.gl;
    const loc = this.location(name);
    if (loc === null) return this;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(target || gl.TEXTURE_2D, texture);
    gl.uniform1i(loc, unit);
    return this;
  }

  dispose() {
    this.gl.deleteProgram(this.program);
  }
}
