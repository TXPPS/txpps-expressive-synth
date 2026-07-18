import type { Patch } from "./audio/types";
import { normalizePatch } from "./audio/types";

const KEY = "tx27.userPatches.v1";

export function loadUserPatches(): Patch[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    // Migration: patches saved before pitchBendRangeSemitones existed
    // (or with invalid values) are normalized to the ±2 default.
    return (JSON.parse(raw) as Patch[]).map(normalizePatch);
  } catch {
    return [];
  }
}

export function saveUserPatches(patches: Patch[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(patches));
  } catch {
    /* noop */
  }
}
