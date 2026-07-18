/**
 * Low-pass filter wrapper.
 * 
 * Simple BiquadFilterNode configured for low-pass.
 * Supports cutoff frequency, resonance (Q), and keyboard tracking.
 */

import { getAudioContext, getCurrentTime } from "./context";

export class LowPassFilter {
  private filter: BiquadFilterNode;

  constructor(cutoff: number = 2200, resonance: number = 0.15) {
    const ctx = getAudioContext();
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.setValueAtTime(cutoff, getCurrentTime());
    this.filter.Q.setValueAtTime(resonance * 20, getCurrentTime()); // Scale to 0..20
  }

  getNode(): BiquadFilterNode {
    return this.filter;
  }

  setCutoff(freq: number) {
    this.filter.frequency.setValueAtTime(freq, getCurrentTime());
  }

  setCutoffRamp(freq: number, time: number) {
    const now = getCurrentTime();
    this.filter.frequency.linearRampToValueAtTime(freq, now + time);
  }

  setResonance(q: number) {
    // q is 0..1, scale to 0..20
    this.filter.Q.setValueAtTime(q * 20, getCurrentTime());
  }

  getFrequency(): number {
    return this.filter.frequency.value;
  }
}
