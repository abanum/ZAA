// Pass 4: 残光バッファをキャンバスへ転送する。
// ブルームは既定で無効化できるようにし、不要なときは 1 フェッチで済ませる。

export const PRESENT_FRAGMENT_SOURCE = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform vec2  uTexel;
uniform float uBloom;
uniform float uGamma;

void main() {
  vec3 col = texture(uSource, vUv).rgb;

  if (uBloom > 0.002) {
    vec3 blur = vec3(0.0);
    blur += texture(uSource, vUv + vec2( uTexel.x * 2.0, 0.0)).rgb;
    blur += texture(uSource, vUv + vec2(-uTexel.x * 2.0, 0.0)).rgb;
    blur += texture(uSource, vUv + vec2(0.0,  uTexel.y * 2.0)).rgb;
    blur += texture(uSource, vUv + vec2(0.0, -uTexel.y * 2.0)).rgb;
    col += blur * (0.25 * uBloom);
  }

  fragColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(uGamma)), 1.0);
}
`;
