import { describe, expect, it } from "vitest";
import { INIT_PATCH } from "../audio/types";
import { sanitizeImportedPatch } from "../patch-library/migration";
import {
  BROWSER_STATE_STORAGE_KEY,
  FAVORITES_STORAGE_KEY,
  RECENT_STORAGE_KEY,
  USER_LIBRARY_STORAGE_KEY,
} from "../patch-library/types";
import { clonePatch } from "../presets";
import { getTx27Parameter, setTx27Parameter, TX27_PARAMETER_DEFINITIONS } from "./parameters";

describe("TX27 parameter contract", () => {
  it("has unique stable IDs that survive JSON serialization", () => {
    const ids = TX27_PARAMETER_DEFINITIONS.map((definition) => definition.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(JSON.parse(JSON.stringify(ids))).toEqual(ids);
    expect(ids).toContain("glide.mode");
    expect(ids).toContain("op1.ratio");
    expect(ids).not.toContain("bendRangeSemitones");
    expect(ids).not.toContain("confirmPresetChange");
  });

  it("keeps persisted state keys stable through serialization", () => {
    const keys = [
      USER_LIBRARY_STORAGE_KEY,
      FAVORITES_STORAGE_KEY,
      RECENT_STORAGE_KEY,
      BROWSER_STATE_STORAGE_KEY,
      "tx27-settings",
      "tx27-ui-mode",
    ];
    expect(JSON.parse(JSON.stringify(keys))).toEqual(keys);
    expect(keys).toContain("tx27.userLibrary.v2");
  });

  it("changes, serializes, and restores a parameter value", () => {
    const changed = setTx27Parameter(clonePatch(INIT_PATCH), "filter.cutoff", 4321);
    const restored = sanitizeImportedPatch(JSON.parse(JSON.stringify(changed)), changed.name);
    expect(getTx27Parameter(restored, "filter.cutoff")).toBe(4321);
  });

  it("clamps numeric values according to the definition", () => {
    const changed = setTx27Parameter(INIT_PATCH, "filter.cutoff", 999999);
    expect(getTx27Parameter(changed, "filter.cutoff")).toBe(20000);
  });

  it("rejects unknown IDs and invalid choice values", () => {
    expect(() => setTx27Parameter(INIT_PATCH, "not.a.parameter", 1)).toThrow(
      "Unknown TX27 parameter",
    );
    expect(() => setTx27Parameter(INIT_PATCH, "glide.mode", "teleport")).toThrow(RangeError);
  });
});
