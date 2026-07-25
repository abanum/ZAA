// Pass 3: CRT 表示の再現。
//   2 レイヤーのフィールドテクスチャを走査線パリティで織り合わせ（インターレース）、
//   電子ビームのスポット径によるにじみ、蛍光体の残光、走査線、
//   画面曲率・周辺光量落ちを適用する。
//
// 最適化:
//   ・フィールドを sampler2DArray にまとめ、1 走査線あたりのフェッチを半減
//   ・水平スポットはバイリニア補間を利用した 2 タップで [0.25, 0.5, 0.25] 相当を得る
//   ・走査線表現は 1 走査線あたり 3 画素以上ないと標本化定理上そもそも表現できないため、
//     解像度に応じて自動的にフェードさせる

export const DISPLAY_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;

uniform highp sampler2DArray uFields;  // レイヤ0: 偶数フィールド / レイヤ1: 奇数フィールド
uniform sampler2D uPrev;               // 前フレーム（残光用）

uniform vec2  uFieldSize;    // (サンプル数, 走査線数/フィールド)
uniform float uActiveLines;  // フレームあたり有効走査線数
uniform float uInterlaceOn;
uniform float uPersistence;
uniform float uSpotV;        // 走査線単位
uniform float uSpotH;        // サンプル単位
uniform float uScanline;
uniform float uCurvature;
uniform float uVignette;
uniform float uOverscan;
uniform float uPixelsPerLine;
uniform float uWarmup;      // 0:消灯 1:通常。輝度の立ち上がり
uniform float uCollapseV;   // 1:通常 0:横一本線につぶれる（垂直偏向停止）
uniform float uCollapseH;   // 1:通常 0:中央の輝点へ収束（水平偏向停止）
uniform float uFlash;       // 消灯時の輝線フラッシュ量

vec2 curve(vec2 uv, float amount) {
  vec2 c = uv * 2.0 - 1.0;
  float r2 = dot(c, c);
  c *= 1.0 + amount * r2;
  return c * 0.5 + 0.5;
}

// バイリニア補間を使い、2 フェッチで水平方向のスポット径を表現する
vec3 sampleLine(int lineIndex, float x) {
  float layer = uInterlaceOn < 0.5 ? 0.0 : float(lineIndex - (lineIndex / 2) * 2);
  float row = (floor(float(lineIndex) * 0.5) + 0.5) / uFieldSize.y;
  float dx = uSpotH * 0.5 / uFieldSize.x;
  vec3 a = texture(uFields, vec3(x - dx, row, layer)).rgb;
  vec3 b = texture(uFields, vec3(x + dx, row, layer)).rgb;
  return (a + b) * 0.5;
}

void main() {
  vec2 uv = curve(vUv, uCurvature);
  vec2 edge = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  float inScreen = edge.x * edge.y;

  uv = (uv - 0.5) * (1.0 - uOverscan * 2.0) + 0.5;

  // 電源つぶれ演出: 垂直・水平方向に中央へ収束させる。
  //   collapseV<1 で縦がつぶれて横一本線に、collapseH<1 で中央の輝点へ。
  // uv を中央から拡大して参照することで、画面内容が中央の細い帯に圧縮される。
  float cV = max(uCollapseV, 0.0025);
  float cH = max(uCollapseH, 0.0025);
  uv.y = (uv.y - 0.5) / cV + 0.5;
  uv.x = (uv.x - 0.5) / cH + 0.5;
  // 収束帯の外側は黒
  float bandMask = step(0.0, uv.y) * step(uv.y, 1.0) * step(0.0, uv.x) * step(uv.x, 1.0);

  float lineF = (1.0 - uv.y) * uActiveLines - 0.5;
  int base = int(floor(lineF));
  int maxLine = int(uActiveLines);

  vec3 col = vec3(0.0);
  float wsum = 0.0;
  float sigma = max(uSpotV, 0.15);
  for (int d = -1; d <= 2; ++d) {
    int li = base + d;
    if (li < 0 || li >= maxLine) continue;
    float dist = float(li) - lineF;
    float w = exp(-0.5 * (dist * dist) / (sigma * sigma));
    col += sampleLine(li, uv.x) * w;
    wsum += w;
  }
  col /= max(wsum, 1.0e-5);

  // 走査線の見え。1 走査線が 2 画素未満になる解像度ではモアレが出るので弱める。
  float visibility = uScanline * smoothstep(2.2, 3.0, uPixelsPerLine);
  float phase = fract(lineF);
  col *= 1.0 - visibility * (0.5 - 0.5 * cos(6.2831853 * phase));

  // 蛍光体の残光: 減衰した前フレームとの max 合成
  vec3 prev = texture(uPrev, vUv).rgb;
  col = max(col, prev * uPersistence);

  // 周辺光量落ち
  vec2 v = vUv * 2.0 - 1.0;
  float vig = 1.0 - uVignette * dot(v, v) * 0.55;
  col *= clamp(vig, 0.0, 1.0);

  // 収束帯の外は黒。つぶれるほど帯が明るくなる（電荷が集中する演出）。
  col *= bandMask;
  col += vec3(uFlash) * bandMask;

  // ウォームアップ: 立ち上がり中は暗く、中央から明るくなる。
  float centerGlow = 1.0 - dot(v, v) * 0.6;
  float warm = clamp(uWarmup * 1.4 - 0.4, 0.0, 1.0) * mix(0.4, 1.0, clamp(centerGlow, 0.0, 1.0));
  col *= mix(0.0, 1.0, clamp(warm + uWarmup * 0.2, 0.0, 1.0));

  fragColor = vec4(col * inScreen, 1.0);
}
`;
