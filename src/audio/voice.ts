/**
 * Voice — represents a single note with all synthesis components.
 * 
 * Each voice contains:
 * - Oscillator (main) + Sub + Noise
 * - Mixer (gains)
 * - Low-pass filter
 * - Filter envelope
 * - Amplitude envelope
 * - Pan
 */

import { getAudioContext, getCurrentTime } from "./context";
import { Oscillator, SubOscillator, NoiseGenerator, type OscWave } from "./oscillator";
import { ADSREnvelope, type ADSRParams } from "./envelope";
import { LowPassFilter } from "./filter";
import { midiToFreq } from "./utils";

export interface VoiceParams {
  wave: OscWave;
  octaveShift: number;
  tune: number;    // semitones
  fine: number;    // cents
  pw: number;      // pulse width 0..1
  pwm: number;     // pwm depth 0..1
  
  subLevel: number;
  noiseLevel: number;
  oscLevel: number;
  
  filterCutoff: number;
  filterResonance: number;
  filterKeyTrack: number;
  filterEnvAmount: number;
  
  ampEnvParams: ADSRParams;
  filterEnvParams: ADSRParams;
  
  pan: number;     // -1..1
}

export class Voice {
  private midiNote: number;
  private velocity: number;
  private params: VoiceParams;
  
  // Oscillators
  private osc: Oscillator;
  private sub: SubOscillator;
  private noise: NoiseGenerator;
  
  // Gains
  private oscGain: GainNode;
  private subGain: GainNode;
  private noiseGain: GainNode;
  private mixGain: GainNode;
  private ampGain: GainNode;
  private panNode: StereoPannerNode;
  
  // Filter
  private filter: LowPassFilter;
  
  // Envelopes
  private ampEnv: ADSREnvelope;
  private filterEnv: ADSREnvelope;
  private filterEnvGain: GainNode;
  
  private isActive: boolean = false;
  private releaseTime: number = 0;

  constructor(midiNote: number, velocity: number, params: VoiceParams, masterOut: GainNode) {
    const ctx = getAudioContext();
    const now = getCurrentTime();
    
    this.midiNote = midiNote;
    this.velocity = velocity;
    this.params = params;
    
    // Calculate frequency with octave, tune, and fine adjustments
    let freq = midiToFreq(midiNote);
    freq *= Math.pow(2, params.octaveShift); // octave shift
    freq *= Math.pow(2, params.tune / 12);    // semitone tune
    freq *= Math.pow(2, params.fine / 1200);  // cent fine
    
    // Create oscillators
    this.osc = new Oscillator(params.wave, freq, params.pw);
    this.sub = new SubOscillator(freq);
    this.noise = new NoiseGenerator();
    
    // Create mixer gains
    this.oscGain = ctx.createGain();
    this.subGain = ctx.createGain();
    this.noiseGain = ctx.createGain();
    this.mixGain = ctx.createGain();
    this.ampGain = ctx.createGain();
    this.panNode = ctx.createStereoPanner();
    
    // Set initial levels
    this.oscGain.gain.setValueAtTime(params.oscLevel, now);
    this.subGain.gain.setValueAtTime(params.subLevel, now);
    this.noiseGain.gain.setValueAtTime(params.noiseLevel, now);
    this.panNode.pan.setValueAtTime(params.pan, now);
    this.ampGain.gain.setValueAtTime(0, now); // Will be controlled by envelope
    
    // Wire oscillators → mixer
    this.osc.getNode().connect(this.oscGain);
    this.sub.getNode().connect(this.subGain);
    this.noise.getNode().connect(this.noiseGain);
    
    this.oscGain.connect(this.mixGain);
    this.subGain.connect(this.mixGain);
    this.noiseGain.connect(this.mixGain);
    
    // Create filter
    this.filter = new LowPassFilter(params.filterCutoff, params.filterResonance);
    
    // Wire mixer → filter → amp gain
    this.mixGain.connect(this.filter.getNode());
    this.filter.getNode().connect(this.ampGain);
    this.ampGain.connect(this.panNode);
    this.panNode.connect(masterOut);
    
    // Create envelopes
    this.ampEnv = new ADSREnvelope(this.ampGain, params.ampEnvParams);
    
    // Filter envelope via modulation gain
    this.filterEnvGain = ctx.createGain();
    this.filterEnvGain.gain.setValueAtTime(0, now);
    this.filterEnv = new ADSREnvelope(this.filterEnvGain, params.filterEnvParams);
    
    // Calculate filter modulation amount (in Hz)
    const modAmount = (params.filterCutoff * 4) * params.filterEnvAmount; // Up to 4x boost
    this.filterEnvGain.gain.setValueAtTime(0, now);
    
    // Start oscillators
    this.osc.start();
    this.sub.start();
    this.noise.start();
    
    this.isActive = true;
  }

  trigger() {
    this.ampEnv.trigger();
    this.filterEnv.trigger();
  }

  release() {
    this.ampEnv.release();
    this.filterEnv.release();
    this.releaseTime = getCurrentTime() + this.params.ampEnvParams.release;
  }

  isReleased(): boolean {
    return getCurrentTime() > this.releaseTime && this.releaseTime > 0;
  }

  updateParams(params: Partial<VoiceParams>) {
    this.params = { ...this.params, ...params };
    
    if (params.oscLevel !== undefined) this.oscGain.gain.setValueAtTime(params.oscLevel, getCurrentTime());
    if (params.subLevel !== undefined) this.subGain.gain.setValueAtTime(params.subLevel, getCurrentTime());
    if (params.noiseLevel !== undefined) this.noiseGain.gain.setValueAtTime(params.noiseLevel, getCurrentTime());
    if (params.pan !== undefined) this.panNode.pan.setValueAtTime(params.pan, getCurrentTime());
    if (params.filterCutoff !== undefined) this.filter.setCutoff(params.filterCutoff);
    if (params.filterResonance !== undefined) this.filter.setResonance(params.filterResonance);
    
    if (params.ampEnvParams) this.ampEnv.updateParams(params.ampEnvParams);
    if (params.filterEnvParams) this.filterEnv.updateParams(params.filterEnvParams);
  }

  stop() {
    if (!this.isActive) return;
    this.ampEnv.stop();
    this.osc.stop();
    this.sub.stop();
    this.noise.stop();
    this.isActive = false;
  }

  getMidiNote(): number {
    return this.midiNote;
  }

  isVoiceActive(): boolean {
    return this.isActive && !this.isReleased();
  }
}
