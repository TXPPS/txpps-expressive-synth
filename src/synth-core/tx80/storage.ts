import { cloneTx80Patch, normalizeTx80Patch, type Tx80Patch } from "./types";

/** TX-80 local persistence — user presets and instrument settings.
 *
 *  localStorage-backed like the proven TX27 store: every read tolerates
 *  malformed/missing data, every write is wrapped so a full or blocked store
 *  can never crash the instrument, and factory presets never depend on
 *  storage at all. Keys are TX-80-owned and never collide with TX27 keys. */

const USER_PRESETS_KEY = "tx80-user-presets";
const USER_PRESETS_VERSION = 1;
const SETTINGS_KEY = "tx80-settings";
const UI_MODE_KEY = "tx80-ui-mode";
const LAST_PRESET_KEY = "tx80-last-preset";

export interface Tx80UserPreset {
  /** Stable ID (generated once at save; survives rename). */
  id: string;
  name: string;
  patch: Tx80Patch;
  savedAt: number;
}

function readJson(key: string): unknown {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
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
    return false; // storage full or blocked — keep playing
  }
}

export function generatePresetId(existing: ReadonlySet<string>): string {
  for (let i = 0; i < 100; i++) {
    const id = `tx80-user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    if (!existing.has(id)) return id;
  }
  return `tx80-user-${Date.now()}-${Math.random()}`;
}

export function loadUserPresets(): Tx80UserPreset[] {
  const raw = readJson(USER_PRESETS_KEY);
  if (!raw || typeof raw !== "object") return [];
  const entries = (raw as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) return [];
  const ids = new Set<string>();
  const out: Tx80UserPreset[] = [];
  for (const item of entries) {
    if (!item || typeof item !== "object") continue;
    const e = item as Partial<Tx80UserPreset>;
    if (typeof e.id !== "string" || !e.id || ids.has(e.id)) continue;
    if (typeof e.name !== "string" || !e.name.trim()) continue;
    ids.add(e.id);
    out.push({
      id: e.id,
      name: e.name.trim().slice(0, 40),
      patch: normalizeTx80Patch(e.patch),
      savedAt: typeof e.savedAt === "number" ? e.savedAt : 0,
    });
  }
  return out;
}

/** Returns false when persistence is unavailable (UI shows a notice; the
 *  in-memory session keeps working). */
export function saveUserPresets(entries: readonly Tx80UserPreset[]): boolean {
  return writeJson(USER_PRESETS_KEY, {
    schemaVersion: USER_PRESETS_VERSION,
    entries: entries.map((e) => ({ ...e, patch: cloneTx80Patch(e.patch) })),
  });
}

// ── Instrument settings (global, not per-patch) ─────────────────────────────

export interface Tx80Settings {
  /** Pitch bend wheel/strip range in semitones (integer 1..12). */
  bendRangeSemitones: number;
  /** Ask before discarding unsaved edits when switching presets. */
  confirmPresetChange: boolean;
}

export const TX80_DEFAULT_SETTINGS: Tx80Settings = {
  bendRangeSemitones: 2,
  confirmPresetChange: true,
};

export function clampBendRange(v: unknown): number {
  const n = Math.round(typeof v === "number" && Number.isFinite(v) ? v : 2);
  return Math.max(1, Math.min(12, n));
}

export function loadTx80Settings(): Tx80Settings {
  const raw = readJson(SETTINGS_KEY);
  if (!raw || typeof raw !== "object") return { ...TX80_DEFAULT_SETTINGS };
  const p = raw as Partial<Tx80Settings>;
  return {
    bendRangeSemitones: clampBendRange(
      p.bendRangeSemitones ?? TX80_DEFAULT_SETTINGS.bendRangeSemitones,
    ),
    confirmPresetChange:
      typeof p.confirmPresetChange === "boolean"
        ? p.confirmPresetChange
        : TX80_DEFAULT_SETTINGS.confirmPresetChange,
  };
}

export function saveTx80Settings(s: Tx80Settings): void {
  writeJson(SETTINGS_KEY, s);
}

// ── UI mode + last-selected preset ──────────────────────────────────────────

export type Tx80UiMode = "full" | "editor" | "performance";

export function loadTx80UiMode(): Tx80UiMode {
  try {
    const v = localStorage.getItem(UI_MODE_KEY);
    if (v === "full" || v === "editor" || v === "performance") return v;
  } catch {
    /* noop */
  }
  return "full";
}

export function saveTx80UiMode(mode: Tx80UiMode): void {
  try {
    localStorage.setItem(UI_MODE_KEY, mode);
  } catch {
    /* noop */
  }
}

export function loadLastPresetId(): string | null {
  try {
    const v = localStorage.getItem(LAST_PRESET_KEY);
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function saveLastPresetId(id: string): void {
  try {
    localStorage.setItem(LAST_PRESET_KEY, id);
  } catch {
    /* noop */
  }
}
