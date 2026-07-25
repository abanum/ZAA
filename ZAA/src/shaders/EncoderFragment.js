// Pass A: 入力 RGB を NTSC コンポジット信号へエンコードする。
//   RGB → YIQ → 帯域制限(Y:4.2 / I:1.3 / Q:0.4 MHz) → 3.58MHz 変調
//
// 出力: R チャンネルにコンポジット振幅。
//   色副搬送波の位相はライン先頭からの絶対サンプル位置 n から算出し、
//   バースト位相と 4 フィールドカウンタを加味することでドットクロールを再現する。
//
// I/Q の帯域が非対称（1.3 / 0.4 MHz）であることが NTSC の色にじみの正体。
// Y を広く、Q を最も狭く帯域制限するため、赤系の縦エッジが横に流れる。

export const ENCODER_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uVideo;
uniform vec2  uSize;          // (有効サンプル数, 有効走査線数)
uniform float uLumaCutoff;    // Y 帯域 / fs
uniform float uCutoffI;       // I 帯域 / fs
uniform float uCutoffQ;       // Q 帯域 / fs
uniform float uChromaGain;    // 変調クロマゲイン
uniform float uBurstPhase;     // バースト基準位相 [rad]
uniform float uFieldBasePhase; // フィールド先頭の基準位相
uniform float uAspectMode;     // 0: レターボックス, 1: 横圧縮
uniform float uInputAspect;    // 入力の幅/高さ

const float PI = 3.141592653589793;
const int   R_Y = 8;
const int   R_I = 14;
const int   R_Q = 26;   // Q は 0.4MHz と狭いためタップ長最大

float win(int k, int radius) {
  return 0.54 + 0.46 * cos(PI * float(k) / float(radius + 1));
}

// 入力映像のサンプリング。4:3 の表示領域に合わせて uv を補正する。
vec3 sampleRGB(float sx, float row) {
  float targetAspect = 4.0 / 3.0;
  vec2 uv = vec2(sx, row);
  if (uAspectMode < 0.5) {
    // レターボックス: 入力アスペクトを保ったまま内側に収める
    float scale = uInputAspect / targetAspect;
    if (scale > 1.0) {
      uv.y = (uv.y - 0.5) * scale + 0.5;   // 上下に黒帯
    } else {
      uv.x = (uv.x - 0.5) / scale + 0.5;   // 左右に黒帯
    }
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec3(0.0);
  }
  // 横圧縮モードはそのまま貼る（4:3 に引き伸ばす）
  return texture(uVideo, uv).rgb;
}

vec3 rgb2yiq(vec3 c) {
  return vec3(
    0.299 * c.r + 0.587 * c.g + 0.114 * c.b,
    0.596 * c.r - 0.274 * c.g - 0.322 * c.b,
    0.211 * c.r - 0.523 * c.g + 0.312 * c.b
  );
}

void main() {
  int n    = int(floor(vUv.x * uSize.x));
  int line = clamp(int(floor(vUv.y * uSize.y)), 0, int(uSize.y) - 1);
  float du = 1.0 / uSize.x;
  float row = (float(line) + 0.5) / uSize.y;

  // 各成分を別カットオフで水平帯域制限する。
  // Y は R_Y、I は R_I、Q は R_Q タップ。1 ループで 3 成分を同時に畳み込む。
  float y = 0.0, ci = 0.0, cq = 0.0;
  float ny = 0.0, ni = 0.0, nq = 0.0;
  for (int k = -R_Q; k <= R_Q; ++k) {
    float sx = vUv.x + float(k) * du;
    vec3 yiq = rgb2yiq(sampleRGB(sx, row));

    // Q（全タップ使用）
    float wq = 2.0 * uCutoffQ * (abs(float(k)) < 0.5 ? 1.0
             : sin(2.0 * PI * uCutoffQ * float(k)) / (2.0 * PI * uCutoffQ * float(k))) * win(k, R_Q);
    cq += yiq.z * wq; nq += wq;

    // I（内側 R_I タップのみ）
    if (k >= -R_I && k <= R_I) {
      float wi = 2.0 * uCutoffI * (abs(float(k)) < 0.5 ? 1.0
               : sin(2.0 * PI * uCutoffI * float(k)) / (2.0 * PI * uCutoffI * float(k))) * win(k, R_I);
      ci += yiq.y * wi; ni += wi;
    }
    // Y（内側 R_Y タップのみ）
    if (k >= -R_Y && k <= R_Y) {
      float wy = 2.0 * uLumaCutoff * (abs(float(k)) < 0.5 ? 1.0
               : sin(2.0 * PI * uLumaCutoff * float(k)) / (2.0 * PI * uLumaCutoff * float(k))) * win(k, R_Y);
      y += yiq.x * wy; ny += wy;
    }
  }
  y  /= max(ny, 1.0e-6);
  ci /= max(ni, 1.0e-6);
  cq /= max(nq, 1.0e-6);

  // 副搬送波位相: 絶対サンプル位置 + 走査線ごとの反転 + バースト基準。
  // 行の偶奇で π 反転し、フィールド基準位相 uFieldBasePhase を加える。
  float linePhase = uFieldBasePhase + (((line & 1) == 1) ? PI : 0.0);
  float phase = 0.5 * PI * float(n) + linePhase + uBurstPhase;
  float composite = y + uChromaGain * (ci * cos(phase) + cq * sin(phase));

  // コンポジットは [-0.33, 1.33] 程度に振れるため、0.5 中心・0.375 スケールで
  // RGBA8 [0,1] に収める（検波側で復元する）。IRE の余裕分に相当。
  float stored = composite * 0.375 + 0.5;
  fragColor = vec4(clamp(stored, 0.0, 1.0), y, 0.0, 1.0);
}
`;
