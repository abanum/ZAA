// Pass 1: チューナ/IF/映像検波の再現。
//   1. Pass 0 が生成した複素ガウス白色雑音 (I, Q) を読み出す
//   2. IF 帯域幅に相当する FIR で帯域制限（複素包絡線なので片側 B/2）
//   3. 包絡線検波 -> 振幅はレイリー分布になる
//   4. NTSC は負変調なので反転して映像信号にする
// 出力: R チャンネルにコンポジット映像レベル（0=同期/黒つぶれ, 1=白）

export const DETECTOR_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uNoise;
uniform vec2  uSize;       // (有効サンプル数, 有効走査線数)
uniform uint  uFieldSeed;
uniform float uIfCutoff;   // (IF帯域幅/2) / fs
uniform float uLevel;      // AGC 検波レベル（搬送波振幅の平均値）
uniform float uJitter;     // AGC ハンチング量

const float PI = 3.141592653589793;
const int   TAP_RADIUS = 6;

uint hashU(uint x) {
  x ^= x >> 16u; x *= 0x7feb352du;
  x ^= x >> 15u; x *= 0x846ca68bu;
  x ^= x >> 16u; return x;
}

float hashF(uint x) {
  return float(hashU(x)) * 2.3283064365386963e-10;
}

// [-4σ, +4σ] に写像された雑音テクスチャを元に戻す。端は巻き戻して参照する。
vec2 noiseIQ(int line, int n) {
  int w = int(uSize.x);
  int nx = n < 0 ? n + w : (n >= w ? n - w : n);
  return texelFetch(uNoise, ivec2(nx, line), 0).rg * 8.0 - 4.0;
}

float sinc(float x) {
  return abs(x) < 1.0e-5 ? 1.0 : sin(PI * x) / (PI * x);
}

float lpfTap(int k, float fcn) {
  float fk = float(k);
  float ideal = 2.0 * fcn * sinc(2.0 * fcn * fk);
  float win = 0.54 + 0.46 * cos(PI * fk / float(TAP_RADIUS + 1));
  return ideal * win;
}

void main() {
  int n    = int(floor(vUv.x * uSize.x));
  int line = clamp(int(floor(vUv.y * uSize.y)), 0, int(uSize.y) - 1);

  vec2  acc  = vec2(0.0);
  float norm = 0.0;
  for (int k = -TAP_RADIUS; k <= TAP_RADIUS; ++k) {
    float w = lpfTap(k, uIfCutoff);
    acc  += noiseIQ(line, n + k) * w;
    norm += w * w;
  }
  acc /= sqrt(max(norm, 1.0e-6));   // 分散 1 に戻す

  // 包絡線検波: sigma=1 のレイリー分布、平均 = sqrt(pi/2) = 1.25331
  float env = length(acc);

  // AGC は無信号時に最大利得へ張り付き、緩やかにハンチングする
  float wobble = 1.0 + uJitter * (hashF(uFieldSeed * 7919u + uint(line) * 131u) - 0.5);
  float carrier = env * (uLevel / 1.2533141) * wobble;

  // 負変調: 搬送波振幅が大きいほど暗い
  float video = 1.0 - carrier;

  fragColor = vec4(clamp(video, 0.0, 1.0), 0.0, 0.0, 1.0);
}
`;
