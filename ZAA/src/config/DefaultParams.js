// 可変パラメータの定義。UI はこの配列から自動生成される。
// group: パネル上の区分 / key: ParameterStore のキー

export const PARAM_DEFS = Object.freeze([
  // --- 信号 / 電界強度 ---
  { key: 'fieldStrength', group: 'SIGNAL', label: '電界強度 (0=砂嵐)', min: 0.0, max: 1.0, step: 0.01, value: 1.00, unit: '' },
  { key: 'noiseFloor', group: 'SIGNAL', label: '最小雑音 (残る粒)', min: 0.0, max: 0.30, step: 0.01, value: 0.04, unit: '' },

  // --- エンコーダ（映像入力時） ---
  { key: 'chromaBandI', group: 'ENCODER', label: 'I 帯域', min: 0.4, max: 2.0, step: 0.1, value: 1.3, unit: 'MHz' },
  { key: 'chromaBandQ', group: 'ENCODER', label: 'Q 帯域', min: 0.2, max: 1.3, step: 0.1, value: 0.4, unit: 'MHz' },
  { key: 'encChromaGain', group: 'ENCODER', label: '変調クロマゲイン', min: 0.0, max: 1.5, step: 0.05, value: 1.0, unit: '' },
  { key: 'aspectMode', group: 'ENCODER', label: '横圧縮 (16:9→4:3)', min: 0.0, max: 1.0, step: 1.0, value: 0.0, unit: '', type: 'toggle' },
  { key: 'ycSeparation', group: 'ENCODER', label: 'Y/C分離 0:BPF 1:2comb 2:3comb', min: 0.0, max: 2.0, step: 1.0, value: 1.0, unit: '' },

  // --- 受信・検波系 ---
  { key: 'agcLevel', group: 'RF / DETECTOR', label: '検波レベル (AGC)', min: 0.20, max: 0.95, step: 0.01, value: 0.62, unit: '' },
  { key: 'agcJitter', group: 'RF / DETECTOR', label: 'AGCハンチング', min: 0.0, max: 0.40, step: 0.01, value: 0.06, unit: '' },
  { key: 'ifBandwidth', group: 'RF / DETECTOR', label: 'IF帯域幅', min: 2.0, max: 7.0, step: 0.1, value: 5.0, unit: 'MHz' },

  // --- 映像デコーダ ---
  { key: 'lumaBandwidth', group: 'VIDEO DECODER', label: '映像帯域 (LPF)', min: 1.0, max: 4.2, step: 0.1, value: 4.2, unit: 'MHz' },
  { key: 'chromaGain', group: 'VIDEO DECODER', label: 'クロマゲイン', min: 0.0, max: 2.0, step: 0.01, value: 0.70, unit: '' },
  { key: 'colorKiller', group: 'VIDEO DECODER', label: 'カラーキラー', min: 0.0, max: 1.0, step: 1.0, value: 1.0, unit: '', type: 'toggle' },
  { key: 'chromaDrift', group: 'VIDEO DECODER', label: '副搬送波位相ドリフト', min: 0.0, max: 3.0, step: 0.05, value: 0.6, unit: 'rad/s' },
  { key: 'contrast', group: 'VIDEO DECODER', label: 'コントラスト', min: 0.3, max: 2.0, step: 0.01, value: 1.15, unit: '' },
  { key: 'brightness', group: 'VIDEO DECODER', label: 'ブライトネス', min: -0.3, max: 0.3, step: 0.01, value: -0.02, unit: '' },

  // --- CRT 表示系 ---
  { key: 'interlace', group: 'CRT', label: 'インターレース', min: 0.0, max: 1.0, step: 1.0, value: 1.0, unit: '', type: 'toggle' },
  { key: 'persistence', group: 'CRT', label: '蛍光体残光', min: 0.0, max: 0.75, step: 0.01, value: 0.22, unit: '' },
  { key: 'spotV', group: 'CRT', label: 'ビーム径 (垂直)', min: 0.30, max: 1.60, step: 0.01, value: 0.45, unit: 'line' },
  { key: 'spotH', group: 'CRT', label: 'ビーム径 (水平)', min: 0.30, max: 2.50, step: 0.01, value: 0.85, unit: 'smp' },
  { key: 'scanline', group: 'CRT', label: '走査線の見え (高解像度時のみ)', min: 0.0, max: 0.60, step: 0.01, value: 0.35, unit: '' },
  { key: 'curvature', group: 'CRT', label: '画面曲率', min: 0.0, max: 0.12, step: 0.005, value: 0.025, unit: '' },
  { key: 'vignette', group: 'CRT', label: '周辺光量落ち', min: 0.0, max: 0.8, step: 0.01, value: 0.30, unit: '' },
  { key: 'overscan', group: 'CRT', label: 'オーバースキャン', min: 0.0, max: 0.08, step: 0.005, value: 0.02, unit: '' },

  // --- 描画負荷 ---
  { key: 'renderScale', group: 'RENDER', label: '描画解像度', min: 0.40, max: 2.00, step: 0.05, value: 1.50, unit: 'x' },
  { key: 'bloom', group: 'RENDER', label: '管面ハレーション', min: 0.0, max: 0.30, step: 0.01, value: 0.10, unit: '' },

  // --- 音声 ---
  { key: 'volume', group: 'AUDIO', label: '音量', min: 0.0, max: 1.0, step: 0.01, value: 0.35, unit: '' },
  { key: 'intercarrier', group: 'AUDIO', label: 'インターキャリアビート', min: 0.0, max: 0.25, step: 0.01, value: 0.0, unit: '' },
]);

export function buildDefaultValues() {
  const out = {};
  for (const def of PARAM_DEFS) out[def.key] = def.value;
  return out;
}
