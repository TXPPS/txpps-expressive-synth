import { loadUserPatches } from "../patchStorage";
import { migrateLegacyPatches, normalizeStoredEntry } from "./migration";
import { coerceCategory, isPresetCategory, normalizeTags } from "./metadata";
import {
  BROWSER_STATE_STORAGE_KEY,
  DEFAULT_BROWSER_STATE,
  FAVORITES_STORAGE_KEY,
  MAX_RECENT,
  RECENT_STORAGE_KEY,
  USER_LIBRARY_STORAGE_KEY,
  USER_LIBRARY_STORAGE_VERSION,
  type LibraryBrowserState,
  type LibraryEntry,
} from "./types";

/**
 * Persistence for the patch library. All reads tolerate malformed or missing
 * data and every write is wrapped so a full/blocked localStorage can never
 * crash the instrument. Nothing here ever clears user patches, the UI-mode
 * key, audio settings, or PWA caches.
 */

function readJson(key: string): unknown {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — keep playing */
  }
}

// ── User library (extends the legacy patch store) ───────────────────────────
// v2 stores { schemaVersion, entries: [{ meta, patch }] } under a NEW key.
// The legacy v1 key (raw Patch[]) is read once for migration and never
// written or cleared — an older cached PWA build keeps working against it.

interface UserLibraryPayload {
  schemaVersion: number;
  entries: unknown[];
}

export function saveUserLibrary(entries: readonly LibraryEntry[]): void {
  const payload: UserLibraryPayload = {
    schemaVersion: USER_LIBRARY_STORAGE_VERSION,
    entries: entries as unknown[],
  };
  writeJson(USER_LIBRARY_STORAGE_KEY, payload);
}

/** Load user entries; on first run with the new version, migrate the legacy
 *  store. Migration results (with their freshly generated stable IDs) are
 *  persisted immediately so IDs never regenerate on later loads. */
export function loadUserLibrary(): LibraryEntry[] {
  const raw = readJson(USER_LIBRARY_STORAGE_KEY);
  if (raw && typeof raw === "object" && Array.isArray((raw as UserLibraryPayload).entries)) {
    const ids = new Set<string>();
    const out: LibraryEntry[] = [];
    for (const item of (raw as UserLibraryPayload).entries) {
      const entry = normalizeStoredEntry(item, ids);
      if (entry) {
        ids.add(entry.meta.id);
        out.push(entry);
      }
    }
    return out;
  }
  // First run of the library system on this device: migrate legacy patches.
  const legacy = loadUserPatches();
  const migrated = migrateLegacyPatches(legacy);
  if (migrated.length > 0) saveUserLibrary(migrated);
  return migrated;
}

// ── Favorites ───────────────────────────────────────────────────────────────
// Stable preset IDs only — never patch data, never names.

export function loadFavorites(): string[] {
  const raw = readJson(FAVORITES_STORAGE_KEY);
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((v): v is string => typeof v === "string" && v.length > 0))];
}

export function saveFavorites(ids: readonly string[]): void {
  writeJson(FAVORITES_STORAGE_KEY, ids);
}

// ── Recent ──────────────────────────────────────────────────────────────────
// Most recent first, deduplicated, capped. Stable IDs only.

export function loadRecent(): string[] {
  const raw = readJson(RECENT_STORAGE_KEY);
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v === "string" && v.length > 0 && !out.includes(v)) out.push(v);
    if (out.length >= MAX_RECENT) break;
  }
  return out;
}

export function saveRecent(ids: readonly string[]): void {
  writeJson(RECENT_STORAGE_KEY, ids.slice(0, MAX_RECENT));
}

// ── Browser state (source tab, pack, category, tag filters) ─────────────────
// The free-text search string is intentionally NOT persisted.

export function loadBrowserState(): LibraryBrowserState {
  const raw = readJson(BROWSER_STATE_STORAGE_KEY);
  if (!raw || typeof raw !== "object") return { ...DEFAULT_BROWSER_STATE, tags: [] };
  const r = raw as Record<string, unknown>;
  const source =
    r.source === "factory" || r.source === "user" || r.source === "favorites" || r.source === "recent"
      ? r.source
      : DEFAULT_BROWSER_STATE.source;
  return {
    source,
    pack: typeof r.pack === "string" && r.pack ? r.pack : null,
    category: isPresetCategory(r.category) ? coerceCategory(r.category) : null,
    tags: normalizeTags(r.tags),
  };
}

export function saveBrowserState(state: LibraryBrowserState): void {
  writeJson(BROWSER_STATE_STORAGE_KEY, state);
}
