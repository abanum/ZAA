// ブラウン管の電源投入・切断の物理挙動を時間で表現する状態機械。
// 表示シェーダへ渡す 4 値（warmup, collapseV, collapseH, flash）を生成する。
// WebGL も DOM も知らない。

const WARMUP_SEC = 1.5;      // ヒーターが温まり映像が立ち上がるまで
const COLLAPSE_V_SEC = 0.13; // 縦がつぶれて横一本線になるまで（速い）
const COLLAPSE_H_SEC = 0.28; // 輝線が中央の輝点へ収束するまで
const AFTERGLOW_SEC = 0.55;  // 輝点が残光で消えるまで

export const PowerState = Object.freeze({
  OFF: 'off',
  WARMING: 'warming',
  ON: 'on',
  SHUTTING: 'shutting',
});

export class PowerEnvelope {
  constructor() {
    this.state = PowerState.OFF;
    this.elapsed = 0.0;
    this.onShutdownComplete = null;
  }

  get isVisible() {
    return this.state !== PowerState.OFF;
  }

  // 実際の信号処理を回すべきか（消灯・収束後は不要）
  get shouldRender() {
    return this.state === PowerState.WARMING || this.state === PowerState.ON
      || this.state === PowerState.SHUTTING;
  }

  powerOn() {
    if (this.state === PowerState.ON || this.state === PowerState.WARMING) return;
    this.state = PowerState.WARMING;
    this.elapsed = 0.0;
  }

  // 切断を開始する（完了時に onShutdownComplete を呼ぶ）
  powerOff() {
    if (this.state === PowerState.OFF) return;
    this.state = PowerState.SHUTTING;
    this.elapsed = 0.0;
  }

  update(dtSec) {
    this.elapsed += dtSec;
    if (this.state === PowerState.WARMING && this.elapsed >= WARMUP_SEC) {
      this.state = PowerState.ON;
    } else if (this.state === PowerState.SHUTTING) {
      const total = COLLAPSE_V_SEC + COLLAPSE_H_SEC + AFTERGLOW_SEC;
      if (this.elapsed >= total) {
        this.state = PowerState.OFF;
        if (this.onShutdownComplete) this.onShutdownComplete();
      }
    }
  }

  // シェーダ uniform 値
  uniforms() {
    switch (this.state) {
      case PowerState.WARMING: {
        const t = Math.min(this.elapsed / WARMUP_SEC, 1.0);
        // ゆっくり立ち上がり、最後に一気に明るくなる曲線
        const warm = t * t * (3.0 - 2.0 * t);
        return { uWarmup: warm, uCollapseV: 1.0, uCollapseH: 1.0, uFlash: 0.0 };
      }
      case PowerState.ON:
        return { uWarmup: 1.0, uCollapseV: 1.0, uCollapseH: 1.0, uFlash: 0.0 };
      case PowerState.SHUTTING:
        return this.shutdownUniforms();
      default:
        return { uWarmup: 0.0, uCollapseV: 1.0, uCollapseH: 1.0, uFlash: 0.0 };
    }
  }

  // 3 段階の切断: 縦つぶれ → 横収束 → 残光
  shutdownUniforms() {
    const t = this.elapsed;
    if (t < COLLAPSE_V_SEC) {
      // 縦つぶれ: 偏向エネルギーが指数減衰するので最初速く最後ゆっくり。
      const p = easeOutExpo(t / COLLAPSE_V_SEC);
      return { uWarmup: 1.0, uCollapseV: 1.0 - p, uCollapseH: 1.0, uFlash: p * 0.6 };
    }
    if (t < COLLAPSE_V_SEC + COLLAPSE_H_SEC) {
      // 横収束も同様に急峻に始まってから緩む。
      const p = easeOutExpo((t - COLLAPSE_V_SEC) / COLLAPSE_H_SEC);
      return { uWarmup: 1.0, uCollapseV: 0.0, uCollapseH: 1.0 - p, uFlash: 0.6 + p * 0.4 };
    }
    // 残光: 中央の輝点が指数的に減衰して消える。
    const p = (t - COLLAPSE_V_SEC - COLLAPSE_H_SEC) / AFTERGLOW_SEC;
    const fade = Math.exp(-4.0 * Math.min(p, 1.0));
    return { uWarmup: fade, uCollapseV: 0.0, uCollapseH: 0.0, uFlash: fade };
  }
}

// 立ち上がり急峻・末尾平坦のイージング（偏向コイルの指数減衰に相当）
function easeOutExpo(x) {
  return x >= 1.0 ? 1.0 : 1.0 - Math.pow(2.0, -10.0 * x);
}
