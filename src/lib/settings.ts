import { clampBendRange } from "./audio/types";

/** Global performance settings — deliberately NOT part of the patch.
 *
 *  On real hardware, pitch-bend wheel range lives in the synth's global
 *  setup page, not in each voice/patch: a player sets it once and every
 *  preset respects it. Storing it here (instead of in the patch) means
 *  changing presets never yanks the wheel range out from under the player
 *  mid-performance. Persisted in localStorage, separate from patches.
 */
export interface Tx27Settings {
  /** Pitch bend wheel range in semitones (integer 1..12). */
  bendRangeSemitones: number;
  /** Ask before discarding unsaved edits when switching presets. */
  confirmPresetChange: boolean;
}

export const DEFAULT_SETTINGS: Tx27Settings = {
  bendRangeSemitones: 2,
  confirmPresetChange: true,
};

const SETTINGS_KEY = "tx27-settings";

/** SSR-safe load with per-field validation; malformed or missing data falls
 *  back to defaults without throwing. */
export function loadSettings(): Tx27Settings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const p = JSON.parse(raw) as Partial<Tx27Settings>;
    return {
      bendRangeSemitones: clampBendRange(
        p.bendRangeSemitones ?? DEFAULT_SETTINGS.bendRangeSemitones,
      ),
      confirmPresetChange:
        typeof p.confirmPresetChange === "boolean"
          ? p.confirmPresetChange
          : DEFAULT_SETTINGS.confirmPresetChange,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Tx27Settings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable (private mode/quota) — settings just won't persist */
  }
}
