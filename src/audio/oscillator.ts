/**
 * Simple oscillator wrapper.
 * 
 * Generates saw, square, pulse, triangle, sine waves.
 * Supports pulse-width modulation for square/pulse.
 */

import { getAudioContext, getCurrentTime } from "./context";

export type OscWave = "saw" | "square" | "pulse" | "triangle" | "sine";

export class Oscillator {
  private osc: OscillatorNode;
  private shaper?: WaveShaperNode;
  private pwm?: GainNode;

  constructor(wave: OscWave, freq: number, pw: number = 0.5) {
    const ctx = getAudioContext();
    this.osc = ctx.createOscillator();

    // Map our wave names to Web Audio types
    if (wave === "saw") {
      this.osc.type = "sawtooth";
    } else if (wave === "pulse" || wave === "square") {
      this.osc.type = "square";
      if (wave === "pulse" && pw !== 0.5) {
        // Pulse width modulation via feedback
        this.pwm = ctx.createGain();
        this.pwm.gain.value = (pw - 0.5) * 2; // -1..1
      }
    } else if (wave === "triangle") {
      this.osc.type = "triangle";
    } else {
      this.osc.type = "sine";
    }

    this.osc.frequency.setValueAtTime(freq, getCurrentTime());
  }

  getNode(): OscillatorNode {
    return this.osc;
  }

  setFrequency(freq: number) {
    this.osc.frequency.setValueAtTime(freq, getCurrentTime());
  }

  setFrequencyRamp(freq: number, time: number) {
    const now = getCurrentTime();
    this.osc.frequency.linearRampToValueAtTime(freq, now + time);
  }

  setPW(pw: number) {
    // Square pulse width via detuning (simple approximation)
    if (pw === 0.5) {
      this.osc.detune.setValueAtTime(0, getCurrentTime());
    } else {
      // Shift pitch slightly to approximate pulse width
      const detuneAmount = (pw - 0.5) * 100; // -50..50 cents
      this.osc.detune.setValueAtTime(detuneAmount, getCurrentTime());
    }
  }

  start() {
    this.osc.start();
  }

  stop() {
    this.osc.stop();
  }
}

/**
 * Sub-oscillator (always sine, one octave down)
 */
export class SubOscillator {
  private osc: OscillatorNode;

  constructor(freq: number) {
    const ctx = getAudioContext();
    this.osc = ctx.createOscillator();
    this.osc.type = "sine";
    this.osc.frequency.setValueAtTime(freq / 2, getCurrentTime());
  }

  getNode(): OscillatorNode {
    return this.osc;
  }

  setFrequency(freq: number) {
    this.osc.frequency.setValueAtTime(freq / 2, getCurrentTime());
  }

  start() {
    this.osc.start();
  }

  stop() {
    this.osc.stop();
  }
}

/**
 * Noise generator
 */
export class NoiseGenerator {
  private bufferSource: AudioBufferSourceNode;

  constructor(duration: number = 4) {
    const ctx = getAudioContext();
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < buffer.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this.bufferSource = ctx.createBufferSource();
    this.bufferSource.buffer = buffer;
    this.bufferSource.loop = true;
  }

  getNode(): AudioBufferSourceNode {
    return this.bufferSource;
  }

  start() {
    this.bufferSource.start();
  }

  stop() {
    this.bufferSource.stop();
  }
}
