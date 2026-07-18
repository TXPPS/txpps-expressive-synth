import { normalizeStoredEntry } from "./migration";
import {
  LIBRARY_SCHEMA_VERSION,
  MAX_IMPORT_FILE_BYTES,
  PRESET_SCHEMA_VERSION,
  PRODUCT,
  type LibraryEntry,
  type LibraryFileV1,
  type PresetFileV1,
} from "./types";

/**
 * JSON-only import/export. Files are parsed with JSON.parse (data, never
 * code), validated structurally, and every patch is rebuilt field-by-field
 * through the sanitizing path in migration.ts. Imports always become USER
 * presets, never overwrite existing entries, and get a fresh ID on collision.
 * Everything works fully offline.
 */

// ── Export ──────────────────────────────────────────────────────────────────

function sanitizeFilename(name: string): string {
  const clean = name
    .replace(/[^A-Za-z0-9 _-]+/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return clean || "Preset";
}

function downloadJson(filename: string, data: unknown): void {
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (err) {
    console.error("TX27 export failed:", err);
  }
}

/** `TX27-<Name>.tx27preset.json` */
export function createPresetFile(entry: LibraryEntry): PresetFileV1 {
  return {
    schemaVersion: PRESET_SCHEMA_VERSION,
    product: PRODUCT,
    metadata: entry.meta,
    patch: entry.patch,
  };
}

export function serializePresetFile(entry: LibraryEntry): string {
  return JSON.stringify(createPresetFile(entry), null, 2);
}

/** `TX27-<Name>.tx27preset.json` */
export function exportPresetFile(entry: LibraryEntry): void {
  const file = createPresetFile(entry);
  downloadJson(`TX27-${sanitizeFilename(entry.meta.name)}.tx27preset.json`, file);
}

/** `TX27-User-Library.tx27library.json` */
export function exportLibraryFile(entries: readonly LibraryEntry[]): void {
  const file: LibraryFileV1 = {
    schemaVersion: LIBRARY_SCHEMA_VERSION,
    product: PRODUCT,
    exportedAt: new Date().toISOString(),
    presets: entries.map((e) => ({ metadata: e.meta, patch: e.patch })),
  };
  downloadJson(`TX27-User-Library.tx27library.json`, file);
}

// ── Import ──────────────────────────────────────────────────────────────────

export interface ParsedImport {
  entries: LibraryEntry[];
  skipped: number;
  error: string | null;
}

function fail(error: string): ParsedImport {
  return { entries: [], skipped: 0, error };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function validHeader(obj: Record<string, unknown>, maxVersion: number): string | null {
  if (obj.product !== PRODUCT) return "NOT A TXPPS TX27 FILE";
  const sv = obj.schemaVersion;
  if (typeof sv !== "number" || !Number.isInteger(sv) || sv < 1) return "MISSING SCHEMA VERSION";
  if (sv > maxVersion) return `UNSUPPORTED SCHEMA v${sv}`;
  return null;
}

/**
 * Parse one imported file (single preset OR library format, auto-detected).
 * `existingIds` must contain every ID already in the library (factory and
 * user) — imported entries keep their ID when free, otherwise get a new one.
 * Malformed presets inside a library file are skipped and counted, never
 * imported half-broken.
 */
export function parseImportText(text: string, existingIds: ReadonlySet<string>): ParsedImport {
  if (text.length > MAX_IMPORT_FILE_BYTES) return fail("FILE TOO LARGE");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail("NOT VALID JSON");
  }
  if (!isPlainObject(raw)) return fail("NOT A PRESET FILE");

  const ids = new Set(existingIds);

  // Library file: { schemaVersion, product, exportedAt, presets: [...] }
  if (Array.isArray(raw.presets)) {
    const headerError = validHeader(raw, LIBRARY_SCHEMA_VERSION);
    if (headerError) return fail(headerError);
    const entries: LibraryEntry[] = [];
    let skipped = 0;
    for (const item of raw.presets) {
      if (!isPlainObject(item) || !isPlainObject(item.patch) || !isPlainObject(item.metadata)) {
        skipped++;
        continue;
      }
      const entry = normalizeStoredEntry(item, ids);
      if (entry) {
        ids.add(entry.meta.id);
        entries.push(entry);
      } else {
        skipped++;
      }
    }
    if (entries.length === 0 && skipped === 0) return fail("LIBRARY FILE IS EMPTY");
    return { entries, skipped, error: null };
  }

  // Single preset file: { schemaVersion, product, metadata, patch }
  const headerError = validHeader(raw, PRESET_SCHEMA_VERSION);
  if (headerError) return fail(headerError);
  if (!isPlainObject(raw.metadata) || !isPlainObject(raw.patch)) return fail("MALFORMED PRESET FILE");
  const entry = normalizeStoredEntry(raw, ids);
  if (!entry) return fail("MALFORMED PRESET FILE");
  return { entries: [entry], skipped: 0, error: null };
}
