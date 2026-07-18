import {
  DEFAULT_USER_AUTHOR,
  DEFAULT_USER_PACK,
  MAX_AUTHOR_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PACK_LENGTH,
  MAX_TAGS_PER_PRESET,
  MAX_TAG_LENGTH,
  PRESET_CATEGORIES,
  PRODUCT,
  type PresetCategory,
  type PresetMetadata,
} from "./types";

// ── Small sanitizers ────────────────────────────────────────────────────────

function cleanString(v: unknown, max: number, fallback = ""): string {
  if (typeof v !== "string") return fallback;
  const s = v.replace(/\s+/g, " ").trim().slice(0, max);
  return s || fallback;
}

export function sanitizeName(v: unknown, fallback = "UNTITLED"): string {
  return cleanString(v, MAX_NAME_LENGTH, fallback);
}

export function sanitizeAuthor(v: unknown, fallback = DEFAULT_USER_AUTHOR): string {
  return cleanString(v, MAX_AUTHOR_LENGTH, fallback);
}

export function sanitizePack(v: unknown, fallback = DEFAULT_USER_PACK): string {
  return cleanString(v, MAX_PACK_LENGTH, fallback);
}

export function sanitizeDescription(v: unknown): string {
  return cleanString(v, MAX_DESCRIPTION_LENGTH, "");
}

// ── Categories ──────────────────────────────────────────────────────────────

export function isPresetCategory(v: unknown): v is PresetCategory {
  return typeof v === "string" && (PRESET_CATEGORIES as readonly string[]).includes(v);
}

/** Coerce any value into a valid category. Case-insensitive; anything
 *  unknown becomes UNCATEGORIZED (never throws, never loses the preset). */
export function coerceCategory(v: unknown): PresetCategory {
  if (typeof v === "string") {
    const upper = v.trim().toUpperCase();
    if (isPresetCategory(upper)) return upper;
  }
  return "UNCATEGORIZED";
}

// ── Tags ────────────────────────────────────────────────────────────────────
// Stored in display form (trimmed, single-spaced, length-capped); matching is
// always case-insensitive via tagKey(). Duplicates that differ only by case
// or whitespace collapse to the first occurrence.

export function normalizeTag(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_TAG_LENGTH);
}

export function tagKey(tag: string): string {
  return tag.toLowerCase();
}

export function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of raw) {
    const tag = normalizeTag(t);
    if (!tag) continue;
    const key = tagKey(tag);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= MAX_TAGS_PER_PRESET) break;
  }
  return out;
}

// ── IDs ─────────────────────────────────────────────────────────────────────
// User preset IDs are opaque and generated once; they survive rename and are
// the only thing favorites/recent reference. Factory IDs are hand-written
// stable strings in factory.ts (never generated at runtime).

export function generatePresetId(prefix = "user"): string {
  let core: string;
  try {
    core =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : "";
  } catch {
    core = "";
  }
  if (!core) {
    core = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
  return `${prefix}-${core}`;
}

/** Ensure `id` is a usable, collision-free id; otherwise generate a new one. */
export function ensureUniqueId(id: unknown, existing: ReadonlySet<string>): string {
  const candidate = typeof id === "string" ? id.trim().slice(0, 64) : "";
  if (candidate && !existing.has(candidate)) return candidate;
  let fresh = generatePresetId();
  while (existing.has(fresh)) fresh = generatePresetId();
  return fresh;
}

// ── Metadata builders ───────────────────────────────────────────────────────

export interface UserMetadataFields {
  name: string;
  author?: string;
  pack?: string;
  category?: PresetCategory;
  tags?: string[];
  description?: string;
}

export function buildUserMetadata(
  fields: UserMetadataFields,
  existingIds: ReadonlySet<string>,
): PresetMetadata {
  const now = new Date().toISOString();
  return {
    id: ensureUniqueId(null, existingIds),
    name: sanitizeName(fields.name),
    product: PRODUCT,
    author: sanitizeAuthor(fields.author),
    pack: sanitizePack(fields.pack),
    category: coerceCategory(fields.category),
    tags: normalizeTags(fields.tags ?? []),
    description: sanitizeDescription(fields.description),
    version: 1,
    createdAt: now,
    updatedAt: now,
    source: "user",
  };
}
