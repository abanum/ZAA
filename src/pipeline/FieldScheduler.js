// 59.94Hz のフィールド更新タイミングを刻む。
// 表示リフレッシュ(60Hz等)との差から、実機同様のわずかな「うなり」が出る。

import { NTSC } from '../config/NtscConstants.js';

const MAX_CATCH_UP_FIELDS = 3;

export class FieldScheduler {
  constructor() {
    this.fieldPeriod = 1.0 / NTSC.FIELD_RATE_HZ;
    this.accumulator = 0.0;
    this.fieldCount = 0;
    this.lastTimestamp = 0;
  }

  reset(timestamp) {
    this.accumulator = 0.0;
    this.lastTimestamp = timestamp;
  }

  // 経過時間を与えると、今フレームで進めるべきフィールド数を返す
  advance(timestamp) {
    let dt = (timestamp - this.lastTimestamp) / 1000.0;
    this.lastTimestamp = timestamp;
    if (!Number.isFinite(dt) || dt <= 0) return 0;
    if (dt > 0.25) dt = 0.25;

    this.accumulator += dt;
    let fields = 0;
    while (this.accumulator >= this.fieldPeriod && fields < MAX_CATCH_UP_FIELDS) {
      this.accumulator -= this.fieldPeriod;
      fields += 1;
    }
    if (fields >= MAX_CATCH_UP_FIELDS) this.accumulator = 0.0;
    this.fieldCount += fields;
    return fields;
  }

  nextSeed() {
    // フィールドごとに散らばるシード
    return ((this.fieldCount * 2654435761) ^ 0x5bf03635) >>> 0;
  }

  get elapsedSeconds() {
    return this.fieldCount * this.fieldPeriod;
  }
}
