/** Persist LAST UI mode (FULL/EDIT/PLAY). Separate from patch state. */

const UI_MODE_KEY = "tx80-ui-mode";

export function loadPersistedUiMode(): "full" | "edit" | "play" | null {
  try {
    if (typeof window === "undefined") return null;
    const v = localStorage.getItem(UI_MODE_KEY);
    if (v === "full" || v === "edit" || v === "play") return v;
  } catch {
    /* private mode */
  }
  return null;
}

export function persistUiMode(mode: "full" | "edit" | "play"): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(UI_MODE_KEY, mode);
  } catch {
    /* private mode */
  }
}
