/**
 * ADSR Envelope Generator.
 * 
 * Standard four-segment envelope: Attack, Decay, Sustain, Release.
 * Applies to a GainNode, modulating its gain over time.
 */

import { getAudioContext, getCurrentTime } from "./context";

export interface ADSRParams {
  attack: number;   // seconds
  decay: number;    // seconds
  sustain: number;  // 0..1
  release: number;  // seconds
}

export class ADSREnvelope {
  private gain: GainNode;
  private params: ADSRParams;

  constructor(gain: GainNode, params: ADSRParams) {
    this.gain = gain;
    this.params = params;
  }

  updateParams(params: Partial<ADSRParams>) {
    this.params = { ...this.params, ...params };
  }

  trigger() {
    const now = getCurrentTime();
    const { attack, decay, sustain } = this.params;

    // Attack: 0 → 1
    this.gain.gain.setValueAtTime(0, now);
    this.gain.gain.linearRampToValueAtTime(1, now + attack);

    // Decay: 1 → sustain
    this.gain.gain.linearRampToValueAtTime(sustain, now + attack + decay);
  }

  release() {
    const now = getCurrentTime();
    const { release } = this.params;

    // Get current value
    const current = this.gain.gain.value;

    // Release: current → 0
    this.gain.gain.setValueAtTime(current, now);
    this.gain.gain.linearRampToValueAtTime(0, now + release);
  }

  // For immediate cutoff (panic)
  stop() {
    const now = getCurrentTime();
    this.gain.gain.setValueAtTime(0, now);
  }
}
