import type { Patch } from "../audio/types";
import { clonePatch } from "../presets";
import type { ParameterDefinition, ParameterValue } from "../synth/contracts";

interface Tx27ParameterDefinition extends ParameterDefinition {
  /** Product-owned path into Patch. It is not part of the reusable contract. */
  path: string;
}

const numeric = (
  id: string,
  name: string,
  path: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
  step: number,
  category: string,
  unit?: string,
): Tx27ParameterDefinition => ({
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
});

const choice = (
  id: string,
  name: string,
  path: string,
  defaultValue: string | number,
  choices: readonly (string | number)[],
  category: string,
): Tx27ParameterDefinition => ({
  id,
  name,
  path,
  defaultValue,
  choices,
  category,
  automatable: true,
  midiAssignable: true,
});

const toggle = (
  id: string,
  name: string,
  path: string,
  defaultValue: boolean,
  category: string,
): Tx27ParameterDefinition => ({
  id,
  name,
  path,
  defaultValue,
  category,
  automatable: true,
  midiAssignable: true,
});

const operatorParameters = Array.from({ length: 4 }, (_, index) => {
  const op = index + 1;
  const path = `operators.${index}`;
  const category = `Operator ${op}`;
  return [
    numeric(
      `op${op}.ratio`,
      `Operator ${op} Ratio`,
      `${path}.ratio`,
      index === 1 ? 2 : index === 3 ? 3 : 1,
      0.25,
      16,
      0.01,
      category,
      "ratio",
    ),
    numeric(
      `op${op}.detune`,
      `Operator ${op} Detune`,
      `${path}.detune`,
      0,
      -50,
      50,
      0.5,
      category,
      "cent",
    ),
    numeric(
      `op${op}.level`,
      `Operator ${op} Level`,
      `${path}.level`,
      [0.9, 0.6, 0.5, 0.4][index],
      0,
      1,
      0.001,
      category,
    ),
    numeric(
      `op${op}.attack`,
      `Operator ${op} Attack`,
      `${path}.attack`,
      0.01,
      0.001,
      4,
      0.001,
      category,
      "s",
    ),
    numeric(
      `op${op}.decay`,
      `Operator ${op} Decay`,
      `${path}.decay`,
      0.4,
      0.01,
      4,
      0.001,
      category,
      "s",
    ),
    numeric(
      `op${op}.sustain`,
      `Operator ${op} Sustain`,
      `${path}.sustain`,
      0.7,
      0,
      1,
      0.001,
      category,
    ),
    numeric(
      `op${op}.release`,
      `Operator ${op} Release`,
      `${path}.release`,
      0.3,
      0.01,
      4,
      0.001,
      category,
      "s",
    ),
    toggle(`op${op}.enabled`, `Operator ${op} Enabled`, `${path}.enabled`, true, category),
  ];
}).flat();

export const TX27_PARAMETER_DEFINITIONS: readonly Tx27ParameterDefinition[] = [
  choice("algo", "Algorithm", "algorithm", 1, [1, 2, 3, 4, 5, 6], "FM"),
  ...operatorParameters,
  numeric("fm.depth", "FM Depth", "fmDepth", 0.6, 0, 1, 0.001, "FM"),
  numeric("fm.feedback", "Feedback", "feedback", 0.15, 0, 0.85, 0.001, "FM"),
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
  choice("voice.mode", "Voice Mode", "voiceMode", "poly", ["poly", "mono"], "Voice"),
  choice("voice.polyphony", "Polyphony", "polyphony", 8, [4, 8, 12], "Voice"),
  numeric("glide.time", "Glide Time", "glide", 0.05, 0, 0.5, 0.001, "Voice", "s"),
  choice("glide.mode", "Glide Mode", "glideMode", "off", ["off", "poly", "mono"], "Voice"),
  numeric("envelope.masterAttack", "Master Attack", "masterAttack", 0, 0, 1, 0.001, "Voice", "s"),
  numeric(
    "envelope.masterRelease",
    "Master Release",
    "masterRelease",
    0,
    0,
    4,
    0.001,
    "Voice",
    "s",
  ),
  numeric("filter.cutoff", "Filter Cutoff", "filter.cutoff", 12000, 20, 20000, 1, "Filter", "Hz"),
  numeric("filter.resonance", "Filter Resonance", "filter.resonance", 0.4, 0, 1, 0.001, "Filter"),
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
  numeric("fx.reverb.mix", "Reverb Mix", "reverb.mix", 0.28, 0, 1, 0.001, "Reverb"),
  numeric("fx.reverb.size", "Reverb Size", "reverb.size", 0.6, 0, 1, 0.001, "Reverb"),
  numeric("fx.reverb.decay", "Reverb Decay", "reverb.decay", 0.6, 0, 1, 0.001, "Reverb"),
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
  numeric("fx.reverb.damping", "Reverb Damping", "reverb.damping", 0.5, 0, 1, 0.001, "Reverb"),
  numeric("fx.reverb.width", "Reverb Width", "reverb.width", 0.9, 0, 1, 0.001, "Reverb"),
  toggle("vintage.enabled", "Vintage Enabled", "vintage.enabled", false, "Vintage"),
  numeric("vintage.age", "Vintage Age", "vintage.age", 0.35, 0, 1, 0.001, "Vintage"),
  numeric("vintage.warmth", "Vintage Warmth", "vintage.warmth", 0.5, 0, 1, 0.001, "Vintage"),
  numeric("vintage.grain", "Vintage Grain", "vintage.grain", 0.3, 0, 1, 0.001, "Vintage"),
  numeric("vintage.wear", "Vintage Wear", "vintage.wear", 0.3, 0, 1, 0.001, "Vintage"),
  numeric("vintage.drift", "Vintage Drift", "vintage.drift", 0.3, 0, 1, 0.001, "Vintage"),
  numeric("vintage.noise", "Vintage Noise", "vintage.noise", 0.25, 0, 1, 0.001, "Vintage"),
  numeric(
    "vintage.stereoAge",
    "Vintage Stereo Age",
    "vintage.stereoAge",
    0.3,
    0,
    1,
    0.001,
    "Vintage",
  ),
  numeric("vintage.drive", "Vintage Drive", "vintage.drive", 0.4, 0, 1, 0.001, "Vintage"),
  numeric("master.volume", "Master Volume", "masterVolume", 0.7, 0, 1, 0.001, "Master"),
];

const definitionsById = new Map(
  TX27_PARAMETER_DEFINITIONS.map((definition) => [definition.id, definition]),
);

export function getTx27ParameterDefinition(id: string): Tx27ParameterDefinition {
  const definition = definitionsById.get(id);
  if (!definition) throw new Error(`Unknown TX27 parameter: ${id}`);
  return definition;
}

function coerceValue(definition: Tx27ParameterDefinition, value: ParameterValue): ParameterValue {
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
  return Math.min(definition.maximum ?? value, Math.max(definition.minimum ?? value, value));
}

function readPath(patch: Patch, path: string): ParameterValue {
  let current: unknown = patch;
  for (const segment of path.split(".")) {
    current = (current as Record<string, unknown>)[segment];
  }
  return current as ParameterValue;
}

function writePath(patch: Patch, path: string, value: ParameterValue): void {
  const segments = path.split(".");
  let current: Record<string, unknown> = patch as unknown as Record<string, unknown>;
  for (const segment of segments.slice(0, -1)) {
    current = current[segment] as Record<string, unknown>;
  }
  current[segments.at(-1)!] = value;
}

export function getTx27Parameter(patch: Patch, id: string): ParameterValue {
  const definition = getTx27ParameterDefinition(id);
  return readPath(patch, definition.path);
}

export function setTx27Parameter(patch: Patch, id: string, value: ParameterValue): Patch {
  const definition = getTx27ParameterDefinition(id);
  const next = clonePatch(patch);
  writePath(next, definition.path, coerceValue(definition, value));
  return next;
}

export function setTx27Parameters(
  patch: Patch,
  updates: Readonly<Record<string, ParameterValue>>,
): Patch {
  let next = patch;
  for (const [id, value] of Object.entries(updates)) {
    next = setTx27Parameter(next, id, value);
  }
  return next;
}
