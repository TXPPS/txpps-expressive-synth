import type { Patch } from "../audio/types";
import { normalizePatch } from "../audio/types";

/** Order-independent structural equality over plain JSON-ish values. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  if (a && b && typeof a === "object") {
    const ka = Object.keys(a as object).sort();
    const kb = Object.keys(b as object).sort();
    if (ka.length !== kb.length) return false;
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] !== kb[i]) return false;
      if (
        !deepEqual(
          (a as Record<string, unknown>)[ka[i]],
          (b as Record<string, unknown>)[ka[i]],
        )
      )
        return false;
    }
    return true;
  }
  return false;
}

/**
 * Unsaved-change detection: compares NORMALIZED DSP patch data only.
 * Both sides go through normalizePatch so field-fill differences between a
 * freshly saved patch and an older stored one never register as edits.
 * UI mode, browser state, favorites, recent, search etc. are not part of
 * Patch and therefore can never mark the sound as edited.
 */
export function patchesEqual(a: Patch | null | undefined, b: Patch | null | undefined): boolean {
  if (!a || !b) return a === b;
  return deepEqual(normalizePatch(a), normalizePatch(b));
}
