import type { Patch } from "../audio/types";
import { INIT_PATCH, normalizePatch } from "../audio/types";
import { clonePatch } from "../presets";
import {
  buildUserMetadata,
  coerceCategory,
  ensureUniqueId,
  normalizeTags,
  sanitizeAuthor,
  sanitizeDescription,
  sanitizeName,
  sanitizePack,
} from "./metadata";
import { PRODUCT, type LibraryEntry, type PresetMetadata } from "./types";

// ── Patch repair ────────────────────────────────────────────────────────────
// Every patch that enters the library from OUTSIDE the running app (legacy
// storage, corrupted storage, imported files) is rebuilt field-by-field over
// INIT_PATCH. Only whitelisted primitive values are copied, every number is
// finite-checked and clamped to the engine's safe range, and nothing is ever
// evaluated — a malicious or malformed file can at worst produce a boring
// sound, never code execution or a screaming master bus.

function num(v: unknown, d: number, min: number, max: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : d;
  return Math.min(max, Math.max(min, n));
}

function bool(v: unknown, d: boolean): boolean {
  return typeof v === "boolean" ? v : d;
}

function pick<T extends string | number>(v: unknown, options: readonly T[], d: T): T {
  return (options as readonly unknown[]).includes(v) ? (v as T) : d;
}

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Rebuild an untrusted patch payload into a fully valid, engine-safe Patch. */
export function sanitizeImportedPatch(raw: unknown, name: string): Patch {
  const base = clonePatch(INIT_PATCH);
  const r = rec(raw);

  const ops = Array.isArray(r.operators) ? r.operators : [];
  const operators = base.operators.map((def, i) => {
    const o = rec(ops[i]);
    return {
      ratio: num(o.ratio, def.ratio, 0.25, 16),
      detune: num(o.detune, def.detune, -50, 50),
      level: num(o.level, def.level, 0, 1),
      attack: num(o.attack, def.attack, 0.001, 4),
      decay: num(o.decay, def.decay, 0.01, 4),
      sustain: num(o.sustain, def.sustain, 0, 1),
      release: num(o.release, def.release, 0.01, 4),
      enabled: bool(o.enabled, def.enabled),
    };
  }) as Patch["operators"];

  const f = rec(r.filter);
  const c = rec(r.chorus);
  const d = rec(r.delay);
  const rv = rec(r.reverb);
  const v = rec(r.vintage);

  const patch: Patch = {
    ...base,
    name: name.slice(0, 24) || base.name,
    algorithm: Math.round(num(r.algorithm, base.algorithm, 1, 6)),
    operators,
    fmDepth: num(r.fmDepth, base.fmDepth, 0, 1),
    feedback: num(r.feedback, base.feedback, 0, 0.85),
    velocitySens: num(r.velocitySens, base.velocitySens, 0, 1),
    voiceMode: pick(r.voiceMode, ["poly", "mono"] as const, base.voiceMode),
    polyphony: pick(r.polyphony, [4, 8, 12] as const, base.polyphony),
    glide: num(r.glide, base.glide, 0, 0.5),
    glideMode: pick(r.glideMode, ["off", "poly", "mono"] as const, base.glideMode),
    pitchBendRangeSemitones: num(r.pitchBendRangeSemitones, base.pitchBendRangeSemitones, 1, 12),
    masterAttack: num(r.masterAttack, base.masterAttack, 0, 1),
    masterRelease: num(r.masterRelease, base.masterRelease, 0, 4),
    masterVolume: num(r.masterVolume, base.masterVolume, 0, 1),
    filter: {
      cutoff: num(f.cutoff, base.filter.cutoff, 20, 20000),
      resonance: num(f.resonance, base.filter.resonance, 0, 1),
    },
    chorus: {
      enabled: bool(c.enabled, base.chorus.enabled),
      amount: num(c.amount, base.chorus.amount, 0, 1),
      rate: num(c.rate, base.chorus.rate, 0.05, 8),
      depth: num(c.depth, base.chorus.depth, 0, 0.01),
    },
    delay: {
      enabled: bool(d.enabled, base.delay.enabled),
      time: num(d.time, base.delay.time, 0.02, 1.2),
      feedback: num(d.feedback, base.delay.feedback, 0, 0.85),
      mix: num(d.mix, base.delay.mix, 0, 1),
    },
    reverb: {
      enabled: bool(rv.enabled, base.reverb.enabled),
      type: pick(rv.type, ["digital", "hall", "glass"] as const, base.reverb.type),
      mix: num(rv.mix, base.reverb.mix, 0, 1),
      size: num(rv.size, base.reverb.size, 0, 1),
      decay: num(rv.decay, base.reverb.decay, 0, 1),
      preDelay: num(rv.preDelay, base.reverb.preDelay, 0, 0.2),
      damping: num(rv.damping, base.reverb.damping, 0, 1),
      width: num(rv.width, base.reverb.width, 0, 1),
    },
    vintage: {
      enabled: bool(v.enabled, base.vintage.enabled),
      age: num(v.age, base.vintage.age, 0, 1),
      warmth: num(v.warmth, base.vintage.warmth, 0, 1),
      grain: num(v.grain, base.vintage.grain, 0, 1),
      wear: num(v.wear, base.vintage.wear, 0, 1),
      drift: num(v.drift, base.vintage.drift, 0, 1),
      noise: num(v.noise, base.vintage.noise, 0, 1),
      stereoAge: num(v.stereoAge, base.vintage.stereoAge, 0, 1),
      drive: num(v.drive, base.vintage.drive, 0, 1),
    },
  };
  // clamps bend range to an integer and rebuilds operators as 4 owned objects
  return normalizePatch(patch);
}

// ── Stored-entry repair ─────────────────────────────────────────────────────

/** Validate/repair one entry read from user-library storage or an import
 *  file. Missing metadata gets the documented safe defaults; the DSP patch
 *  itself is preserved (values pass through the range guards unchanged when
 *  they were valid). Returns null only when there is no usable object. */
export function normalizeStoredEntry(
  raw: unknown,
  existingIds: ReadonlySet<string>,
): LibraryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const metaRaw = rec(r.meta ?? r.metadata);
  const patchRaw = r.patch;
  if (!patchRaw || typeof patchRaw !== "object") return null;

  const name = sanitizeName(metaRaw.name ?? rec(patchRaw).name);
  const versionNum =
    typeof metaRaw.version === "number" && Number.isFinite(metaRaw.version)
      ? Math.max(1, Math.round(metaRaw.version))
      : 1;

  const meta: PresetMetadata = {
    id: ensureUniqueId(metaRaw.id, existingIds),
    name,
    product: PRODUCT,
    author: sanitizeAuthor(metaRaw.author),
    pack: sanitizePack(metaRaw.pack),
    category: coerceCategory(metaRaw.category),
    tags: normalizeTags(metaRaw.tags),
    description: sanitizeDescription(metaRaw.description),
    version: versionNum,
    createdAt: typeof metaRaw.createdAt === "string" ? metaRaw.createdAt : undefined,
    updatedAt: typeof metaRaw.updatedAt === "string" ? metaRaw.updatedAt : undefined,
    source: "user",
  };

  return { meta, patch: sanitizeImportedPatch(patchRaw, meta.name) };
}

// ── Legacy migration ────────────────────────────────────────────────────────

/** Migrate patches from the legacy `tx27.userPatches.v1` store (raw Patch[])
 *  into full library entries. The legacy DSP data is preserved verbatim —
 *  it already went through the existing normalizePatch migration on load.
 *  Metadata gets the documented safe defaults. */
export function migrateLegacyPatches(patches: readonly Patch[]): LibraryEntry[] {
  const ids = new Set<string>();
  return patches.map((p) => {
    const meta = buildUserMetadata({ name: p.name }, ids);
    ids.add(meta.id);
    return { meta, patch: clonePatch(p) };
  });
}
