// Pass B: ライス検波。搬送波（エンコード済みコンポジット映像）に
//   帯域制限した複素ガウス雑音を重畳し、包絡線検波する。
//
//   fieldStrength = 1 : ほぼクリアなコンポジット信号（雑音は noiseFloor のみ）
//   fieldStrength = 0 : 搬送波が消え、レイリー分布 = 純粋な砂嵐（1.1 版と一致）
//
// 出力はコンポジット信号（Y + 変調クロマ）。この後の Pass C が Y/C 分離を行う。
// 雑音は Pass 0 の雑音テクスチャ（複素ガウス I/Q）を IF 帯域で整形して用いる。

export const RICE_DETECTOR_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uNoise;      // 複素ガウス白色雑音 (R,G = I,Q)
uniform sampler2D uComposite;  // エンコード済みコンポジット (R成分)。未取得時は黒。
uniform vec2  uSize;
uniform uint  uFieldSeed;
uniform float uIfCutoff;       // (IF帯域幅/2) / fs
uniform float uFieldStrength;  // 電界強度 0..1
uniform float uNoiseFloor;     // 電界最大でも残す雑音量
uniform float uJitter;         // AGC ハンチング
uniform float uHasVideo;       // 1: 映像入力あり, 0: 砂嵐のみ
uniform float uSnowLevel;      // 砂嵐時の検波レベル (agcLevel)

const float PI = 3.141592653589793;
const int   TAP_RADIUS = 6;

uint hashU(uint x) {
  x ^= x >> 16u; x *= 0x7feb352du;
  x ^= x >> 15u; x *= 0x846ca68bu;
  x ^= x >> 16u; return x;
}
float hashF(uint x) { return float(hashU(x)) * 2.3283064365386963e-10; }

vec2 noiseIQ(int line, int n) {
  int w = int(uSize.x);
  int nx = n < 0 ? n + w : (n >= w ? n - w : n);
  return texelFetch(uNoise, ivec2(nx, line), 0).rg * 8.0 - 4.0;
}

float sinc(float x) { return abs(x) < 1.0e-5 ? 1.0 : sin(PI * x) / (PI * x); }
float lpfTap(int k, float fcn) {
  float fk = float(k);
  return 2.0 * fcn * sinc(2.0 * fcn * fk) * (0.54 + 0.46 * cos(PI * fk / float(TAP_RADIUS + 1)));
}

void main() {
  int n    = int(floor(vUv.x * uSize.x));
  int line = clamp(int(floor(vUv.y * uSize.y)), 0, int(uSize.y) - 1);

  // 帯域制限した複素雑音（分散1に正規化）
  vec2 noise = vec2(0.0);
  float norm = 0.0;
  for (int k = -TAP_RADIUS; k <= TAP_RADIUS; ++k) {
    float w = lpfTap(k, uIfCutoff);
    noise += noiseIQ(line, n + k) * w;
    norm  += w * w;
  }
  noise /= sqrt(max(norm, 1.0e-6));

  if (uHasVideo < 0.5) {
    // ---- 砂嵐のみ（1.1 版と等価）----
    float env = length(noise);
    float wobble = 1.0 + uJitter * (hashF(uFieldSeed * 7919u + uint(line) * 131u) - 0.5);
    float video = 1.0 - env * (uSnowLevel / 1.2533141) * wobble;
    fragColor = vec4(clamp(video, 0.0, 1.0), 0.0, 0.0, 1.0);
    return;
  }

  // ---- 映像入力（ライス検波）----
  // 格納時に 0.5 中心・0.375 スケールしたコンポジットを信号領域へ戻す。
  float stored = texelFetch(uComposite, ivec2(n, line), 0).r;
  float composite = (stored - 0.5) / 0.375;   // [-1.33, 1.33] 相当へ復元

  // ライス検波: 搬送波(1+composite)を電界強度で振幅変調し、雑音を重畳して包絡線検波。
  //   fieldStrength=1: A≈1+composite, 雑音は noiseFloor のみ → クリアな映像
  //   fieldStrength=0: A≈0, 雑音のみ → レイリー分布（砂嵐）へ連続一致
  float sigma = mix(1.0, uNoiseFloor, uFieldStrength);
  float A = uFieldStrength * (1.0 + composite);
  float re = A + noise.x * sigma;
  float im = noise.y * sigma;
  float env = sqrt(re * re + im * im);

  // 強電界: 搬送波ぶん(fieldStrength)を差し引いて composite を取り出す。
  //   ただし弱電界では除算が発散するため、砂嵐の負変調式へ連続的にブレンドする。
  float videoDetected = (env - uFieldStrength) / max(uFieldStrength, 0.15);
  float snowDetected  = 1.0 - env * (uSnowLevel / 1.2533141);
  float detected = mix(snowDetected, videoDetected, smoothstep(0.0, 0.35, uFieldStrength));

  fragColor = vec4(clamp(detected, 0.0, 1.0), 0.0, 0.0, 1.0);
}
`;
