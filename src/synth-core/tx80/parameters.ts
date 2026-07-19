import type { ParameterDefinition, ParameterValue } from "../runtime/contracts";
import { cloneTx80Patch, type Tx80Patch } from "./types";

/** TX-80 authoritative parameter registry.
 *
 *  Every visible control binds to exactly one entry here; ranges, defaults,
 *  steps and choices live ONLY in this file. `smoothing` documents how the
 *  engine applies continuous changes; `serialized` marks preset membership
 *  (all TX-80 parameters are part of the patch — performance state such as
 *  pitch bend, ribbon position and held notes is deliberately NOT here). */
interface Tx80ParameterDefinition extends ParameterDefinition {
  /** Product-owned path into Tx80Patch. Not part of the reusable contract. */
  path: string;
  /** How the engine smooths live changes ("none" = discrete/stepped). */
  smoothing: "none" | "fast" | "medium";
  /** Included in preset serialization (true for every patch parameter). */
  serialized: boolean;
}

type Cat =
  | "Layer I"
  | "Layer II"
  | "Voice"
  | "Performance"
  | "LFO A"
  | "LFO B"
  | "Chorus"
  | "Delay"
  | "Reverb"
  | "Master";

const numeric = (
  id: string,
  name: string,
  path: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
  step: number,
  category: Cat,
  unit?: string,
  smoothing: "none" | "fast" | "medium" = "fast",
): Tx80ParameterDefinition => ({
  id,
  name,
  path,
  defaultValue,
  minimum,
  maximum,
  step,
  category,
  unit,
  automatable: true,
  midiAssignable: true,
  smoothing,
  serialized: true,
});

const choice = (
  id: string,
  name: string,
  path: string,
  defaultValue: string | number,
  choices: readonly (string | number)[],
  category: Cat,
): Tx80ParameterDefinition => ({
  id,
  name,
  path,
  defaultValue,
  choices,
  category,
  automatable: true,
  midiAssignable: true,
  smoothing: "none",
  serialized: true,
});

const toggle = (
  id: string,
  name: string,
  path: string,
  defaultValue: boolean,
  category: Cat,
): Tx80ParameterDefinition => ({
  id,
  name,
  path,
  defaultValue,
  category,
  automatable: true,
  midiAssignable: true,
  smoothing: "none",
  serialized: true,
});

/** One full parameter block per layer. Layer I ids are `l1.*`, Layer II
 *  `l2.*`; paths index into `layers[0]` / `layers[1]`. The two layers are
 *  fully independent — no parameter is shared between them. */
const layerParameters = ([0, 1] as const).flatMap((index) => {
  const n = index + 1;
  const p = `layers.${index}`;
  const cat: Cat = index === 0 ? "Layer I" : "Layer II";
  const roman = index === 0 ? "I" : "II";
  return [
    toggle(`l${n}.enabled`, `Layer ${roman} Enabled`, `${p}.enabled`, index === 0, cat),
    numeric(
      `l${n}.level`,
      `Layer ${roman} Level`,
      `${p}.level`,
      index === 0 ? 0.8 : 0.6,
      0,
      1,
      0.001,
      cat,
    ),
    numeric(`l${n}.pan`, `Layer ${roman} Pan`, `${p}.pan`, 0, -1, 1, 0.001, cat),
    numeric(
      `l${n}.octave`,
      `Layer ${roman} Octave`,
      `${p}.octave`,
      0,
      -2,
      2,
      1,
      cat,
      "oct",
      "none",
    ),
    numeric(`l${n}.coarse`, `Layer ${roman} Coarse`, `${p}.coarse`, 0, -7, 7, 1, cat, "st", "none"),
    numeric(
      `l${n}.fine`,
      `Layer ${roman} Fine`,
      `${p}.fine`,
      index === 0 ? 0 : 6,
      -50,
      50,
      0.5,
      cat,
      "cent",
    ),
    choice(
      `l${n}.wave`,
      `Layer ${roman} Wave`,
      `${p}.wave`,
      "saw",
      ["saw", "pulse", "triangle", "sine"],
      cat,
    ),
    numeric(
      `l${n}.pw`,
      `Layer ${roman} Pulse Width`,
      `${p}.pulseWidth`,
      0.5,
      0.05,
      0.5,
      0.001,
      cat,
    ),
    numeric(`l${n}.oscLevel`, `Layer ${roman} Osc Level`, `${p}.oscLevel`, 0.8, 0, 1, 0.001, cat),
    numeric(`l${n}.subLevel`, `Layer ${roman} Sub Level`, `${p}.subLevel`, 0, 0, 1, 0.001, cat),
    numeric(
      `l${n}.noiseLevel`,
      `Layer ${roman} Noise Level`,
      `${p}.noiseLevel`,
      0,
      0,
      1,
      0.001,
      cat,
    ),
    numeric(
      `l${n}.filter.cutoff`,
      `Layer ${roman} Cutoff`,
      `${p}.filter.cutoff`,
      9000,
      30,
      16000,
      1,
      cat,
      "Hz",
    ),
    numeric(
      `l${n}.filter.resonance`,
      `Layer ${roman} Resonance`,
      `${p}.filter.resonance`,
      0.15,
      0,
      1,
      0.001,
      cat,
    ),
    numeric(
      `l${n}.filter.envAmount`,
      `Layer ${roman} Filter Env Amount`,
      `${p}.filter.envAmount`,
      0.25,
      -1,
      1,
      0.001,
      cat,
    ),
    numeric(
      `l${n}.filter.keyTracking`,
      `Layer ${roman} Key Tracking`,
      `${p}.filter.keyTracking`,
      0.5,
      0,
      1,
      0.001,
      cat,
    ),
    numeric(
      `l${n}.fenv.attack`,
      `Layer ${roman} Filter Attack`,
      `${p}.filterEnv.attack`,
      0.005,
      0.001,
      8,
      0.001,
      cat,
      "s",
      "none",
    ),
    numeric(
      `l${n}.fenv.decay`,
      `Layer ${roman} Filter Decay`,
      `${p}.filterEnv.decay`,
      0.35,
      0.001,
      8,
      0.001,
      cat,
      "s",
      "none",
    ),
    numeric(
      `l${n}.fenv.sustain`,
      `Layer ${roman} Filter Sustain`,
      `${p}.filterEnv.sustain`,
      0.4,
      0,
      1,
      0.001,
      cat,
      undefined,
      "none",
    ),
    numeric(
      `l${n}.fenv.release`,
      `Layer ${roman} Filter Release`,
      `${p}.filterEnv.release`,
      0.4,
      0.01,
      10,
      0.001,
      cat,
      "s",
      "none",
    ),
    numeric(
      `l${n}.aenv.attack`,
      `Layer ${roman} Amp Attack`,
      `${p}.ampEnv.attack`,
      0.01,
      0.001,
      8,
      0.001,
      cat,
      "s",
      "none",
    ),
    numeric(
      `l${n}.aenv.decay`,
      `Layer ${roman} Amp Decay`,
      `${p}.ampEnv.decay`,
      0.3,
      0.001,
      8,
      0.001,
      cat,
      "s",
      "none",
    ),
    numeric(
      `l${n}.aenv.sustain`,
      `Layer ${roman} Amp Sustain`,
      `${p}.ampEnv.sustain`,
      0.7,
      0,
      1,
      0.001,
      cat,
      undefined,
      "none",
    ),
    numeric(
      `l${n}.aenv.release`,
      `Layer ${roman} Amp Release`,
      `${p}.ampEnv.release`,
      0.4,
      0.01,
      10,
      0.001,
      cat,
      "s",
      "none",
    ),
  ];
});

const lfoParameters = (["A", "B"] as const).flatMap((which) => {
  const key = which === "A" ? "lfoA" : "lfoB";
  const cat: Cat = which === "A" ? "LFO A" : "LFO B";
  return [
    choice(
      `lfo${which}.wave`,
      `LFO ${which} Wave`,
      `${key}.wave`,
      which === "A" ? "sine" : "triangle",
      ["sine", "triangle", "square", "saw"],
      cat,
    ),
    numeric(
      `lfo${which}.rate`,
      `LFO ${which} Rate`,
      `${key}.rate`,
      which === "A" ? 5 : 0.4,
      0.05,
      12,
      0.01,
      cat,
      "Hz",
    ),
    numeric(`lfo${which}.depth`, `LFO ${which} Depth`, `${key}.depth`, 0, 0, 1, 0.001, cat),
    choice(
      `lfo${which}.dest`,
      `LFO ${which} Destination`,
      `${key}.destination`,
      which === "A" ? "pitch" : "filter",
      ["off", "pitch", "filter", "amp", "pw", "pan", "balance"],
      cat,
    ),
  ];
});

export const TX80_PARAMETER_DEFINITIONS: readonly Tx80ParameterDefinition[] = [
  ...layerParameters,
  choice("voice.mode", "Voice Mode", "voiceMode", "poly", ["poly", "solo"], "Voice"),
  choice("voice.polyphony", "Polyphony", "polyphony", 8, [4, 8, 12, 16], "Voice"),
  numeric(
    "velocity.sensitivity",
    "Velocity Sensitivity",
    "velocitySens",
    0.5,
    0,
    1,
    0.001,
    "Voice",
  ),
  choice(
    "pitch.mode",
    "Pitch Travel Mode",
    "pitchTravel.mode",
    "off",
    ["off", "porta", "gliss"],
    "Performance",
  ),
  numeric(
    "pitch.time",
    "Pitch Travel Time",
    "pitchTravel.time",
    0.12,
    0,
    1,
    0.001,
    "Performance",
    "s/oct",
    "none",
  ),
  choice(
    "ribbon.mode",
    "Ribbon Mode",
    "ribbon.mode",
    "pitch",
    ["pitch", "gliss", "hold"],
    "Performance",
  ),
  choice("ribbon.range", "Ribbon Range", "ribbon.range", 2, [2, 5, 7, 12, 24], "Performance"),
  ...lfoParameters,
  toggle("fx.chorus.enabled", "Chorus Enabled", "chorus.enabled", false, "Chorus"),
  numeric("fx.chorus.amount", "Chorus Amount", "chorus.amount", 0.4, 0, 1, 0.001, "Chorus"),
  numeric("fx.chorus.rate", "Chorus Rate", "chorus.rate", 0.6, 0.05, 8, 0.001, "Chorus", "Hz"),
  numeric("fx.chorus.depth", "Chorus Depth", "chorus.depth", 0.003, 0, 0.01, 0.0001, "Chorus", "s"),
  toggle("fx.delay.enabled", "Delay Enabled", "delay.enabled", false, "Delay"),
  numeric("fx.delay.time", "Delay Time", "delay.time", 0.32, 0.02, 1.2, 0.001, "Delay", "s"),
  numeric("fx.delay.feedback", "Delay Feedback", "delay.feedback", 0.35, 0, 0.85, 0.001, "Delay"),
  numeric("fx.delay.mix", "Delay Mix", "delay.mix", 0.25, 0, 1, 0.001, "Delay"),
  toggle("fx.reverb.enabled", "Reverb Enabled", "reverb.enabled", true, "Reverb"),
  choice(
    "fx.reverb.type",
    "Reverb Type",
    "reverb.type",
    "hall",
    ["digital", "hall", "glass"],
    "Reverb",
  ),
  numeric("fx.reverb.mix", "Reverb Mix", "reverb.mix", 0.22, 0, 1, 0.001, "Reverb"),
  numeric(
    "fx.reverb.size",
    "Reverb Size",
    "reverb.size",
    0.6,
    0,
    1,
    0.001,
    "Reverb",
    undefined,
    "none",
  ),
  numeric(
    "fx.reverb.decay",
    "Reverb Decay",
    "reverb.decay",
    0.55,
    0,
    1,
    0.001,
    "Reverb",
    undefined,
    "none",
  ),
  numeric(
    "fx.reverb.preDelay",
    "Reverb Pre-delay",
    "reverb.preDelay",
    0.02,
    0,
    0.2,
    0.001,
    "Reverb",
    "s",
  ),
  numeric(
    "fx.reverb.damping",
    "Reverb Damping",
    "reverb.damping",
    0.5,
    0,
    1,
    0.001,
    "Reverb",
    undefined,
    "none",
  ),
  numeric(
    "fx.reverb.width",
    "Reverb Width",
    "reverb.width",
    0.9,
    0,
    1,
    0.001,
    "Reverb",
    undefined,
    "none",
  ),
  numeric("master.volume", "Master Volume", "master.volume", 0.7, 0, 1, 0.001, "Master"),
  numeric("master.balance", "Layer Balance", "master.balance", 0, -1, 1, 0.001, "Master"),
];

const definitionsById = new Map(
  TX80_PARAMETER_DEFINITIONS.map((definition) => [definition.id, definition]),
);

export function getTx80ParameterDefinition(id: string): Tx80ParameterDefinition {
  const definition = definitionsById.get(id);
  if (!definition) throw new Error(`Unknown TX-80 parameter: ${id}`);
  return definition;
}

function coerceValue(definition: Tx80ParameterDefinition, value: ParameterValue): ParameterValue {
  if (definition.choices) {
    if (!definition.choices.includes(value)) {
      throw new RangeError(`Invalid value for ${definition.id}`);
    }
    return value;
  }
  if (typeof definition.defaultValue === "boolean") {
    if (typeof value !== "boolean") throw new TypeError(`${definition.id} requires a boolean`);
    return value;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${definition.id} requires a finite number`);
  }
  const clamped = Math.min(
    definition.maximum ?? value,
    Math.max(definition.minimum ?? value, value),
  );
  // Integer-stepped params (octave, coarse) snap to their grid.
  if (definition.step === 1) return Math.round(clamped);
  return clamped;
}

function readPath(patch: Tx80Patch, path: string): ParameterValue {
  let current: unknown = patch;
  for (const segment of path.split(".")) {
    current = (current as Record<string, unknown>)[segment];
  }
  return current as ParameterValue;
}

function writePath(patch: Tx80Patch, path: string, value: ParameterValue): void {
  const segments = path.split(".");
  let current: Record<string, unknown> = patch as unknown as Record<string, unknown>;
  for (const segment of segments.slice(0, -1)) {
    current = current[segment] as Record<string, unknown>;
  }
  current[segments.at(-1)!] = value;
}

export function getTx80Parameter(patch: Tx80Patch, id: string): ParameterValue {
  const definition = getTx80ParameterDefinition(id);
  return readPath(patch, definition.path);
}

/** Pure update: returns a new normalized patch with one coerced value set. */
export function setTx80Parameter(patch: Tx80Patch, id: string, value: ParameterValue): Tx80Patch {
  const definition = getTx80ParameterDefinition(id);
  const next = cloneTx80Patch(patch);
  writePath(next, definition.path, coerceValue(definition, value));
  return next;
}

export function setTx80Parameters(
  patch: Tx80Patch,
  updates: Readonly<Record<string, ParameterValue>>,
): Tx80Patch {
  let next = patch;
  for (const [id, value] of Object.entries(updates)) {
    next = setTx80Parameter(next, id, value);
  }
  return next;
}
