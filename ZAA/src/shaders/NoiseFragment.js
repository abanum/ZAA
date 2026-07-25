// Pass 0: 複素ガウス白色雑音 (I, Q) をテクスチャへ書き出す。
//
// 以前は検波パスの FIR タップごとに Box-Muller を呼んでいたため、
// 1 サンプルあたり 13 回の log/sqrt/sin/cos が発生していた。
// ここで 1 回だけ生成しておき、検波パスは texelFetch で読むだけにする。
//
// 格納形式: RGBA8 の R,G に I,Q を [-4σ, +4σ] → [0,1] で線形写像。
// 8bit 量子化雑音は FIR 後で約 -41dB となり無視できる。

export const NOISE_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;

uniform vec2 uSize;
uniform uint uFieldSeed;

const float PI = 3.141592653589793;

uint hashU(uint x) {
  x ^= x >> 16u; x *= 0x7feb352du;
  x ^= x >> 15u; x *= 0x846ca68bu;
  x ^= x >> 16u; return x;
}

float hashF(uint x) {
  return float(hashU(x)) * 2.3283064365386963e-10;
}

void main() {
  int n    = int(floor(vUv.x * uSize.x));
  int line = int(floor(vUv.y * uSize.y));

  uint s = uint(line) * 1000003u + uint(n) * 65537u + uFieldSeed * 2654435761u;
  float u1 = max(hashF(s), 1.0e-7);
  float u2 = hashF(s + 0x9e3779b9u);
  float r  = sqrt(-2.0 * log(u1));
  float a  = 2.0 * PI * u2;

  vec2 iq = vec2(r * cos(a), r * sin(a));
  fragColor = vec4(clamp(iq * 0.125 + 0.5, 0.0, 1.0), 0.0, 1.0);
}
`;
