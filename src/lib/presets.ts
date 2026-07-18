import type { Patch } from "./audio/types";
import { INIT_PATCH, normalizePatch } from "./audio/types";

// Deep-ish clone helper for patches. Also normalizes: patches saved before
// newer fields existed (e.g. pitchBendRangeSemitones) get safe defaults.
export function clonePatch(p: Patch): Patch {
  return normalizePatch(JSON.parse(JSON.stringify(p)) as Patch);
}

type OpOverride = Partial<Patch["operators"][number]>;
type PatchOverride = Partial<Omit<Patch, "operators">> & { operators?: OpOverride[] };

function mk(name: string, overrides: PatchOverride): Patch {
  const base = clonePatch(INIT_PATCH);
  base.name = name;
  if (overrides.operators) {
    base.operators = base.operators.map((op, i) => ({
      ...op,
      ...(overrides.operators![i] ?? {}),
    })) as Patch["operators"];
  }
  const { operators: _o, ...rest } = overrides;
  void _o;
  return { ...base, ...rest, name };
}

export const FACTORY_PRESETS: Patch[] = [
  mk("TX Electric", {
    algorithm: 3,
    fmDepth: 0.35,
    feedback: 0.08,
    operators: [
      { ratio: 1, level: 0.9, attack: 0.001, decay: 1.2, sustain: 0.2, release: 0.4 },
      { ratio: 14, level: 0.35, attack: 0.001, decay: 0.5, sustain: 0.0, release: 0.2 },
      { ratio: 1, level: 0.7, attack: 0.001, decay: 1.8, sustain: 0.3, release: 0.6 },
      { ratio: 1, level: 0.5, attack: 0.001, decay: 0.4, sustain: 0.0, release: 0.2 },
    ],
    filter: { cutoff: 8000, resonance: 0.3 },
    chorus: { enabled: true, amount: 0.35, rate: 0.7, depth: 0.003 },
    reverb: { enabled: true, type: "hall", mix: 0.25, size: 0.5, decay: 0.5, preDelay: 0.02, damping: 0.5, width: 0.9 },
  }),
  mk("Glass Roads", {
    algorithm: 2,
    fmDepth: 0.5,
    feedback: 0.1,
    operators: [
      { ratio: 1, level: 0.8, attack: 0.02, decay: 1.5, sustain: 0.4, release: 1.2 },
      { ratio: 2, level: 0.6, attack: 0.02, decay: 1.2, sustain: 0.4, release: 1.0 },
      { ratio: 3, level: 0.5, attack: 0.02, decay: 1.0, sustain: 0.3, release: 0.9 },
      { ratio: 7, level: 0.4, attack: 0.001, decay: 0.6, sustain: 0.0, release: 0.4 },
    ],
    reverb: { enabled: true, type: "glass", mix: 0.4, size: 0.8, decay: 0.7, preDelay: 0.03, damping: 0.3, width: 1 },
  }),
  mk("Soft Tines", {
    algorithm: 3,
    fmDepth: 0.3,
    operators: [
      { ratio: 1, level: 0.9, attack: 0.001, decay: 1.4, sustain: 0.25, release: 0.6 },
      { ratio: 7, level: 0.3, attack: 0.001, decay: 0.35, sustain: 0.0, release: 0.2 },
      { ratio: 1, level: 0.6, attack: 0.001, decay: 2, sustain: 0.35, release: 0.8 },
      { ratio: 1, level: 0.3, attack: 0.001, decay: 0.3, sustain: 0.0, release: 0.15 },
    ],
    chorus: { enabled: true, amount: 0.3, rate: 0.5, depth: 0.002 },
  }),
  mk("Neon Bell", {
    algorithm: 1,
    fmDepth: 0.8,
    feedback: 0.05,
    operators: [
      { ratio: 1, level: 0.9, attack: 0.001, decay: 2.5, sustain: 0.0, release: 1.5 },
      { ratio: 3.5, level: 0.55, attack: 0.001, decay: 2.0, sustain: 0.0, release: 1.2 },
      { ratio: 7, level: 0.4, attack: 0.001, decay: 1.5, sustain: 0.0, release: 1.0 },
      { ratio: 11, level: 0.35, attack: 0.001, decay: 1.0, sustain: 0.0, release: 0.6 },
    ],
    reverb: { enabled: true, type: "glass", mix: 0.45, size: 0.85, decay: 0.8, preDelay: 0.03, damping: 0.35, width: 1 },
  }),
  mk("Chrome Bass", {
    algorithm: 1,
    voiceMode: "mono",
    glideMode: "mono", // explicit: mono legato glide (was implicit pre-glideMode)
    glide: 0.06,
    fmDepth: 0.55,
    feedback: 0.35,
    operators: [
      { ratio: 1, level: 1, attack: 0.001, decay: 0.6, sustain: 0.6, release: 0.15 },
      { ratio: 1, level: 0.65, attack: 0.001, decay: 0.3, sustain: 0.4, release: 0.1 },
      { ratio: 2, level: 0.5, attack: 0.001, decay: 0.25, sustain: 0.2, release: 0.1 },
      { ratio: 0.5, level: 0.4, attack: 0.001, decay: 0.2, sustain: 0.1, release: 0.1 },
    ],
    filter: { cutoff: 3500, resonance: 0.6 },
    reverb: { enabled: true, type: "digital", mix: 0.15, size: 0.3, decay: 0.3, preDelay: 0.005, damping: 0.6, width: 0.7 },
  }),
  mk("Hollow Fifth", {
    algorithm: 4,
    fmDepth: 0.5,
    operators: [
      { ratio: 1, level: 0.85, attack: 0.05, decay: 1, sustain: 0.7, release: 0.6 },
      { ratio: 1.5, level: 0.8, attack: 0.05, decay: 1, sustain: 0.7, release: 0.6 },
      { ratio: 3, level: 0.45, attack: 0.02, decay: 0.5, sustain: 0.3, release: 0.4 },
      { ratio: 2, level: 0.4, attack: 0.02, decay: 0.5, sustain: 0.3, release: 0.4 },
    ],
  }),
  mk("Digital Choir", {
    algorithm: 6,
    fmDepth: 0.3,
    operators: [
      { ratio: 1, level: 0.7, attack: 0.5, decay: 0.4, sustain: 0.85, release: 1.5 },
      { ratio: 2, level: 0.55, attack: 0.6, decay: 0.4, sustain: 0.8, release: 1.5, detune: 6 },
      { ratio: 3, level: 0.4, attack: 0.7, decay: 0.4, sustain: 0.75, release: 1.5, detune: -6 },
      { ratio: 4, level: 0.3, attack: 0.8, decay: 0.4, sustain: 0.7, release: 1.5 },
    ],
    chorus: { enabled: true, amount: 0.55, rate: 0.4, depth: 0.005 },
    reverb: { enabled: true, type: "hall", mix: 0.5, size: 0.85, decay: 0.75, preDelay: 0.04, damping: 0.5, width: 1 },
  }),
  mk("Night Mallet", {
    algorithm: 1,
    fmDepth: 0.65,
    operators: [
      { ratio: 1, level: 0.9, attack: 0.001, decay: 0.8, sustain: 0, release: 0.5 },
      { ratio: 4, level: 0.5, attack: 0.001, decay: 0.5, sustain: 0, release: 0.3 },
      { ratio: 1, level: 0.5, attack: 0.001, decay: 1.2, sustain: 0.1, release: 0.5 },
      { ratio: 8, level: 0.3, attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 },
    ],
    delay: { enabled: true, time: 0.28, feedback: 0.3, mix: 0.25 },
  }),
  mk("Frozen Pad", {
    algorithm: 6,
    fmDepth: 0.2,
    operators: [
      { ratio: 1, level: 0.7, attack: 1.2, decay: 0.5, sustain: 0.85, release: 2.0 },
      { ratio: 2, level: 0.4, attack: 1.5, decay: 0.5, sustain: 0.8, release: 2.0, detune: 8 },
      { ratio: 3, level: 0.3, attack: 1.8, decay: 0.5, sustain: 0.7, release: 2.0, detune: -8 },
      { ratio: 5, level: 0.2, attack: 2.0, decay: 0.5, sustain: 0.6, release: 2.0 },
    ],
    reverb: { enabled: true, type: "glass", mix: 0.55, size: 1, decay: 0.9, preDelay: 0.05, damping: 0.3, width: 1 },
    chorus: { enabled: true, amount: 0.5, rate: 0.3, depth: 0.004 },
  }),
  mk("Wire Pluck", {
    algorithm: 3,
    fmDepth: 0.5,
    operators: [
      { ratio: 1, level: 0.9, attack: 0.001, decay: 0.6, sustain: 0, release: 0.3 },
      { ratio: 3, level: 0.6, attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 },
      { ratio: 1, level: 0.5, attack: 0.001, decay: 0.7, sustain: 0, release: 0.3 },
      { ratio: 5, level: 0.3, attack: 0.001, decay: 0.2, sustain: 0, release: 0.15 },
    ],
    delay: { enabled: true, time: 0.24, feedback: 0.4, mix: 0.3 },
  }),
  mk("Data Organ", {
    algorithm: 6,
    fmDepth: 0.2,
    operators: [
      { ratio: 1, level: 0.7, attack: 0.005, decay: 0.1, sustain: 1, release: 0.2 },
      { ratio: 2, level: 0.55, attack: 0.005, decay: 0.1, sustain: 1, release: 0.2 },
      { ratio: 4, level: 0.4, attack: 0.005, decay: 0.1, sustain: 1, release: 0.2 },
      { ratio: 8, level: 0.25, attack: 0.005, decay: 0.1, sustain: 1, release: 0.2 },
    ],
    chorus: { enabled: true, amount: 0.4, rate: 5, depth: 0.002 },
  }),
  mk("Broken Terminal", {
    algorithm: 2,
    fmDepth: 0.9,
    feedback: 0.5,
    operators: [
      { ratio: 1, level: 0.8, attack: 0.001, decay: 0.5, sustain: 0.4, release: 0.3 },
      { ratio: 2.01, level: 0.6, attack: 0.001, decay: 0.5, sustain: 0.3, release: 0.3, detune: 12 },
      { ratio: 3.5, level: 0.55, attack: 0.001, decay: 0.5, sustain: 0.3, release: 0.3 },
      { ratio: 11, level: 0.5, attack: 0.001, decay: 0.4, sustain: 0.2, release: 0.2 },
    ],
    vintage: { enabled: true, age: 0.85, warmth: 0.6, grain: 0.7, wear: 0.6, drift: 0.6, noise: 0.5, stereoAge: 0.5, drive: 0.6 },
    delay: { enabled: true, time: 0.18, feedback: 0.5, mix: 0.35 },
  }),
  mk("Vintage EP", {
    algorithm: 3,
    fmDepth: 0.4,
    operators: [
      { ratio: 1, level: 0.9, attack: 0.001, decay: 1.4, sustain: 0.25, release: 0.6 },
      { ratio: 14, level: 0.32, attack: 0.001, decay: 0.4, sustain: 0.0, release: 0.2 },
      { ratio: 1, level: 0.6, attack: 0.001, decay: 2, sustain: 0.3, release: 0.7 },
      { ratio: 1, level: 0.3, attack: 0.001, decay: 0.4, sustain: 0.0, release: 0.2 },
    ],
    vintage: { enabled: true, age: 0.6, warmth: 0.7, grain: 0.4, wear: 0.5, drift: 0.4, noise: 0.35, stereoAge: 0.45, drive: 0.5 },
    chorus: { enabled: true, amount: 0.4, rate: 0.6, depth: 0.003 },
  }),
  mk("Aged Brass", {
    algorithm: 5,
    fmDepth: 0.65,
    operators: [
      { ratio: 1, level: 0.9, attack: 0.06, decay: 0.6, sustain: 0.65, release: 0.35 },
      { ratio: 1, level: 0.7, attack: 0.05, decay: 0.5, sustain: 0.6, release: 0.35 },
      { ratio: 2, level: 0.55, attack: 0.04, decay: 0.5, sustain: 0.5, release: 0.3 },
      { ratio: 1, level: 0.5, attack: 0.04, decay: 0.4, sustain: 0.4, release: 0.3 },
    ],
    vintage: { enabled: true, age: 0.5, warmth: 0.6, grain: 0.3, wear: 0.35, drift: 0.3, noise: 0.25, stereoAge: 0.3, drive: 0.55 },
  }),
  mk("1987 Memory", {
    algorithm: 4,
    fmDepth: 0.5,
    operators: [
      { ratio: 1, level: 0.85, attack: 0.3, decay: 0.5, sustain: 0.7, release: 1.2 },
      { ratio: 2, level: 0.6, attack: 0.35, decay: 0.5, sustain: 0.6, release: 1.2 },
      { ratio: 3, level: 0.45, attack: 0.001, decay: 0.4, sustain: 0.0, release: 0.3 },
      { ratio: 5, level: 0.35, attack: 0.001, decay: 0.3, sustain: 0.0, release: 0.3 },
    ],
    vintage: { enabled: true, age: 0.75, warmth: 0.7, grain: 0.55, wear: 0.55, drift: 0.5, noise: 0.4, stereoAge: 0.5, drive: 0.5 },
    reverb: { enabled: true, type: "hall", mix: 0.4, size: 0.7, decay: 0.65, preDelay: 0.03, damping: 0.55, width: 0.9 },
    delay: { enabled: true, time: 0.36, feedback: 0.35, mix: 0.25 },
  }),
];

export function randomizePatch(base: Patch): Patch {
  const p = clonePatch(base);
  const r = (min: number, max: number) => min + Math.random() * (max - min);
  p.algorithm = 1 + Math.floor(Math.random() * 6);
  p.fmDepth = r(0.2, 0.75);
  p.feedback = r(0, 0.35);
  p.operators = p.operators.map((op, i) => ({
    ...op,
    ratio: [0.5, 1, 1, 2, 3, 4, 5, 7][Math.floor(Math.random() * 8)],
    detune: r(-8, 8),
    level: i === 0 ? r(0.7, 1) : r(0.2, 0.8),
    attack: r(0.001, 0.4),
    decay: r(0.1, 1.5),
    sustain: r(0, 0.9),
    release: r(0.1, 1.2),
    enabled: true,
  }));
  p.filter.cutoff = r(1500, 14000);
  p.filter.resonance = r(0.1, 0.6);
  p.name = "RANDOM";
  return p;
}
