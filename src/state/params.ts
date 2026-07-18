/**
 * TXPPS TX-80 — Authoritative parameter registry.
 *
 * Every visible control on the panel binds to a ParamDef here. Ranges, defaults,
 * units, and preset serialization live in this file only. UI components read
 * ParamDefs to render their labels/ranges; the audio engine reads ParamDefs
 * (or their derived paths) to route values to nodes.
 *
 * This file is the single source of truth referenced by:
 *   - state/store.ts (initial patch state)
 *   - state/presets.ts (serialization)
 *   - audio/engine.ts (routing)
 *   - components/* (UI ranges & display)
 *
 * See PARAMETER_MATRIX.md for the human-readable table.
 */

export type ParamScope = "global" | "layerI" | "layerII" | "mod" | "fx" | "perf";
export type ParamType = "float" | "int" | "enum" | "bool";
export type SmoothingMode = "instant" | "audio-rate" | "control-rate";

export interface ParamDef<T = number | string | boolean> {
  id: string;
  scope: ParamScope;
  label: string;
  type: ParamType;
  min?: number;
  max?: number;
  step?: number;
  values?: readonly string[]; // for enums
  default: T;
  unit?: string;
  smoothing?: SmoothingMode;
  /** Whether this param is written to preset JSON. */
  serialize: boolean;
  /** Engine destination hint — engine may map further. */
  destination?: string;
}

const OSC_WAVES = ["saw", "square", "pulse", "triangle", "sine"] as const;
const FILT_TYPES = ["lp24", "lp12", "bp", "hp"] as const;
const LFO_WAVES = ["sine", "triangle", "square", "saw", "s&h"] as const;
const LFO_DESTS = [
  "off",
  "pitch",
  "pw",
  "cutoff",
  "amp",
  "pan",
  "layerBalance",
] as const;
const RIBBON_MODES = ["continuous", "glissando", "trigger", "hold"] as const;

// Helper factory
const p = <T extends number | string | boolean>(def: ParamDef<T>): ParamDef<T> => def;

// -------- Layer parameter template (applied to both layers) --------
function layerParams(scope: "layerI" | "layerII"): ParamDef[] {
  const px = (id: string, extra: Omit<ParamDef, "id" | "scope">): ParamDef =>
    ({ id: `${scope}.${id}`, scope, ...extra }) as ParamDef;
  return [
    // Oscillator
    px("osc.wave", { label: "Wave", type: "enum", values: OSC_WAVES, default: "saw", serialize: true, destination: "osc.type" }),
    px("osc.octave", { label: "Octave", type: "int", min: -2, max: 2, step: 1, default: 0, unit: "oct", serialize: true }),
    px("osc.tune", { label: "Tune", type: "float", min: -12, max: 12, step: 0.01, default: scope === "layerII" ? -0.05 : 0, unit: "st", serialize: true, smoothing: "control-rate" }),
    px("osc.fine", { label: "Fine", type: "float", min: -50, max: 50, step: 1, default: 0, unit: "ct", serialize: true }),
    px("osc.pw", { label: "PW", type: "float", min: 0.05, max: 0.95, step: 0.001, default: 0.5, serialize: true, smoothing: "audio-rate" }),
    px("osc.pwm", { label: "PWM", type: "float", min: 0, max: 1, step: 0.001, default: 0, serialize: true }),

    // Sub & noise
    px("sub.level", { label: "Sub", type: "float", min: 0, max: 1, step: 0.001, default: 0, serialize: true }),
    px("noise.level", { label: "Noise", type: "float", min: 0, max: 1, step: 0.001, default: 0, serialize: true }),

    // Mixer
    px("mix.osc", { label: "Osc Lvl", type: "float", min: 0, max: 1, step: 0.001, default: 0.85, serialize: true }),

    // Filter
    px("filt.type", { label: "Filter", type: "enum", values: FILT_TYPES, default: "lp24", serialize: true }),
    px("filt.cutoff", { label: "Cutoff", type: "float", min: 20, max: 18000, step: 1, default: 2200, unit: "Hz", serialize: true, smoothing: "audio-rate" }),
    px("filt.reso", { label: "Reso", type: "float", min: 0, max: 1, step: 0.001, default: 0.15, serialize: true }),
    px("filt.kbd", { label: "Key Trk", type: "float", min: 0, max: 1, step: 0.001, default: 0.4, serialize: true }),
    px("filt.envAmt", { label: "Env Amt", type: "float", min: -1, max: 1, step: 0.001, default: 0.35, serialize: true }),
    px("filt.drive", { label: "Drive", type: "float", min: 0, max: 1, step: 0.001, default: 0.1, serialize: true }),

    // Filter envelope
    px("env.f.a", { label: "F Atk", type: "float", min: 0, max: 4, step: 0.001, default: 0.005, unit: "s", serialize: true }),
    px("env.f.d", { label: "F Dec", type: "float", min: 0.001, max: 6, step: 0.001, default: 0.8, unit: "s", serialize: true }),
    px("env.f.s", { label: "F Sus", type: "float", min: 0, max: 1, step: 0.001, default: 0.3, serialize: true }),
    px("env.f.r", { label: "F Rel", type: "float", min: 0.001, max: 8, step: 0.001, default: 0.6, unit: "s", serialize: true }),

    // Amplifier envelope
    px("env.a.a", { label: "A Atk", type: "float", min: 0, max: 4, step: 0.001, default: 0.005, unit: "s", serialize: true }),
    px("env.a.d", { label: "A Dec", type: "float", min: 0.001, max: 6, step: 0.001, default: 0.4, unit: "s", serialize: true }),
    px("env.a.s", { label: "A Sus", type: "float", min: 0, max: 1, step: 0.001, default: 0.8, serialize: true }),
    px("env.a.r", { label: "A Rel", type: "float", min: 0.001, max: 8, step: 0.001, default: 0.35, unit: "s", serialize: true }),

    // Layer controls
    px("layer.on", { label: "Layer On", type: "bool", default: true, serialize: true }),
    px("layer.level", { label: "Level", type: "float", min: 0, max: 1, step: 0.001, default: scope === "layerII" ? 0.6 : 0.85, serialize: true }),
    px("layer.pan", { label: "Pan", type: "float", min: -1, max: 1, step: 0.001, default: scope === "layerII" ? 0.15 : -0.15, serialize: true }),
    px("layer.modAmt", { label: "Mod Amt", type: "float", min: 0, max: 1, step: 0.001, default: 0.25, serialize: true }),
  ];
}

// -------- Mod (LFO1/LFO2) --------
function lfoParams(idx: 1 | 2): ParamDef[] {
  const s: ParamScope = "mod";
  const px = (id: string, extra: Omit<ParamDef, "id" | "scope">): ParamDef =>
    ({ id: `mod.lfo${idx}.${id}`, scope: s, ...extra }) as ParamDef;
  return [
    px("wave", { label: "Wave", type: "enum", values: LFO_WAVES, default: "sine", serialize: true }),
    px("rate", { label: "Rate", type: "float", min: 0.02, max: 24, step: 0.01, default: idx === 1 ? 4.5 : 0.6, unit: "Hz", serialize: true, smoothing: "control-rate" }),
    px("depth", { label: "Depth", type: "float", min: 0, max: 1, step: 0.001, default: 0.2, serialize: true, smoothing: "control-rate" }),
    px("dest", { label: "Dest", type: "enum", values: LFO_DESTS, default: idx === 1 ? "pitch" : "cutoff", serialize: true }),
  ];
}

// -------- FX --------
const FX_PARAMS: ParamDef[] = [
  { id: "fx.chorus.on", scope: "fx", label: "Chorus", type: "bool", default: true, serialize: true },
  { id: "fx.chorus.rate", scope: "fx", label: "Rate", type: "float", min: 0.1, max: 6, step: 0.01, default: 0.6, unit: "Hz", serialize: true },
  { id: "fx.chorus.depth", scope: "fx", label: "Depth", type: "float", min: 0, max: 1, step: 0.001, default: 0.45, serialize: true },
  { id: "fx.chorus.mix", scope: "fx", label: "Mix", type: "float", min: 0, max: 1, step: 0.001, default: 0.35, serialize: true },

  { id: "fx.delay.on", scope: "fx", label: "Delay", type: "bool", default: false, serialize: true },
  { id: "fx.delay.time", scope: "fx", label: "Time", type: "float", min: 0.02, max: 1.5, step: 0.001, default: 0.32, unit: "s", serialize: true },
  { id: "fx.delay.fb", scope: "fx", label: "Feedback", type: "float", min: 0, max: 0.85, step: 0.001, default: 0.35, serialize: true },
  { id: "fx.delay.mix", scope: "fx", label: "Mix", type: "float", min: 0, max: 1, step: 0.001, default: 0.25, serialize: true },

  { id: "fx.reverb.on", scope: "fx", label: "Reverb", type: "bool", default: true, serialize: true },
  { id: "fx.reverb.size", scope: "fx", label: "Size", type: "float", min: 0.1, max: 1, step: 0.001, default: 0.55, serialize: true },
  { id: "fx.reverb.mix", scope: "fx", label: "Mix", type: "float", min: 0, max: 1, step: 0.001, default: 0.25, serialize: true },
];

// -------- Performance / global --------
const PERF_PARAMS: ParamDef[] = [
  { id: "porta.on", scope: "perf", label: "Portamento", type: "bool", default: false, serialize: true },
  { id: "porta.time", scope: "perf", label: "Glide", type: "float", min: 0.005, max: 3, step: 0.001, default: 0.12, unit: "s", serialize: true },
  { id: "gliss.on", scope: "perf", label: "Glissando", type: "bool", default: false, serialize: true },
  { id: "gliss.rate", scope: "perf", label: "Step", type: "float", min: 0.01, max: 0.6, step: 0.001, default: 0.06, unit: "s/st", serialize: true },
  { id: "ribbon.mode", scope: "perf", label: "Ribbon", type: "enum", values: RIBBON_MODES, default: "continuous", serialize: true },
  { id: "ribbon.range", scope: "perf", label: "Range", type: "float", min: 2, max: 24, step: 1, default: 12, unit: "st", serialize: true },
  { id: "master.tune", scope: "global", label: "Tune", type: "float", min: 415, max: 466, step: 0.1, default: 440, unit: "Hz", serialize: true },
  { id: "master.level", scope: "global", label: "Master", type: "float", min: 0, max: 1, step: 0.001, default: 0.75, serialize: true, smoothing: "control-rate" },
  { id: "master.polyphony", scope: "global", label: "Poly", type: "int", min: 4, max: 16, step: 1, default: 8, unit: "v", serialize: true },
];

export const PARAM_REGISTRY: readonly ParamDef[] = Object.freeze([
  ...layerParams("layerI"),
  ...layerParams("layerII"),
  ...lfoParams(1),
  ...lfoParams(2),
  ...FX_PARAMS,
  ...PERF_PARAMS,
]);

export const PARAM_BY_ID: ReadonlyMap<string, ParamDef> = new Map(
  PARAM_REGISTRY.map((d) => [d.id, d]),
);

export type PatchValues = Record<string, number | string | boolean>;

export function defaultPatch(): PatchValues {
  const out: PatchValues = {};
  for (const d of PARAM_REGISTRY) out[d.id] = d.default as never;
  return out;
}

export { OSC_WAVES, FILT_TYPES, LFO_WAVES, LFO_DESTS, RIBBON_MODES };
