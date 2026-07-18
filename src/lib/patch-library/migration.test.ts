import { afterEach, describe, expect, it, vi } from "vitest";
import { INIT_PATCH } from "../audio/types";
import { clonePatch } from "../presets";
import { parseImportText, serializePresetFile } from "./importExport";
import { sanitizeImportedPatch } from "./migration";
import { loadUserLibrary, saveUserLibrary } from "./storage";
import type { LibraryEntry } from "./types";

function entryWithGlideMode(mode: "off" | "poly" | "mono"): LibraryEntry {
  const patch = clonePatch(INIT_PATCH);
  patch.name = "Glide Test";
  patch.glideMode = mode;
  return {
    meta: {
      id: "user.glide-test",
      name: patch.name,
      product: "TXPPS TX27",
      author: "Test",
      pack: "Test",
      category: "UTILITY",
      tags: [],
      description: "",
      version: 1,
      source: "user",
    },
    patch,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TX27 patch sanitization", () => {
  it.each(["off", "poly", "mono"] as const)("preserves glideMode %s", (mode) => {
    const raw = clonePatch(INIT_PATCH);
    raw.glideMode = mode;
    expect(sanitizeImportedPatch(raw, raw.name).glideMode).toBe(mode);
  });

  it("preserves glideMode through export and re-import", () => {
    const result = parseImportText(serializePresetFile(entryWithGlideMode("mono")), new Set());
    expect(result.error).toBeNull();
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].patch.glideMode).toBe("mono");
  });

  it("preserves glideMode through current-version local storage reload", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    saveUserLibrary([entryWithGlideMode("poly")]);
    expect(loadUserLibrary()[0].patch.glideMode).toBe("poly");
  });

  it("uses safe defaults and clamps malformed imported values", () => {
    const patch = sanitizeImportedPatch(
      {
        operators: [{ ratio: Number.POSITIVE_INFINITY, level: -2 }],
        glideMode: "teleport",
        filter: { cutoff: 999999 },
        delay: { feedback: 4 },
      },
      "Malformed",
    );
    expect(patch.operators).toHaveLength(4);
    expect(patch.operators[0].ratio).toBe(INIT_PATCH.operators[0].ratio);
    expect(patch.operators[0].level).toBe(0);
    expect(patch.glideMode).toBe("off");
    expect(patch.filter.cutoff).toBe(20000);
    expect(patch.delay.feedback).toBe(0.85);
  });

  it("keeps default patch values valid", () => {
    const patch = sanitizeImportedPatch(INIT_PATCH, INIT_PATCH.name);
    expect(patch.algorithm).toBeGreaterThanOrEqual(1);
    expect(patch.algorithm).toBeLessThanOrEqual(6);
    expect(patch.masterVolume).toBeGreaterThanOrEqual(0);
    expect(patch.masterVolume).toBeLessThanOrEqual(1);
    expect(patch.operators).toHaveLength(4);
  });
});
