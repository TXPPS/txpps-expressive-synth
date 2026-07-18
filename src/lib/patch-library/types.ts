import type { Patch } from "../audio/types";

/**
 * TXPPS preset-library core types.
 *
 * This module is deliberately DSP-agnostic apart from the `Patch` payload
 * type parameterization point: the metadata model, category list, source
 * model and file formats are designed to be reused across future TXPPS
 * products (other synths, effects, JUCE/VST3 builds). Nothing in here
 * touches the audio engine.
 */

export const PRODUCT = "TXPPS TX27" as const;

/** Version of the single-preset interchange file format. */
export const PRESET_SCHEMA_VERSION = 1;
/** Version of the multi-preset library interchange file format. */
export const LIBRARY_SCHEMA_VERSION = 1;
/** Version of the on-device user-library storage payload. */
export const USER_LIBRARY_STORAGE_VERSION = 1;

// ── localStorage keys ───────────────────────────────────────────────────────
// The legacy key (raw Patch[]) is owned by src/lib/patchStorage.ts and is
// never written again after migration — see migration.ts. It is preserved so
// an older cached PWA build keeps working with its own data.
export const USER_LIBRARY_STORAGE_KEY = "tx27.userLibrary.v2";
export const FAVORITES_STORAGE_KEY = "tx27-preset-favorites";
export const RECENT_STORAGE_KEY = "tx27-preset-recent";
export const BROWSER_STATE_STORAGE_KEY = "tx27-preset-browser-state";

// ── Limits ──────────────────────────────────────────────────────────────────
export const MAX_RECENT = 20;
export const MAX_TAGS_PER_PRESET = 20;
export const MAX_TAG_LENGTH = 24;
export const MAX_NAME_LENGTH = 24;
export const MAX_AUTHOR_LENGTH = 24;
export const MAX_PACK_LENGTH = 32;
export const MAX_DESCRIPTION_LENGTH = 240;
/** Refuse to parse import files larger than this (bytes). */
export const MAX_IMPORT_FILE_BYTES = 2_000_000;

// ── Defaults ────────────────────────────────────────────────────────────────
export const FACTORY_PACK = "TXPPS Factory";
export const FACTORY_AUTHOR = "TXPPS";
export const DEFAULT_USER_PACK = "User Library";
export const DEFAULT_USER_AUTHOR = "User";

// ── Categories ──────────────────────────────────────────────────────────────
export const PRESET_CATEGORIES = [
  "KEYS",
  "BASS",
  "LEAD",
  "PAD",
  "BELL",
  "MALLET",
  "ORGAN",
  "PLUCK",
  "CHOIR",
  "BRASS",
  "TEXTURE",
  "FX",
  "UTILITY",
  "UNCATEGORIZED",
] as const;

export type PresetCategory = (typeof PRESET_CATEGORIES)[number];

export type PresetSource = "factory" | "user";

// ── Metadata model ──────────────────────────────────────────────────────────
/** Library metadata for one preset. Kept strictly outside the DSP Patch data
 *  and outside the audio engine. IDs are stable and never derived from the
 *  (renamable) preset name. */
export interface PresetMetadata {
  id: string;
  name: string;
  product: typeof PRODUCT;
  author: string;
  pack: string;
  category: PresetCategory;
  tags: string[];
  description: string;
  version: number;
  createdAt?: string;
  updatedAt?: string;
  source: PresetSource;
}

/** One browsable library entry: metadata plus the DSP patch payload. */
export interface LibraryEntry {
  meta: PresetMetadata;
  patch: Patch;
}

// ── Interchange file formats ────────────────────────────────────────────────
/** `TX27-<Name>.tx27preset.json` */
export interface PresetFileV1 {
  schemaVersion: number;
  product: string;
  metadata: PresetMetadata;
  patch: Patch;
}

/** `TX27-User-Library.tx27library.json` — also the future basis for
 *  `.tx27pack` bundles (a pack is a library file plus pack-level metadata). */
export interface LibraryFileV1 {
  schemaVersion: number;
  product: string;
  exportedAt: string;
  presets: Array<{ metadata: PresetMetadata; patch: Patch }>;
}

// ── Browser state ───────────────────────────────────────────────────────────
export type BrowserSource = "factory" | "user" | "favorites" | "recent";

export interface LibraryBrowserState {
  source: BrowserSource;
  pack: string | null;
  category: PresetCategory | null;
  tags: string[];
}

export const DEFAULT_BROWSER_STATE: LibraryBrowserState = {
  source: "factory",
  pack: null,
  category: null,
  tags: [],
};

export interface ImportSummary {
  imported: number;
  skipped: number;
  message: string;
}
