// WebGL2 コンテキストの取得のみを担当する。

export function createGLContext(canvas) {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });
  if (!gl) throw new Error('WebGL2 が利用できません。');
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  return gl;
}

export function resizeCanvasToDisplay(canvas, gl, internalWidth, internalHeight) {
  if (canvas.width !== internalWidth || canvas.height !== internalHeight) {
    canvas.width = internalWidth;
    canvas.height = internalHeight;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
}

// ソフトウェアレンダラ（SwiftShader 等）へフォールバックしていないかの確認用
export function queryRendererName(gl) {
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const name = ext
    ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
    : gl.getParameter(gl.RENDERER);
  return String(name || 'unknown').slice(0, 64);
}
