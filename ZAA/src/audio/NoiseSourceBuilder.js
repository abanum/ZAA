// 無信号時の FM 音声ノイズを組み立てる。
//
// FM 検波器の出力雑音は電力が f^2 に比例する（いわゆる三角雑音）。
// これに 75us デエンファシス(1次LPF, 折点 2122Hz)が掛かるので、
// 最終的な電力スペクトルは f^2 / (1 + (f/2122)^2) となり、
// これは「白色雑音を折点 2122Hz の 1 次ハイパスに通したもの」と等価。
// 最後に音声帯域(15kHz)で帯域制限する。

import { NTSC } from '../config/NtscConstants.js';

const NOISE_BUFFER_SECONDS = 4;

export function createGaussianNoiseBuffer(ctx) {
  const length = ctx.sampleRate * NOISE_BUFFER_SECONDS;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 2) {
    const u1 = Math.max(Math.random(), 1e-9);
    const u2 = Math.random();
    const r = Math.sqrt(-2.0 * Math.log(u1));
    const a = 2.0 * Math.PI * u2;
    data[i] = r * Math.cos(a) * 0.25;
    if (i + 1 < length) data[i + 1] = r * Math.sin(a) * 0.25;
  }
  return buffer;
}

export function createDeemphasisShaper(ctx) {
  const tau = NTSC.DEEMPHASIS_TAU_S;
  const dt = 1.0 / ctx.sampleRate;
  const a = tau / (tau + dt);
  return ctx.createIIRFilter(new Float64Array([a, -a]), new Float64Array([1.0, -a]));
}

export function createAudioBandLimiter(ctx) {
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = NTSC.AUDIO_LPF_HZ;
  lpf.Q.value = 0.707;
  return lpf;
}

export function createIntercarrierTone(ctx) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = NTSC.INTERCARRIER_HZ;
  return osc;
}
