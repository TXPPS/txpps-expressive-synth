/**
 * Factory + user preset browser for TX-80 Gate 2.
 * Factory patches are intentional characters — not near-duplicates.
 */

import { defaultPatch, type PatchValues } from "./params";
import { enginePatchToUiValues } from "./enginePatchBridge";
import { TX80_FACTORY_PRESETS } from "@/synth-core/tx80/presets";
import type { PresetMeta } from "./store";

export type PatchCategory = "KEYS" | "PADS" | "LEADS" | "BASS" | "EXPERIMENTAL" | "INIT";

export interface FactoryPatch {
  id: string;
  name: string;
  category: PatchCategory;
  values: PatchValues;
}

const CATEGORY_BY_ENGINE_ID: Record<string, PatchCategory> = {
  "tx80-factory-dual-strings": "PADS",
  "tx80-factory-velvet-brass": "KEYS",
  "tx80-factory-glass-pad": "PADS",
  "tx80-factory-twin-bass": "BASS",
  "tx80-factory-ribbon-lead": "LEADS",
  "tx80-factory-stepped-sky": "EXPERIMENTAL",
  "tx80-factory-hollow-organ": "KEYS",
  "tx80-factory-drift-choir": "PADS",
  "tx80-factory-pan-weaver": "EXPERIMENTAL",
  "tx80-factory-init": "INIT",
};

function patch(partial: PatchValues): PatchValues {
  return { ...defaultPatch(), ...partial };
}

/** Extra UI-native factory sounds (beyond the donor engine set). */
const EXTRA_FACTORY: FactoryPatch[] = [
  {
    id: "tx80-factory-electric-piano",
    name: "TX Electric",
    category: "KEYS",
    values: patch({
      "layerI.osc.wave": "triangle",
      "layerI.osc.pw": 0.35,
      "layerI.filt.cutoff": 4800,
      "layerI.filt.reso": 0.18,
      "layerI.filt.envAmt": 0.45,
      "layerI.env.a.a": 0.002,
      "layerI.env.a.d": 1.2,
      "layerI.env.a.s": 0.35,
      "layerI.env.a.r": 0.55,
      "layerI.env.f.a": 0.002,
      "layerI.env.f.d": 0.9,
      "layerI.env.f.s": 0.2,
      "layerII.layer.on": true,
      "layerII.osc.wave": "sine",
      "layerII.osc.octave": 1,
      "layerII.osc.fine": 6,
      "layerII.filt.cutoff": 6200,
      "layerII.layer.level": 0.35,
      "layerII.env.a.a": 0.002,
      "layerII.env.a.d": 1.0,
      "layerII.env.a.s": 0.25,
      "layerII.env.a.r": 0.5,
      "fx.chorus.on": true,
      "fx.chorus.mix": 0.28,
      "fx.reverb.on": true,
      "fx.reverb.mix": 0.18,
      "mod.lfo1.depth": 0.04,
      "mod.lfo1.dest": "pitch",
    }),
  },
  {
    id: "tx80-factory-warm-keys",
    name: "Warm Keys",
    category: "KEYS",
    values: patch({
      "layerI.osc.wave": "saw",
      "layerI.sub.level": 0.2,
      "layerI.filt.cutoff": 2100,
      "layerI.filt.reso": 0.12,
      "layerI.filt.envAmt": 0.3,
      "layerI.env.a.a": 0.01,
      "layerI.env.a.d": 0.55,
      "layerI.env.a.s": 0.7,
      "layerI.env.a.r": 0.45,
      "layerII.layer.on": true,
      "layerII.osc.wave": "triangle",
      "layerII.osc.fine": -7,
      "layerII.filt.cutoff": 2800,
      "layerII.layer.level": 0.5,
      "fx.chorus.on": true,
      "fx.chorus.mix": 0.4,
      "fx.reverb.on": true,
      "fx.reverb.size": 0.45,
      "fx.reverb.mix": 0.22,
    }),
  },
  {
    id: "tx80-factory-soft-pad",
    name: "Soft Cloud",
    category: "PADS",
    values: patch({
      "layerI.osc.wave": "sine",
      "layerI.filt.cutoff": 1800,
      "layerI.filt.envAmt": 0.15,
      "layerI.env.a.a": 1.8,
      "layerI.env.a.d": 1.5,
      "layerI.env.a.s": 0.9,
      "layerI.env.a.r": 2.8,
      "layerI.layer.pan": -0.35,
      "layerII.layer.on": true,
      "layerII.osc.wave": "triangle",
      "layerII.osc.fine": 9,
      "layerII.filt.cutoff": 2400,
      "layerII.env.a.a": 2.1,
      "layerII.env.a.r": 3.0,
      "layerII.layer.pan": 0.35,
      "layerII.layer.level": 0.65,
      "mod.lfo2.rate": 0.12,
      "mod.lfo2.depth": 0.35,
      "mod.lfo2.dest": "cutoff",
      "fx.chorus.on": true,
      "fx.chorus.mix": 0.5,
      "fx.reverb.on": true,
      "fx.reverb.size": 0.9,
      "fx.reverb.mix": 0.45,
      "master.polyphony": 12,
    }),
  },
  {
    id: "tx80-factory-neon-lead",
    name: "Neon Lead",
    category: "LEADS",
    values: patch({
      "layerI.osc.wave": "square",
      "layerI.osc.pw": 0.28,
      "layerI.filt.cutoff": 5200,
      "layerI.filt.reso": 0.42,
      "layerI.filt.envAmt": 0.55,
      "layerI.env.a.a": 0.004,
      "layerI.env.a.d": 0.25,
      "layerI.env.a.s": 0.75,
      "layerI.env.a.r": 0.2,
      "layerII.layer.on": true,
      "layerII.osc.wave": "saw",
      "layerII.osc.fine": -12,
      "layerII.filt.cutoff": 4000,
      "layerII.layer.level": 0.45,
      "porta.on": true,
      "porta.time": 0.18,
      "ribbon.mode": "continuous",
      "ribbon.range": 12,
      "mod.lfo1.rate": 6.5,
      "mod.lfo1.depth": 0.15,
      "mod.lfo1.dest": "pitch",
      "fx.delay.on": true,
      "fx.delay.time": 0.28,
      "fx.delay.fb": 0.4,
      "fx.delay.mix": 0.28,
      "master.polyphony": 4,
    }),
  },
  {
    id: "tx80-factory-acid-bass",
    name: "Acid Sub",
    category: "BASS",
    values: patch({
      "layerI.osc.wave": "saw",
      "layerI.osc.octave": -1,
      "layerI.sub.level": 0.55,
      "layerI.filt.cutoff": 650,
      "layerI.filt.reso": 0.62,
      "layerI.filt.envAmt": 0.75,
      "layerI.env.f.a": 0.002,
      "layerI.env.f.d": 0.28,
      "layerI.env.f.s": 0.15,
      "layerI.env.a.a": 0.002,
      "layerI.env.a.d": 0.35,
      "layerI.env.a.s": 0.55,
      "layerI.env.a.r": 0.12,
      "layerII.layer.on": false,
      "porta.on": true,
      "porta.time": 0.08,
      "fx.reverb.on": false,
      "fx.delay.on": false,
      "fx.chorus.on": false,
      "master.polyphony": 4,
    }),
  },
  {
    id: "tx80-factory-pulse-bass",
    name: "Pulse Floor",
    category: "BASS",
    values: patch({
      "layerI.osc.wave": "pulse",
      "layerI.osc.pw": 0.18,
      "layerI.osc.octave": -1,
      "layerI.filt.cutoff": 1100,
      "layerI.filt.reso": 0.4,
      "layerI.filt.envAmt": 0.5,
      "layerI.env.a.a": 0.003,
      "layerI.env.a.d": 0.4,
      "layerI.env.a.s": 0.65,
      "layerI.env.a.r": 0.18,
      "layerII.layer.on": true,
      "layerII.osc.wave": "sine",
      "layerII.osc.octave": -2,
      "layerII.filt.cutoff": 800,
      "layerII.layer.level": 0.7,
      "mod.lfo2.rate": 0.35,
      "mod.lfo2.depth": 0.4,
      "mod.lfo2.dest": "pw",
      "fx.chorus.on": true,
      "fx.chorus.mix": 0.2,
      "master.polyphony": 8,
    }),
  },
  {
    id: "tx80-factory-gliss-harp",
    name: "Gliss Harp",
    category: "EXPERIMENTAL",
    values: patch({
      "layerI.osc.wave": "triangle",
      "layerI.filt.cutoff": 7500,
      "layerI.filt.reso": 0.08,
      "layerI.filt.envAmt": 0.25,
      "layerI.env.a.a": 0.002,
      "layerI.env.a.d": 1.4,
      "layerI.env.a.s": 0.2,
      "layerI.env.a.r": 1.2,
      "layerII.layer.on": true,
      "layerII.osc.wave": "sine",
      "layerII.osc.octave": 1,
      "layerII.layer.level": 0.4,
      "gliss.on": true,
      "gliss.rate": 0.05,
      "ribbon.mode": "glissando",
      "ribbon.range": 24,
      "fx.delay.on": true,
      "fx.delay.time": 0.38,
      "fx.delay.mix": 0.35,
      "fx.reverb.on": true,
      "fx.reverb.mix": 0.3,
    }),
  },
  {
    id: "tx80-factory-hold-drone",
    name: "Hold Drone",
    category: "EXPERIMENTAL",
    values: patch({
      "layerI.osc.wave": "saw",
      "layerI.noise.level": 0.08,
      "layerI.filt.cutoff": 900,
      "layerI.filt.reso": 0.35,
      "layerI.env.a.a": 0.8,
      "layerI.env.a.s": 1,
      "layerI.env.a.r": 2.5,
      "layerII.layer.on": true,
      "layerII.osc.wave": "pulse",
      "layerII.osc.pw": 0.12,
      "layerII.osc.fine": 14,
      "layerII.filt.cutoff": 1400,
      "layerII.env.a.a": 1.2,
      "layerII.env.a.s": 1,
      "layerII.layer.level": 0.55,
      "ribbon.mode": "hold",
      "ribbon.range": 7,
      "mod.lfo1.rate": 0.08,
      "mod.lfo1.depth": 0.5,
      "mod.lfo1.dest": "cutoff",
      "mod.lfo2.rate": 0.15,
      "mod.lfo2.depth": 0.45,
      "mod.lfo2.dest": "pan",
      "fx.reverb.on": true,
      "fx.reverb.size": 0.95,
      "fx.reverb.mix": 0.5,
      "master.polyphony": 12,
    }),
  },
];

function fromEngineFactories(): FactoryPatch[] {
  return TX80_FACTORY_PRESETS.map((entry) => ({
    id: entry.id,
    name: entry.patch.name,
    category: CATEGORY_BY_ENGINE_ID[entry.id] ?? "EXPERIMENTAL",
    values: enginePatchToUiValues(entry.patch),
  }));
}

export const FACTORY_PATCHES: readonly FactoryPatch[] = Object.freeze([
  ...fromEngineFactories(),
  ...EXTRA_FACTORY,
]);

const USER_KEY = "tx80-ui-user-presets";
const FAV_KEY = "tx80-ui-favorites";
const LAST_KEY = "tx80-ui-last-preset";

export interface UserPatch {
  id: string;
  name: string;
  category: PatchCategory;
  values: PatchValues;
  savedAt: number;
}

function readJson(key: string): unknown {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): boolean {
  try {
    if (typeof window === "undefined") return false;
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadUserPatches(): UserPatch[] {
  const raw = readJson(USER_KEY);
  if (!raw || typeof raw !== "object") return [];
  const entries = (raw as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) return [];
  const out: UserPatch[] = [];
  for (const item of entries) {
    if (!item || typeof item !== "object") continue;
    const e = item as Partial<UserPatch>;
    if (typeof e.id !== "string" || typeof e.name !== "string" || !e.values) continue;
    out.push({
      id: e.id,
      name: e.name.slice(0, 40),
      category: (e.category as PatchCategory) || "EXPERIMENTAL",
      values: { ...defaultPatch(), ...e.values },
      savedAt: typeof e.savedAt === "number" ? e.savedAt : Date.now(),
    });
  }
  return out;
}

export function saveUserPatches(entries: readonly UserPatch[]): boolean {
  return writeJson(USER_KEY, { schemaVersion: 1, entries });
}

export function loadFavorites(): Set<string> {
  const raw = readJson(FAV_KEY);
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter((x): x is string => typeof x === "string"));
}

export function saveFavorites(ids: ReadonlySet<string>): void {
  writeJson(FAV_KEY, [...ids]);
}

export function loadLastPresetId(): string | null {
  const raw = readJson(LAST_KEY);
  return typeof raw === "string" ? raw : null;
}

export function saveLastPresetId(id: string): void {
  writeJson(LAST_KEY, id);
}

export function findFactoryPatch(id: string): FactoryPatch | undefined {
  return FACTORY_PATCHES.find((p) => p.id === id);
}

export function allBrowsablePatches(user: readonly UserPatch[]): Array<FactoryPatch | UserPatch> {
  return [...FACTORY_PATCHES, ...user];
}

export function toPresetMeta(
  p: { id: string; name: string; category: string },
  source: "factory" | "user",
): PresetMeta {
  return { id: p.id, name: p.name, category: p.category, source };
}

export function createUserPatchId(): string {
  return `tx80-user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
