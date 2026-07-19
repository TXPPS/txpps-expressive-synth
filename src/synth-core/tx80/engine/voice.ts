import type { Tx80Layer, Tx80Patch } from "../types";

/** Shared per-context modulation nodes owned by TX80Engine. Voices connect
 *  to these at construction and disconnect on dispose — the engine never has
 *  to touch live voices when bend/ribbon/LFO routing changes. */
export interface Tx80SharedNodes {
  /** Pitch bend in cents (ConstantSource). */
  pitchBendSource: ConstantSourceNode;
  /** Ribbon offset in cents (ConstantSource). */
  ribbonSource: ConstantSourceNode;
  /** Summed pitch modulation in cents (LFOs + mod wheel vibrato). */
  pitchModBus: GainNode;
  /** Filter cutoff modulation in cents (LFO destination "filter"). */
  cutoffModBus: GainNode;
  /** Pulse-width modulation in comparator-offset units (LFO dest "pw"). */
  pwModBus: GainNode;
  /** Per-layer pulse-width comparator offsets (offset = 1 − 2·pw). */
  pwConst: [ConstantSourceNode, ConstantSourceNode];
  /** Looped noise buffer shared by all voices. */
  noiseBuffer: AudioBuffer;
}

/** How a new note reaches its pitch (resolved by the engine per noteOn). */
export interface PitchTravel {
  fromNote: number;
  mode: "porta" | "gliss";
  /** Seconds per octave of travel. */
  timePerOctave: number;
}

const MIN_STEP_SECONDS = 0.02;

function noteToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/** Comparator curve turning a sawtooth (plus DC offset) into a pulse wave.
 *  Cached module-wide — the curve is stateless and shareable. */
let pulseCurve: Float32Array | null = null;
function getPulseCurve(): Float32Array {
  if (!pulseCurve) {
    const n = 2048;
    pulseCurve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 4 - 2; // -2..2 (saw −1..1 plus offset −0.9..0.9)
      // Slightly smoothed comparator: reduces aliasing at the step edge.
      pulseCurve[i] = Math.tanh(x * 24);
    }
  }
  return pulseCurve;
}

/** One layer's contribution to one held note. Owns its oscillators, filter
 *  and envelopes; connects to shared modulation buses; releases and disposes
 *  independently of its sibling layer sub-voice. */
export class Tx80SubVoice {
  readonly layerIndex: 0 | 1;
  private readonly ctx: AudioContext;
  private layer: Tx80Layer;
  private readonly shared: Tx80SharedNodes;

  private mainOsc!: OscillatorNode;
  private pulseShaper: WaveShaperNode | null = null;
  private subOsc!: OscillatorNode;
  private noiseSrc!: AudioBufferSourceNode;
  private oscGain!: GainNode;
  private subGain!: GainNode;
  private noiseGain!: GainNode;
  private filter!: BiquadFilterNode;
  private envGain!: GainNode;
  private out!: GainNode;

  private note: number;
  private endTimeLocal = Infinity;
  private releasedLocal = false;

  constructor(
    ctx: AudioContext,
    dest: AudioNode,
    layerIndex: 0 | 1,
    layer: Tx80Layer,
    patch: Tx80Patch,
    note: number,
    velocity: number,
    shared: Tx80SharedNodes,
    travel: PitchTravel | null,
  ) {
    this.ctx = ctx;
    this.layerIndex = layerIndex;
    this.layer = layer;
    this.shared = shared;
    this.note = note;

    const now = ctx.currentTime;

    // ── Sources ────────────────────────────────────────────────────────────
    this.oscGain = ctx.createGain();
    this.oscGain.gain.value = layer.oscLevel;
    if (layer.wave === "pulse") {
      this.mainOsc = ctx.createOscillator();
      this.mainOsc.type = "sawtooth";
      this.pulseShaper = ctx.createWaveShaper();
      this.pulseShaper.curve = getPulseCurve() as Float32Array<ArrayBuffer>;
      this.pulseShaper.oversample = "2x";
      this.mainOsc.connect(this.pulseShaper);
      shared.pwConst[layerIndex].connect(this.pulseShaper);
      shared.pwModBus.connect(this.pulseShaper);
      // Comparator output is full-scale ±1 — trim to match the other waves.
      const trim = ctx.createGain();
      trim.gain.value = 0.7;
      this.pulseShaper.connect(trim);
      trim.connect(this.oscGain);
    } else {
      this.mainOsc = ctx.createOscillator();
      this.mainOsc.type = layer.wave === "saw" ? "sawtooth" : layer.wave;
      this.mainOsc.connect(this.oscGain);
    }

    this.subOsc = ctx.createOscillator();
    this.subOsc.type = "square";
    this.subGain = ctx.createGain();
    this.subGain.gain.value = layer.subLevel * 0.8;
    this.subOsc.connect(this.subGain);

    this.noiseSrc = ctx.createBufferSource();
    this.noiseSrc.buffer = shared.noiseBuffer;
    this.noiseSrc.loop = true;
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = layer.noiseLevel * 0.6;
    this.noiseSrc.connect(this.noiseGain);

    // ── Filter ─────────────────────────────────────────────────────────────
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = this.trackedCutoff();
    this.filter.Q.value = layer.filter.resonance * 12;
    this.oscGain.connect(this.filter);
    this.subGain.connect(this.filter);
    this.noiseGain.connect(this.filter);
    shared.cutoffModBus.connect(this.filter.detune);

    // Filter envelope (bipolar, in cents on filter.detune — additive with the
    // LFO cutoff bus which arrives as a connected input).
    const f = layer.filterEnv;
    const peakCents = layer.filter.envAmount * 4800;
    this.filter.detune.setValueAtTime(0, now);
    this.filter.detune.linearRampToValueAtTime(peakCents, now + Math.max(0.001, f.attack));
    this.filter.detune.linearRampToValueAtTime(
      peakCents * f.sustain,
      now + Math.max(0.001, f.attack) + Math.max(0.001, f.decay),
    );

    // ── Amp envelope + output ──────────────────────────────────────────────
    const a = layer.ampEnv;
    this.envGain = ctx.createGain();
    this.envGain.gain.value = 0;
    this.filter.connect(this.envGain);
    const velGain = 1 - patch.velocitySens + patch.velocitySens * velocity;
    this.out = ctx.createGain();
    this.out.gain.value = 0.22 * velGain; // polyphony headroom
    this.envGain.connect(this.out);
    this.out.connect(dest);
    this.envGain.gain.setValueAtTime(0, now);
    this.envGain.gain.linearRampToValueAtTime(1, now + Math.max(0.001, a.attack));
    this.envGain.gain.linearRampToValueAtTime(
      a.sustain,
      now + Math.max(0.001, a.attack) + Math.max(0.001, a.decay),
    );

    // ── Pitch, shared modulation, travel ───────────────────────────────────
    for (const osc of [this.mainOsc, this.subOsc]) {
      shared.pitchBendSource.connect(osc.detune);
      shared.ribbonSource.connect(osc.detune);
      shared.pitchModBus.connect(osc.detune);
    }
    this.applyPitch(note, travel, now);

    this.mainOsc.start(now);
    this.subOsc.start(now);
    this.noiseSrc.start(now);
  }

  /** Layer-adjusted MIDI-note pitch for the main oscillator. */
  private layerNote(note: number): number {
    return note + this.layer.octave * 12 + this.layer.coarse + this.layer.fine / 100;
  }

  private trackedCutoff(): number {
    const kt = this.layer.filter.keyTracking;
    const tracked = this.layer.filter.cutoff * Math.pow(2, ((this.note - 60) / 12) * kt);
    return Math.min(18000, Math.max(20, tracked));
  }

  /** Schedule pitch onset: instant, portamento (smooth exponential ramp with
   *  exact arrival) or glissando (discrete chromatic setValueAtTime steps,
   *  exact arrival on the final pitch). */
  private applyPitch(note: number, travel: PitchTravel | null, now: number): void {
    const targetMain = noteToFreq(this.layerNote(note));
    const targetSub = targetMain / 2;
    if (!travel || travel.fromNote === note) {
      this.mainOsc.frequency.setValueAtTime(targetMain, now);
      this.subOsc.frequency.setValueAtTime(targetSub, now);
      return;
    }
    const fromMain = noteToFreq(this.layerNote(travel.fromNote));
    const semis = note - travel.fromNote;
    if (travel.mode === "porta") {
      const dur = Math.max(0.005, (travel.timePerOctave * Math.abs(semis)) / 12);
      this.mainOsc.frequency.setValueAtTime(fromMain, now);
      this.mainOsc.frequency.exponentialRampToValueAtTime(targetMain, now + dur);
      this.subOsc.frequency.setValueAtTime(fromMain / 2, now);
      this.subOsc.frequency.exponentialRampToValueAtTime(targetSub, now + dur);
      return;
    }
    // Glissando: one discrete step per semitone; the last step lands exactly
    // on the target pitch.
    const stepDur = Math.max(MIN_STEP_SECONDS, travel.timePerOctave / 12);
    const dir = Math.sign(semis);
    const steps = Math.abs(Math.round(semis));
    this.mainOsc.frequency.setValueAtTime(fromMain, now);
    this.subOsc.frequency.setValueAtTime(fromMain / 2, now);
    for (let k = 1; k <= steps; k++) {
      const stepNote = travel.fromNote + dir * k;
      const fStep = noteToFreq(this.layerNote(k === steps ? note : stepNote));
      const t = now + k * stepDur;
      this.mainOsc.frequency.setValueAtTime(fStep, t);
      this.subOsc.frequency.setValueAtTime(fStep / 2, t);
    }
  }

  /** Legato retune (solo mode): interrupt any travel in progress and move to
   *  the new target using the requested mode. */
  retune(note: number, travel: PitchTravel | null): void {
    const now = this.ctx.currentTime;
    // Hold the current value, then re-schedule from here.
    for (const osc of [this.mainOsc, this.subOsc]) {
      const cur = osc.frequency.value;
      osc.frequency.cancelScheduledValues(now);
      osc.frequency.setValueAtTime(Math.max(1, cur), now);
    }
    this.note = note;
    this.applyPitch(note, travel, now);
    // Keyboard tracking follows the sounding note.
    this.filter.frequency.setTargetAtTime(this.trackedCutoff(), now, 0.02);
  }

  /** Live filter update from a patch edit (affects sounding notes). */
  updateFilter(): void {
    const now = this.ctx.currentTime;
    this.filter.frequency.setTargetAtTime(this.trackedCutoff(), now, 0.02);
    this.filter.Q.setTargetAtTime(this.layer.filter.resonance * 12, now, 0.02);
  }

  /** Live tuning update from a patch edit (octave/coarse/fine). */
  updateTuning(): void {
    const now = this.ctx.currentTime;
    const targetMain = noteToFreq(this.layerNote(this.note));
    this.mainOsc.frequency.cancelScheduledValues(now);
    this.mainOsc.frequency.setTargetAtTime(targetMain, now, 0.01);
    this.subOsc.frequency.cancelScheduledValues(now);
    this.subOsc.frequency.setTargetAtTime(targetMain / 2, now, 0.01);
  }

  /** Live source-mix update from a patch edit. */
  updateLevels(): void {
    const now = this.ctx.currentTime;
    this.oscGain.gain.setTargetAtTime(this.layer.oscLevel, now, 0.02);
    this.subGain.gain.setTargetAtTime(this.layer.subLevel * 0.8, now, 0.02);
    this.noiseGain.gain.setTargetAtTime(this.layer.noiseLevel * 0.6, now, 0.02);
  }

  /** Point this sub-voice at the (possibly replaced) layer object. */
  setLayer(layer: Tx80Layer): void {
    this.layer = layer;
  }

  release(now: number): number {
    if (this.releasedLocal) return this.endTimeLocal;
    this.releasedLocal = true;
    try {
      const rel = Math.max(0.02, this.layer.ampEnv.release);
      const cur = this.envGain.gain.value;
      this.envGain.gain.cancelScheduledValues(now);
      this.envGain.gain.setValueAtTime(cur, now);
      this.envGain.gain.linearRampToValueAtTime(0, now + rel);
      const fRel = Math.max(0.02, this.layer.filterEnv.release);
      const fCur = this.filter.detune.value;
      this.filter.detune.cancelScheduledValues(now);
      this.filter.detune.setValueAtTime(fCur, now);
      this.filter.detune.linearRampToValueAtTime(0, now + fRel);
      this.endTimeLocal = now + rel + 0.05;
    } catch {
      this.endTimeLocal = now;
    }
    return this.endTimeLocal;
  }

  /** Fast fade used for voice stealing and panic. */
  fastStop(now: number, fade = 0.03): number {
    this.releasedLocal = true;
    try {
      this.out.gain.cancelScheduledValues(now);
      this.out.gain.setValueAtTime(this.out.gain.value, now);
      this.out.gain.linearRampToValueAtTime(0, now + fade);
      this.endTimeLocal = now + fade + 0.02;
    } catch {
      this.endTimeLocal = now;
    }
    return this.endTimeLocal;
  }

  dispose(): void {
    try {
      for (const osc of [this.mainOsc, this.subOsc]) {
        try {
          this.shared.pitchBendSource.disconnect(osc.detune);
        } catch {
          /* already disconnected */
        }
        try {
          this.shared.ribbonSource.disconnect(osc.detune);
        } catch {
          /* already disconnected */
        }
        try {
          this.shared.pitchModBus.disconnect(osc.detune);
        } catch {
          /* already disconnected */
        }
        try {
          osc.stop();
        } catch {
          /* already stopped */
        }
        osc.disconnect();
      }
      if (this.pulseShaper) {
        try {
          this.shared.pwConst[this.layerIndex].disconnect(this.pulseShaper);
        } catch {
          /* already disconnected */
        }
        try {
          this.shared.pwModBus.disconnect(this.pulseShaper);
        } catch {
          /* already disconnected */
        }
        this.pulseShaper.disconnect();
      }
      try {
        this.shared.cutoffModBus.disconnect(this.filter.detune);
      } catch {
        /* already disconnected */
      }
      try {
        this.noiseSrc.stop();
      } catch {
        /* already stopped */
      }
      this.noiseSrc.disconnect();
      this.oscGain.disconnect();
      this.subGain.disconnect();
      this.noiseGain.disconnect();
      this.filter.disconnect();
      this.envGain.disconnect();
      this.out.disconnect();
    } catch {
      /* best-effort teardown */
    }
  }
}

let nextVoiceId = 1;

/** One musical voice: Layer I and Layer II sub-voices sharing a note
 *  identity and a single note-on/note-off lifecycle. */
export class Tx80Voice {
  readonly id: number;
  note: number;
  readonly velocity: number;
  active = true;
  private endTime = Infinity;
  private readonly subVoices: Tx80SubVoice[] = [];
  private readonly ctx: AudioContext;

  constructor(
    ctx: AudioContext,
    layerBuses: readonly [AudioNode, AudioNode],
    patch: Tx80Patch,
    note: number,
    velocity: number,
    shared: Tx80SharedNodes,
    travel: PitchTravel | null,
  ) {
    this.ctx = ctx;
    this.id = nextVoiceId++;
    this.note = note;
    this.velocity = velocity;
    for (const layerIndex of [0, 1] as const) {
      const layer = patch.layers[layerIndex];
      if (!layer.enabled) continue;
      this.subVoices.push(
        new Tx80SubVoice(
          ctx,
          layerBuses[layerIndex],
          layerIndex,
          layer,
          patch,
          note,
          velocity,
          shared,
          travel,
        ),
      );
    }
  }

  hasLayers(): boolean {
    return this.subVoices.length > 0;
  }

  retune(note: number, travel: PitchTravel | null): void {
    this.note = note;
    for (const sub of this.subVoices) sub.retune(note, travel);
  }

  forEachSub(layerIndex: 0 | 1, fn: (sub: Tx80SubVoice) => void): void {
    for (const sub of this.subVoices) {
      if (sub.layerIndex === layerIndex) fn(sub);
    }
  }

  release(): void {
    if (!this.active) return;
    this.active = false;
    const now = this.ctx.currentTime;
    let end = now;
    for (const sub of this.subVoices) end = Math.max(end, sub.release(now));
    this.endTime = end;
  }

  /** Immediate fade — voice stealing and panic. */
  stop(fade = 0.03): void {
    this.active = false;
    const now = this.ctx.currentTime;
    let end = now;
    for (const sub of this.subVoices) end = Math.max(end, sub.fastStop(now, fade));
    this.endTime = end;
  }

  isDone(now: number): boolean {
    return !this.active && now >= this.endTime;
  }

  dispose(): void {
    for (const sub of this.subVoices) sub.dispose();
  }
}
