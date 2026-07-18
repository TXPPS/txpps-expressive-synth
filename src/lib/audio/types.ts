export interface OperatorParams {
  ratio: number;
  detune: number; // cents
  level: number; // 0..1
  attack: number; // seconds
  decay: number;
  sustain: number; // 0..1
  release: number;
  enabled: boolean;
}

export interface ReverbParams {
  enabled: boolean;
  type: "digital" | "hall" | "glass";
  mix: number;
  size: number;
  decay: number;
  preDelay: number;
  damping: number;
  width: number;
}

export interface ChorusParams {
  enabled: boolean;
  amount: number;
  rate: number;
  depth: number;
}

export interface DelayParams {
  enabled: boolean;
  time: number;
  feedback: number;
  mix: number;
}

export interface FilterParams {
  cutoff: number; // Hz
  resonance: number;
}

/** Portamento behavior.
 *  - "off":  notes start exactly at pitch; the GLIDE knob has no effect.
 *  - "poly": every new note glides from the last played pitch (per-voice
 *            portamento, works in POLY and MONO voice modes).
 *  - "mono": classic mono legato — one voice; overlapping notes glide,
 *            detached notes start at pitch. */
export type GlideMode = "off" | "poly" | "mono";

export interface VintageParams {
  enabled: boolean;
  age: number; // 0..1
  warmth: number;
  grain: number;
  wear: number;
  drift: number;
  noise: number;
  stereoAge: number;
  drive: number;
}

export interface Patch {
  name: string;
  algorithm: number; // 1..6
  operators: OperatorParams[];
  fmDepth: number;
  feedback: number;
  velocitySens: number;
  voiceMode: "poly" | "mono";
  polyphony: 4 | 8 | 12;
  glide: number;
  /** Portamento mode. Older saved patches lack this field; normalizePatch
   *  derives it from voiceMode (mono patches glided, poly didn't) so every
   *  existing patch keeps its exact sound. */
  glideMode: GlideMode;
  /** LEGACY — kept so old exported patches round-trip, but no longer applied.
   *  Bend range is now a global performance setting (src/lib/settings.ts),
   *  not a per-patch value, so switching presets never changes wheel range. */
  pitchBendRangeSemitones: number;
  masterAttack: number;
  masterRelease: number;
  filter: FilterParams;
  chorus: ChorusParams;
  delay: DelayParams;
  reverb: ReverbParams;
  vintage: VintageParams;
  masterVolume: number;
}

export const DEFAULT_OP: OperatorParams = {
  ratio: 1,
  detune: 0,
  level: 0.8,
  attack: 0.01,
  decay: 0.4,
  sustain: 0.7,
  release: 0.3,
  enabled: true,
};

export const INIT_PATCH: Patch = {
  name: "INIT",
  algorithm: 1,
  operators: [
    { ...DEFAULT_OP, level: 0.9 },
    { ...DEFAULT_OP, ratio: 2, level: 0.6 },
    { ...DEFAULT_OP, ratio: 1, level: 0.5 },
    { ...DEFAULT_OP, ratio: 3, level: 0.4 },
  ],
  fmDepth: 0.6,
  feedback: 0.15,
  velocitySens: 0.5,
  voiceMode: "poly",
  polyphony: 8,
  glide: 0.05,
  glideMode: "off",
  pitchBendRangeSemitones: 2,
  masterAttack: 0,
  masterRelease: 0,
  filter: { cutoff: 12000, resonance: 0.4 },
  chorus: { enabled: false, amount: 0.4, rate: 0.6, depth: 0.003 },
  delay: { enabled: false, time: 0.32, feedback: 0.35, mix: 0.25 },
  reverb: {
    enabled: true,
    type: "hall",
    mix: 0.28,
    size: 0.6,
    decay: 0.6,
    preDelay: 0.02,
    damping: 0.5,
    width: 0.9,
  },
  vintage: {
    // Vintage Circuit defaults OFF for INIT and factory presets; presets
    // that want it must set enabled: true explicitly.
    enabled: false,
    age: 0.35,
    warmth: 0.5,
    grain: 0.3,
    wear: 0.3,
    drift: 0.3,
    noise: 0.25,
    stereoAge: 0.3,
    drive: 0.4,
  },
  masterVolume: 0.7,
};

/** Clamp a pitch bend range value to a valid integer between 1 and 12. */
export function clampBendRange(v: unknown): number {
  const n = Math.round(typeof v === "number" && Number.isFinite(v) ? v : 2);
  return Math.max(1, Math.min(12, n));
}

/** Coerce one saved operator into a well-formed, independently-owned object.
 *  Uses nullish coalescing so valid zero values (level 0, detune 0, sustain 0)
 *  are preserved exactly — never `||`. Non-finite numbers fall back. */
function normalizeOperator(raw: unknown): OperatorParams {
  const o = (raw ?? {}) as Partial<OperatorParams>;
  const num = (v: unknown, d: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : d;
  return {
    ratio: num(o.ratio, DEFAULT_OP.ratio),
    detune: num(o.detune, DEFAULT_OP.detune),
    level: num(o.level, DEFAULT_OP.level),
    attack: num(o.attack, DEFAULT_OP.attack),
    decay: num(o.decay, DEFAULT_OP.decay),
    sustain: num(o.sustain, DEFAULT_OP.sustain),
    release: num(o.release, DEFAULT_OP.release),
    enabled: typeof o.enabled === "boolean" ? o.enabled : DEFAULT_OP.enabled,
  };
}

/** Fill in defaults for fields added after a patch was saved, and clamp
 *  out-of-range values. Safe to call on any parsed patch object.
 *  Operators are rebuilt as exactly four independent objects (no shared
 *  references, malformed/partial data tolerated); every value present in the
 *  saved patch is preserved verbatim, so existing patches keep their sound. */
export function normalizePatch(p: Patch): Patch {
  const rawOps = Array.isArray((p as Partial<Patch>).operators)
    ? (p as Patch).operators
    : [];
  const operators = Array.from({ length: 4 }, (_, i) =>
    normalizeOperator(rawOps[i]),
  );
  const rawGlideMode = (p as Partial<Patch>).glideMode;
  const glideMode: GlideMode =
    rawGlideMode === "off" || rawGlideMode === "poly" || rawGlideMode === "mono"
      ? rawGlideMode
      : (p as Partial<Patch>).voiceMode === "mono"
        ? "mono" // legacy mono patches always glided legato
        : "off"; // legacy poly patches never glided
  return {
    ...p,
    operators,
    glideMode,
    pitchBendRangeSemitones: clampBendRange(
      (p as Partial<Patch>).pitchBendRangeSemitones ?? 2,
    ),
  };
}
