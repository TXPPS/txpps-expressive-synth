/**
 * Parameter-ID mapping: UI registry (src/state/params.ts, the authoritative
 * product parameter source) → engine registry (synth-core/tx80/parameters.ts).
 *
 * The Zustand store and every panel keep speaking UI ids (`layerI.filt.cutoff`).
 * This layer translates them — ids, value vocabularies, units and ranges —
 * into engine ids (`l1.filter.cutoff`) for the donor engine. It is pure and
 * has no audio or React dependencies; Gate 2 wires it into useAudioEngine.
 *
 * Three entry kinds:
 *  - direct:   one UI id → one engine id (optional value transform)
 *  - derived:  several UI ids combine into one or more engine values
 *              (recomputed from the whole patch when any source id changes)
 *  - unmapped: intentionally not routed at Gate 1/2 — every entry carries a
 *              reason and a disposition gate. mapping.test.ts enforces that
 *              the three kinds exactly cover the UI registry.
 */

import type { ParameterValue } from "./runtime/contracts";
import type { PatchValues } from "@/state/params";

export interface DirectMapping {
  kind: "direct";
  engineId: string;
  /** Optional value translation (vocabulary/unit/range). */
  transform?: (value: ParameterValue) => ParameterValue;
}

export interface DerivedMapping {
  kind: "derived";
  /** UI ids that participate (for docs/tests); this entry's own id included. */
  sourceIds: readonly string[];
  /** Compute engine updates from the full UI patch. */
  compute: (patch: PatchValues) => Record<string, ParameterValue>;
}

export interface UnmappedEntry {
  kind: "unmapped";
  reason: string;
  /** Where the decision lands (implement in engine, drop from UI, …). */
  disposition: string;
}

export type ParamMapping = DirectMapping | DerivedMapping | UnmappedEntry;

const direct = (engineId: string, transform?: DirectMapping["transform"]): DirectMapping => ({
  kind: "direct",
  engineId,
  transform,
});

const unmapped = (reason: string, disposition: string): UnmappedEntry => ({
  kind: "unmapped",
  reason,
  disposition,
});

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const num = (v: ParameterValue): number => (typeof v === "number" ? v : Number(v));

/** UI wave vocabulary → engine vocabulary ("square" plays as a full-width pulse). */
const mapWave = (v: ParameterValue): ParameterValue => (v === "square" ? "pulse" : v);

/** UI pw 0.05..0.95 → engine duty 0.05..0.5 (symmetric fold: 0.7 ≡ 0.3). */
const mapPw = (v: ParameterValue): ParameterValue => {
  const n = num(v);
  return clamp(n > 0.5 ? 1 - n : n, 0.05, 0.5);
};

/** UI LFO destination vocabulary → engine vocabulary. */
const mapLfoDest = (v: ParameterValue): ParameterValue => {
  switch (v) {
    case "cutoff":
      return "filter";
    case "layerBalance":
      return "balance";
    default:
      return v; // off | pitch | pw | amp | pan
  }
};

/** UI LFO wave: engine has no "s&h"; square is the closest stepped shape. */
const mapLfoWave = (v: ParameterValue): ParameterValue => (v === "s&h" ? "square" : v);

/** UI ribbon mode vocabulary → engine vocabulary. "trigger" pending Gate 7. */
const mapRibbonMode = (v: ParameterValue): ParameterValue => {
  switch (v) {
    case "continuous":
      return "pitch";
    case "glissando":
      return "gliss";
    case "hold":
      return "hold";
    default:
      return "pitch"; // "trigger" falls back to the safe default until Gate 7
  }
};

/** Snap a numeric value to the nearest entry of an engine choice list. */
const nearestChoice =
  (choices: readonly number[]) =>
  (v: ParameterValue): ParameterValue => {
    const n = num(v);
    return choices.reduce(
      (best, c) => (Math.abs(c - n) < Math.abs(best - n) ? c : best),
      choices[0],
    );
  };

/** One layer's mappings (UI scope `layerI`/`layerII` → engine prefix l1/l2). */
function layerMappings(
  uiScope: "layerI" | "layerII",
  enginePrefix: "l1" | "l2",
): Record<string, ParamMapping> {
  const e = enginePrefix;
  return {
    [`${uiScope}.osc.wave`]: direct(`${e}.wave`, mapWave),
    [`${uiScope}.osc.octave`]: direct(`${e}.octave`),
    // UI tune is float ±12 st; engine coarse is integer ±7 st. Values are
    // rounded+clamped by the engine registry; fractional/wide tuning is a
    // Gate 6 decision (widen engine coarse or split into coarse+fine).
    [`${uiScope}.osc.tune`]: direct(`${e}.coarse`, (v) => clamp(Math.round(num(v)), -7, 7)),
    [`${uiScope}.osc.fine`]: direct(`${e}.fine`),
    [`${uiScope}.osc.pw`]: direct(`${e}.pw`, mapPw),
    [`${uiScope}.osc.pwm`]: unmapped(
      "engine models PW motion via LFO→pw destination, not a per-layer pwm depth",
      "Gate 6: map onto LFO routing or remove the knob",
    ),
    [`${uiScope}.sub.level`]: direct(`${e}.subLevel`),
    [`${uiScope}.noise.level`]: direct(`${e}.noiseLevel`),
    [`${uiScope}.mix.osc`]: direct(`${e}.oscLevel`),
    [`${uiScope}.filt.type`]: unmapped(
      "engine filter is lowpass-only (lp24/lp12/bp/hp selector has no engine destination yet)",
      "Gate 6: extend engine filter types or reduce the selector",
    ),
    [`${uiScope}.filt.cutoff`]: direct(`${e}.filter.cutoff`, (v) => clamp(num(v), 30, 16000)),
    [`${uiScope}.filt.reso`]: direct(`${e}.filter.resonance`),
    [`${uiScope}.filt.kbd`]: direct(`${e}.filter.keyTracking`),
    [`${uiScope}.filt.envAmt`]: direct(`${e}.filter.envAmount`),
    [`${uiScope}.filt.drive`]: unmapped(
      "engine has no per-layer drive/saturation stage",
      "Gate 6: add a drive stage or remove the knob",
    ),
    [`${uiScope}.env.f.a`]: direct(`${e}.fenv.attack`, (v) => clamp(num(v), 0.001, 8)),
    [`${uiScope}.env.f.d`]: direct(`${e}.fenv.decay`, (v) => clamp(num(v), 0.001, 8)),
    [`${uiScope}.env.f.s`]: direct(`${e}.fenv.sustain`),
    [`${uiScope}.env.f.r`]: direct(`${e}.fenv.release`, (v) => clamp(num(v), 0.01, 10)),
    [`${uiScope}.env.a.a`]: direct(`${e}.aenv.attack`, (v) => clamp(num(v), 0.001, 8)),
    [`${uiScope}.env.a.d`]: direct(`${e}.aenv.decay`, (v) => clamp(num(v), 0.001, 8)),
    [`${uiScope}.env.a.s`]: direct(`${e}.aenv.sustain`),
    [`${uiScope}.env.a.r`]: direct(`${e}.aenv.release`, (v) => clamp(num(v), 0.01, 10)),
    [`${uiScope}.layer.on`]: direct(`${e}.enabled`),
    [`${uiScope}.layer.level`]: direct(`${e}.level`),
    [`${uiScope}.layer.pan`]: direct(`${e}.pan`),
    [`${uiScope}.layer.modAmt`]: unmapped(
      "engine LFO depth is global per LFO; no per-layer modulation depth exists",
      "Gate 6: add per-layer depth scaling in the engine or remove the knob",
    ),
  };
}

function lfoMappings(idx: 1 | 2, engineLfo: "lfoA" | "lfoB"): Record<string, ParamMapping> {
  const ui = `mod.lfo${idx}`;
  return {
    [`${ui}.wave`]: direct(`${engineLfo}.wave`, mapLfoWave),
    [`${ui}.rate`]: direct(`${engineLfo}.rate`, (v) => clamp(num(v), 0.05, 12)),
    [`${ui}.depth`]: direct(`${engineLfo}.depth`),
    [`${ui}.dest`]: direct(`${engineLfo}.dest`, mapLfoDest),
  };
}

/** Pitch-travel derivation: two UI switches + two time params collapse into
 *  the engine's single mode+time pair. Glissando wins when both are on
 *  (its audible steps are the more explicit request). */
const travelCompute = (patch: PatchValues): Record<string, ParameterValue> => {
  const glissOn = patch["gliss.on"] === true;
  const portaOn = patch["porta.on"] === true;
  const mode = glissOn ? "gliss" : portaOn ? "porta" : "off";
  // Engine time is seconds-per-octave (0..1). UI porta.time is an absolute
  // glide time (s); UI gliss.rate is seconds-per-semitone.
  const time = glissOn
    ? clamp(num(patch["gliss.rate"] ?? 0.06) * 12, 0, 1)
    : clamp(num(patch["porta.time"] ?? 0.12), 0, 1);
  return { "pitch.mode": mode, "pitch.time": time };
};

const TRAVEL_SOURCES = ["porta.on", "porta.time", "gliss.on", "gliss.rate"] as const;
const travelDerived: DerivedMapping = {
  kind: "derived",
  sourceIds: TRAVEL_SOURCES,
  compute: travelCompute,
};

/**
 * The complete mapping table. mapping.test.ts asserts it covers the UI
 * registry exactly and that every engine id / produced value is valid
 * against the engine registry.
 */
export const PARAM_MAP: Record<string, ParamMapping> = {
  ...layerMappings("layerI", "l1"),
  ...layerMappings("layerII", "l2"),
  ...lfoMappings(1, "lfoA"),
  ...lfoMappings(2, "lfoB"),

  "fx.chorus.on": direct("fx.chorus.enabled"),
  "fx.chorus.rate": direct("fx.chorus.rate", (v) => clamp(num(v), 0.05, 8)),
  // UI chorus depth is normalized 0..1; engine depth is delay-mod seconds 0..0.01.
  "fx.chorus.depth": direct("fx.chorus.depth", (v) => clamp(num(v), 0, 1) * 0.01),
  "fx.chorus.mix": direct("fx.chorus.amount"),
  "fx.delay.on": direct("fx.delay.enabled"),
  "fx.delay.time": direct("fx.delay.time", (v) => clamp(num(v), 0.02, 1.2)),
  "fx.delay.fb": direct("fx.delay.feedback"),
  "fx.delay.mix": direct("fx.delay.mix"),
  "fx.reverb.on": direct("fx.reverb.enabled"),
  "fx.reverb.size": direct("fx.reverb.size"),
  "fx.reverb.mix": direct("fx.reverb.mix"),

  "porta.on": travelDerived,
  "porta.time": travelDerived,
  "gliss.on": travelDerived,
  "gliss.rate": travelDerived,
  "ribbon.mode": direct("ribbon.mode", mapRibbonMode),
  "ribbon.range": direct("ribbon.range", nearestChoice([2, 5, 7, 12, 24])),
  "master.tune": direct("master.tune", (v) => clamp(num(v), 415, 466)),
  "master.level": direct("master.volume"),
  "master.polyphony": direct("voice.polyphony", nearestChoice([4, 8, 12, 16])),
};

/** Engine ids intentionally driven by engine defaults until a later gate
 *  exposes them in the UI registry (documented for Gate 6). */
export const ENGINE_ONLY_IDS: readonly string[] = [
  "voice.mode",
  "velocity.sensitivity",
  "master.balance",
  "fx.reverb.type",
  "fx.reverb.decay",
  "fx.reverb.preDelay",
  "fx.reverb.damping",
  "fx.reverb.width",
];

/** Translate one UI parameter change into engine updates (empty when the
 *  parameter is unmapped). Derived entries recompute from the whole patch. */
export function mapUiParamToEngine(
  uiId: string,
  value: ParameterValue,
  patch: PatchValues,
): Record<string, ParameterValue> {
  const entry = PARAM_MAP[uiId];
  if (!entry || entry.kind === "unmapped") return {};
  if (entry.kind === "direct") {
    return { [entry.engineId]: entry.transform ? entry.transform(value) : value };
  }
  // Derived: recompute from the patch with the new value applied.
  return entry.compute({ ...patch, [uiId]: value });
}

/** Translate a full UI patch into the complete set of engine updates. */
export function mapPatchToEngine(patch: PatchValues): Record<string, ParameterValue> {
  const out: Record<string, ParameterValue> = {};
  const derivedDone = new Set<DerivedMapping>();
  for (const [uiId, entry] of Object.entries(PARAM_MAP)) {
    if (entry.kind === "unmapped") continue;
    if (entry.kind === "direct") {
      const value = patch[uiId];
      if (value === undefined) continue;
      out[entry.engineId] = entry.transform ? entry.transform(value) : value;
      continue;
    }
    if (derivedDone.has(entry)) continue;
    derivedDone.add(entry);
    Object.assign(out, entry.compute(patch));
  }
  return out;
}
