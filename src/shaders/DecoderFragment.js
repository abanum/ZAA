// Pass C: NTSC デコーダ本体。
//   輝度: Y/C 分離方式に応じて取り出す（バンドパス／2ラインコム／3ラインコム）。
//   色  : 3.58MHz 帯を同期検波して I/Q を取り出す。4fsc サンプリングなので
//         副搬送波の位相は 1 サンプルあたり pi/2 ずつ進む。
//   カラーキラーが働く場合は色が殺され、砂嵐はモノクロになる。
//
// 隣接走査線は副搬送波位相が反転している（1H=910sampで π ずれる）。
// この性質を使い、ライン間の和で C を打ち消して Y を、差で Y を打ち消して C を得る。

export const DECODER_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uDetector;
uniform vec2  uSize;
uniform float uLumaCutoff;    // 映像帯域 / fs
uniform float uChromaCutoff;  // 色復調後 LPF / fs
uniform float uChromaGain;
uniform float uChromaPhase;   // 局部発振の位相 [rad]
uniform float uContrast;
uniform float uBrightness;
uniform float uYcMode;        // 0: バンドパス, 1: 2ラインコム, 2: 3ラインコム
uniform float uFieldBasePhase; // エンコーダと共有するフィールド基準位相
uniform float uBurstPhase;

const float PI = 3.141592653589793;
const int   LUMA_R   = 8;
const int   CHROMA_R = 12;

float sinc(float x) { return abs(x) < 1.0e-5 ? 1.0 : sin(PI * x) / (PI * x); }
float window(int k, int radius) { return 0.54 + 0.46 * cos(PI * float(k) / float(radius + 1)); }

float composite(int n, int line) {
  int nx = clamp(n, 0, int(uSize.x) - 1);
  int ny = clamp(line, 0, int(uSize.y) - 1);
  return texelFetch(uDetector, ivec2(nx, ny), 0).r;
}

// バンドパス方式の Y: 単純ローパス（C が輝度に残る＝ドット/クロスルミナンス）
float lumaBandpass(int n, int line) {
  float acc = 0.0, norm = 0.0;
  for (int k = -LUMA_R; k <= LUMA_R; ++k) {
    float w = 2.0 * uLumaCutoff * sinc(2.0 * uLumaCutoff * float(k)) * window(k, LUMA_R);
    acc += composite(n + k, line) * w; norm += w;
  }
  return acc / max(norm, 1.0e-6);
}

void main() {
  int n    = int(floor(vUv.x * uSize.x));
  int line = clamp(int(floor(vUv.y * uSize.y)), 0, int(uSize.y) - 1);

  // --- 輝度（Y/C 分離） ---
  float luma;
  if (uYcMode < 0.5) {
    luma = lumaBandpass(n, line);
  } else if (uYcMode < 1.5) {
    // 2 ラインコム: (現在 + 1本前)/2 で C を相殺 → Y。残差を LPF で整える。
    float acc = 0.0, norm = 0.0;
    for (int k = -LUMA_R; k <= LUMA_R; ++k) {
      float w = 2.0 * uLumaCutoff * sinc(2.0 * uLumaCutoff * float(k)) * window(k, LUMA_R);
      float s = 0.5 * (composite(n + k, line) + composite(n + k, line - 1));
      acc += s * w; norm += w;
    }
    luma = acc / max(norm, 1.0e-6);
  } else {
    // 3 ラインコム: (上 + 2*中 + 下)/4 で C を相殺。
    float acc = 0.0, norm = 0.0;
    for (int k = -LUMA_R; k <= LUMA_R; ++k) {
      float w = 2.0 * uLumaCutoff * sinc(2.0 * uLumaCutoff * float(k)) * window(k, LUMA_R);
      float s = 0.25 * (composite(n + k, line - 1) + 2.0 * composite(n + k, line) + composite(n + k, line + 1));
      acc += s * w; norm += w;
    }
    luma = acc / max(norm, 1.0e-6);
  }

  // --- 色差（同期検波 + 復調後 LPF） ---
  // コム方式では現在ラインと隣接ラインの差から C を取り出す（Y を相殺）。
  float linePhase = uFieldBasePhase + (((line & 1) == 1) ? PI : 0.0);
  float ci = 0.0, cq = 0.0, chromaNorm = 0.0;
  for (int k = -CHROMA_R; k <= CHROMA_R; ++k) {
    float w = 2.0 * uChromaCutoff * sinc(2.0 * uChromaCutoff * float(k)) * window(k, CHROMA_R);
    float s;
    if (uYcMode < 0.5) {
      s = composite(n + k, line);
    } else if (uYcMode < 1.5) {
      s = 0.5 * (composite(n + k, line) - composite(n + k, line - 1));
    } else {
      s = composite(n + k, line) - 0.5 * (composite(n + k, line - 1) + composite(n + k, line + 1));
    }
    float ph = 0.5 * PI * float(n + k) + linePhase + uBurstPhase + uChromaPhase;
    ci += s * cos(ph) * w;
    cq += s * sin(ph) * w;
    chromaNorm += w;
  }
  float inv = 2.0 / max(chromaNorm, 1.0e-6);
  ci *= inv * uChromaGain;
  cq *= inv * uChromaGain;

  float Y = luma * uContrast + uBrightness;

  vec3 rgb = vec3(
    Y + 0.9563 * ci + 0.6210 * cq,
    Y - 0.2721 * ci - 0.6474 * cq,
    Y - 1.1070 * ci + 1.7046 * cq
  );

  fragColor = vec4(clamp(rgb, 0.0, 1.0), 1.0);
}
`;
