// 可変パラメータの保持と変更通知だけを行う。DOM も WebGL も知らない。

import { buildDefaultValues } from '../config/DefaultParams.js';

export class ParameterStore {
  constructor() {
    this.values = buildDefaultValues();
    this.listeners = new Set();
  }

  get(key) {
    return this.values[key];
  }

  set(key, value) {
    if (this.values[key] === value) return;
    this.values[key] = value;
    this.listeners.forEach((fn) => fn(key, value));
  }

  snapshot() {
    return this.values;
  }

  resetAll() {
    const defaults = buildDefaultValues();
    for (const key in defaults) this.set(key, defaults[key]);
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
