import type { ChorusParams, DelayParams, ReverbParams } from "../audio/types";

/** TXPPS TX-80 — dual-layer expressive polysynth state model.
 *
 *  TX-80 is an original TXPPS instrument inspired by the performance
 *  philosophy of expressive vintage polyphonic synthesizers. It shares the
 *  product-neutral SynthEngine boundary with TX27 but owns its own patch
 *  shape, parameter registry, presets and DSP.
 */

export type Tx80Waveform = "saw" | "pulse" | "triangle" | "sine";

/** How new pitches travel to their target.
 *  - "off":   notes start exactly at pitch.
 *  - "porta": PORTAMENTO — smooth continuous glide, exact target arrival.
 *  - "gliss": GLISSANDO — discrete chromatic semitone steps, exact arrival. */
export type PitchTravelMode = "off" | "porta" | "gliss";

/** Ribbon behavior.
 *  - "pitch": continuous bend relative to first touch; springs back to
 *             center on release (safe default).
 *  - "gliss": quantized semitone steps; springs back on release.
 *  - "hold":  continuous bend that HOLDS its last value on release
 *             (panic / preset change recentres it). */
export type RibbonMode = "pitch" | "gliss" | "hold";

export type LfoWave = "sine" | "triangle" | "square" | "saw";

/** Modulation destinations. "balance" tilts the Layer I / Layer II mix. */
export type LfoDestination = "off" | "pitch" | "filter" | "amp" | "pw" | "pan" | "balance";

export interface Tx80Envelope {
  attack: number; // seconds
  decay: number; // seconds
  sustain: number; // 0..1
  release: number; // seconds
}

export interface Tx80LayerFilter {
  cutoff: number; // Hz
  resonance: number; // 0..1
  envAmount: number; // -1..1 (bipolar, cents under the hood)
  keyTracking: number; // 0..1
}

export interface Tx80Layer {
  enabled: boolean;
  level: number; // 0..1
  pan: number; // -1..1
  octave: number; // -2..2 (integer octaves)
  coarse: number; // -7..7 semitones (integer)
  fine: number; // -50..50 cents
  wave: Tx80Waveform;
  pulseWidth: number; // 0.05..0.5 duty cycle (pulse wave only)
  oscLevel: number; // 0..1
  subLevel: number; // 0..1 — square sub oscillator one octave down
  noiseLevel: number; // 0..1
  filter: Tx80LayerFilter;
  filterEnv: Tx80Envelope;
  ampEnv: Tx80Envelope;
}

export interface Tx80Lfo {
  wave: LfoWave;
  rate: number; // Hz
  depth: number; // 0..1
  destination: LfoDestination;
}

export interface Tx80Patch {
  name: string;
  layers: [Tx80Layer, Tx80Layer]; // [Layer I, Layer II]
  voiceMode: "poly" | "solo";
  polyphony: 4 | 8 | 12 | 16;
  velocitySens: number; // 0..1
  pitchTravel: { mode: PitchTravelMode; time: number }; // time = seconds per octave
  ribbon: { mode: RibbonMode; range: number }; // range in ± semitones
  lfoA: Tx80Lfo;
  lfoB: Tx80Lfo;
  chorus: ChorusParams;
  delay: DelayParams;
  reverb: ReverbParams;
  master: { volume: number; balance: number }; // balance -1 (I) .. +1 (II)
}

export const TX80_DEFAULT_ENV: Tx80Envelope = {
  attack: 0.01,
  decay: 0.3,
  sustain: 0.7,
  release: 0.4,
};

export const TX80_DEFAULT_LAYER: Tx80Layer = {
  enabled: true,
  level: 0.8,
  pan: 0,
  octave: 0,
  coarse: 0,
  fine: 0,
  wave: "saw",
  pulseWidth: 0.5,
  oscLevel: 0.8,
  subLevel: 0,
  noiseLevel: 0,
  filter: { cutoff: 9000, resonance: 0.15, envAmount: 0.25, keyTracking: 0.5 },
  filterEnv: { attack: 0.005, decay: 0.35, sustain: 0.4, release: 0.4 },
  ampEnv: { ...TX80_DEFAULT_ENV },
};

export const TX80_INIT_PATCH: Tx80Patch = {
  name: "INIT",
  layers: [
    {
      ...TX80_DEFAULT_LAYER,
      filter: { ...TX80_DEFAULT_LAYER.filter },
      filterEnv: { ...TX80_DEFAULT_LAYER.filterEnv },
      ampEnv: { ...TX80_DEFAULT_LAYER.ampEnv },
    },
    {
      ...TX80_DEFAULT_LAYER,
      enabled: false,
      level: 0.6,
      fine: 6,
      filter: { ...TX80_DEFAULT_LAYER.filter },
      filterEnv: { ...TX80_DEFAULT_LAYER.filterEnv },
      ampEnv: { ...TX80_DEFAULT_LAYER.ampEnv },
    },
  ],
  voiceMode: "poly",
  polyphony: 8,
  velocitySens: 0.5,
  pitchTravel: { mode: "off", time: 0.12 },
  ribbon: { mode: "pitch", range: 2 },
  lfoA: { wave: "sine", rate: 5, depth: 0, destination: "pitch" },
  lfoB: { wave: "triangle", rate: 0.4, depth: 0, destination: "filter" },
  chorus: { enabled: false, amount: 0.4, rate: 0.6, depth: 0.003 },
  delay: { enabled: false, time: 0.32, feedback: 0.35, mix: 0.25 },
  reverb: {
    enabled: true,
    type: "hall",
    mix: 0.22,
    size: 0.6,
    decay: 0.55,
    preDelay: 0.02,
    damping: 0.5,
    width: 0.9,
  },
  master: { volume: 0.7, balance: 0 },
};

// ── Normalization ───────────────────────────────────────────────────────────
// Saved patches from any earlier schema (or hand-edited imports) are coerced
// into a complete, well-formed, independently-owned Tx80Patch. Valid zero
// values are preserved exactly (nullish/finite checks, never `||`).

const num = (v: unknown, d: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : d;
const bool = (v: unknown, d: boolean): boolean => (typeof v === "boolean" ? v : d);
const pick = <T extends string | number>(v: unknown, choices: readonly T[], d: T): T =>
  choices.includes(v as T) ? (v as T) : d;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function normalizeEnvelope(raw: unknown, d: Tx80Envelope): Tx80Envelope {
  const e = (raw ?? {}) as Partial<Tx80Envelope>;
  return {
    attack: clamp(num(e.attack, d.attack), 0.001, 8),
    decay: clamp(num(e.decay, d.decay), 0.001, 8),
    sustain: clamp(num(e.sustain, d.sustain), 0, 1),
    release: clamp(num(e.release, d.release), 0.01, 10),
  };
}

function normalizeLayer(raw: unknown, d: Tx80Layer): Tx80Layer {
  const l = (raw ?? {}) as Partial<Tx80Layer>;
  const f = (l.filter ?? {}) as Partial<Tx80LayerFilter>;
  return {
    enabled: bool(l.enabled, d.enabled),
    level: clamp(num(l.level, d.level), 0, 1),
    pan: clamp(num(l.pan, d.pan), -1, 1),
    octave: clamp(Math.round(num(l.octave, d.octave)), -2, 2),
    coarse: clamp(Math.round(num(l.coarse, d.coarse)), -7, 7),
    fine: clamp(num(l.fine, d.fine), -50, 50),
    wave: pick<Tx80Waveform>(l.wave, ["saw", "pulse", "triangle", "sine"], d.wave),
    pulseWidth: clamp(num(l.pulseWidth, d.pulseWidth), 0.05, 0.5),
    oscLevel: clamp(num(l.oscLevel, d.oscLevel), 0, 1),
    subLevel: clamp(num(l.subLevel, d.subLevel), 0, 1),
    noiseLevel: clamp(num(l.noiseLevel, d.noiseLevel), 0, 1),
    filter: {
      cutoff: clamp(num(f.cutoff, d.filter.cutoff), 30, 16000),
      resonance: clamp(num(f.resonance, d.filter.resonance), 0, 1),
      envAmount: clamp(num(f.envAmount, d.filter.envAmount), -1, 1),
      keyTracking: clamp(num(f.keyTracking, d.filter.keyTracking), 0, 1),
    },
    filterEnv: normalizeEnvelope(l.filterEnv, d.filterEnv),
    ampEnv: normalizeEnvelope(l.ampEnv, d.ampEnv),
  };
}

function normalizeLfo(raw: unknown, d: Tx80Lfo): Tx80Lfo {
  const l = (raw ?? {}) as Partial<Tx80Lfo>;
  return {
    wave: pick<LfoWave>(l.wave, ["sine", "triangle", "square", "saw"], d.wave),
    rate: clamp(num(l.rate, d.rate), 0.05, 12),
    depth: clamp(num(l.depth, d.depth), 0, 1),
    destination: pick<LfoDestination>(
      l.destination,
      ["off", "pitch", "filter", "amp", "pw", "pan", "balance"],
      d.destination,
    ),
  };
}

/** Coerce any parsed object into a complete, valid Tx80Patch. Every value
 *  present and valid in the input is preserved verbatim; everything else
 *  falls back to INIT defaults. Safe on malformed/partial data. */
export function normalizeTx80Patch(raw: unknown): Tx80Patch {
  const p = (raw ?? {}) as Partial<Tx80Patch>;
  const d = TX80_INIT_PATCH;
  const rawLayers = Array.isArray(p.layers) ? p.layers : [];
  const travel = (p.pitchTravel ?? {}) as Partial<Tx80Patch["pitchTravel"]>;
  const ribbon = (p.ribbon ?? {}) as Partial<Tx80Patch["ribbon"]>;
  const chorus = (p.chorus ?? {}) as Partial<ChorusParams>;
  const delay = (p.delay ?? {}) as Partial<DelayParams>;
  const reverb = (p.reverb ?? {}) as Partial<ReverbParams>;
  const master = (p.master ?? {}) as Partial<Tx80Patch["master"]>;
  return {
    name: typeof p.name === "string" && p.name.trim() ? p.name : d.name,
    layers: [normalizeLayer(rawLayers[0], d.layers[0]), normalizeLayer(rawLayers[1], d.layers[1])],
    voiceMode: pick(p.voiceMode, ["poly", "solo"] as const, d.voiceMode),
    polyphony: pick(p.polyphony, [4, 8, 12, 16] as const, d.polyphony),
    velocitySens: clamp(num(p.velocitySens, d.velocitySens), 0, 1),
    pitchTravel: {
      mode: pick<PitchTravelMode>(travel.mode, ["off", "porta", "gliss"], d.pitchTravel.mode),
      time: clamp(num(travel.time, d.pitchTravel.time), 0, 1),
    },
    ribbon: {
      mode: pick<RibbonMode>(ribbon.mode, ["pitch", "gliss", "hold"], d.ribbon.mode),
      range: pick(ribbon.range, [2, 5, 7, 12, 24] as const, d.ribbon.range as 2),
    },
    lfoA: normalizeLfo(p.lfoA, d.lfoA),
    lfoB: normalizeLfo(p.lfoB, d.lfoB),
    chorus: {
      enabled: bool(chorus.enabled, d.chorus.enabled),
      amount: clamp(num(chorus.amount, d.chorus.amount), 0, 1),
      rate: clamp(num(chorus.rate, d.chorus.rate), 0.05, 8),
      depth: clamp(num(chorus.depth, d.chorus.depth), 0, 0.01),
    },
    delay: {
      enabled: bool(delay.enabled, d.delay.enabled),
      time: clamp(num(delay.time, d.delay.time), 0.02, 1.2),
      feedback: clamp(num(delay.feedback, d.delay.feedback), 0, 0.85),
      mix: clamp(num(delay.mix, d.delay.mix), 0, 1),
    },
    reverb: {
      enabled: bool(reverb.enabled, d.reverb.enabled),
      type: pick(reverb.type, ["digital", "hall", "glass"] as const, d.reverb.type),
      mix: clamp(num(reverb.mix, d.reverb.mix), 0, 1),
      size: clamp(num(reverb.size, d.reverb.size), 0, 1),
      decay: clamp(num(reverb.decay, d.reverb.decay), 0, 1),
      preDelay: clamp(num(reverb.preDelay, d.reverb.preDelay), 0, 0.2),
      damping: clamp(num(reverb.damping, d.reverb.damping), 0, 1),
      width: clamp(num(reverb.width, d.reverb.width), 0, 1),
    },
    master: {
      volume: clamp(num(master.volume, d.master.volume), 0, 1),
      balance: clamp(num(master.balance, d.master.balance), -1, 1),
    },
  };
}

/** Deep clone + normalize. The only sanctioned way to copy a patch. */
export function cloneTx80Patch(p: Tx80Patch): Tx80Patch {
  return normalizeTx80Patch(JSON.parse(JSON.stringify(p)));
}
