// NTSC-M 系の物理定数と、シミュレーション用の派生値。
// ここは「値の定義」のみを持ち、処理は一切書かない。

export const NTSC = Object.freeze({
  // 色副搬送波 fsc
  SUBCARRIER_HZ: 3579545.0,
  // 4fsc サンプリング（デジタルコンポジットの標準）
  SAMPLE_RATE_HZ: 3579545.0 * 4.0,

  // 走査
  LINES_PER_FRAME: 525,
  LINES_PER_FIELD: 262.5,
  ACTIVE_LINES_PER_FIELD: 243,
  ACTIVE_LINES_PER_FRAME: 486,

  // 1H = 63.5555us、有効映像 ≒ 52.6us → 4fsc で約 753 サンプル
  SAMPLES_PER_LINE: 910,
  ACTIVE_SAMPLES_PER_LINE: 754,

  // フィールド周波数 59.94Hz
  FIELD_RATE_HZ: 60000.0 / 1001.0,

  // 映像帯域（VSB）
  VIDEO_BANDWIDTH_HZ: 4200000.0,
  IF_NOISE_BANDWIDTH_HZ: 5000000.0,

  // 音声（FM, 米国 75us デエンファシス）
  DEEMPHASIS_TAU_S: 75e-6,
  AUDIO_LPF_HZ: 15000.0,
  INTERCARRIER_HZ: 15734.264,
});

// シェーダへ渡す正規化カットオフ（fc / fs）
export const NORMALIZED = Object.freeze({
  VIDEO_LPF: NTSC.VIDEO_BANDWIDTH_HZ / NTSC.SAMPLE_RATE_HZ,
  IF_LPF: NTSC.IF_NOISE_BANDWIDTH_HZ / NTSC.SAMPLE_RATE_HZ,
});

export const TEXTURE_SIZE = Object.freeze({
  FIELD_WIDTH: NTSC.ACTIVE_SAMPLES_PER_LINE,
  FIELD_HEIGHT: NTSC.ACTIVE_LINES_PER_FIELD,
});

// カラーバースト基準位相。+I 軸から見て 57°（-(B-Y) 軸、慣例 33° 表記）。
export const BURST_PHASE_RAD = (57.0 * Math.PI) / 180.0;

// 副搬送波位相モデル
//   ・行内: サンプルごとに π/2 進む（4fsc）→ シェーダ側で 0.5π·n として加算
//   ・行間: 各走査線の先頭で π ずれる（1H に半サイクル余分に入るため）→ 行の偶奇で 0 or π
//   ・フィールド間: 1 フィールド = 262.5 走査線の 0.5 により毎フィールド π/2 相当ずれ、
//                    4 フィールド（=2 フレーム）で一巡する。
// これらを合成した「そのフィールドの先頭走査線の基準位相」を返す。
// 実際の各走査線位相は base + (line が奇数なら π) をシェーダに渡して構成する。
export function fieldBasePhase(fieldIndex4) {
  // 262.5 の半端 0.5 走査線ぶん = π の位相送りが毎フィールド蓄積する。
  return (Math.PI * fieldIndex4) % (2.0 * Math.PI);
}
