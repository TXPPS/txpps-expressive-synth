import { describe, expect, it } from "vitest";
import {
  getTx80Parameter,
  getTx80ParameterDefinition,
  setTx80Parameter,
  setTx80Parameters,
  TX80_PARAMETER_DEFINITIONS,
} from "./parameters";
import { TX80_FACTORY_PRESETS } from "./presets";
import { cloneTx80Patch, normalizeTx80Patch, TX80_INIT_PATCH } from "./types";

describe("TX-80 parameter contract", () => {
  it("has unique stable IDs that survive JSON serialization", () => {
    const ids = TX80_PARAMETER_DEFINITIONS.map((definition) => definition.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(JSON.parse(JSON.stringify(ids))).toEqual(ids);
    expect(ids).toContain("l1.filter.cutoff");
    expect(ids).toContain("l2.aenv.release");
    expect(ids).toContain("pitch.mode");
    expect(ids).toContain("ribbon.mode");
    expect(ids).toContain("lfoA.dest");
    expect(ids).toContain("master.balance");
    // Global performance settings never live in the patch registry.
    expect(ids).not.toContain("bendRangeSemitones");
  });

  it("every definition resolves against the INIT patch and matches its default", () => {
    for (const def of TX80_PARAMETER_DEFINITIONS) {
      const value = getTx80Parameter(TX80_INIT_PATCH, def.id);
      expect(value, def.id).toBe(def.defaultValue);
    }
  });

  it("Layer I edits never touch Layer II state (and vice versa)", () => {
    const a = setTx80Parameter(TX80_INIT_PATCH, "l1.filter.cutoff", 1234);
    expect(getTx80Parameter(a, "l1.filter.cutoff")).toBe(1234);
    expect(a.layers[1]).toEqual(TX80_INIT_PATCH.layers[1]);
    const b = setTx80Parameter(TX80_INIT_PATCH, "l2.wave", "pulse");
    expect(getTx80Parameter(b, "l2.wave")).toBe("pulse");
    expect(b.layers[0]).toEqual(TX80_INIT_PATCH.layers[0]);
  });

  it("changes, serializes, and restores a parameter value", () => {
    const changed = setTx80Parameters(cloneTx80Patch(TX80_INIT_PATCH), {
      "l1.filter.cutoff": 4321,
      "l2.enabled": true,
      "lfoB.dest": "pan",
      "pitch.mode": "gliss",
    });
    const restored = normalizeTx80Patch(JSON.parse(JSON.stringify(changed)));
    expect(getTx80Parameter(restored, "l1.filter.cutoff")).toBe(4321);
    expect(getTx80Parameter(restored, "l2.enabled")).toBe(true);
    expect(getTx80Parameter(restored, "lfoB.dest")).toBe("pan");
    expect(getTx80Parameter(restored, "pitch.mode")).toBe("gliss");
  });

  it("clamps numeric values and snaps integer-stepped parameters", () => {
    expect(
      getTx80Parameter(
        setTx80Parameter(TX80_INIT_PATCH, "l1.filter.cutoff", 999999),
        "l1.filter.cutoff",
      ),
    ).toBe(16000);
    expect(getTx80Parameter(setTx80Parameter(TX80_INIT_PATCH, "l1.octave", 1.4), "l1.octave")).toBe(
      1,
    );
    expect(getTx80Parameter(setTx80Parameter(TX80_INIT_PATCH, "l2.pan", -9), "l2.pan")).toBe(-1);
  });

  it("rejects unknown IDs and invalid choice values", () => {
    expect(() => setTx80Parameter(TX80_INIT_PATCH, "not.a.parameter", 1)).toThrow(
      "Unknown TX-80 parameter",
    );
    expect(() => setTx80Parameter(TX80_INIT_PATCH, "ribbon.mode", "teleport")).toThrow(RangeError);
    expect(() => setTx80Parameter(TX80_INIT_PATCH, "l1.enabled", 1)).toThrow(TypeError);
  });

  it("declares smoothing and serialization metadata on every definition", () => {
    for (const def of TX80_PARAMETER_DEFINITIONS) {
      const meta = getTx80ParameterDefinition(def.id);
      expect(["none", "fast", "medium"]).toContain(meta.smoothing);
      expect(meta.serialized).toBe(true);
      expect(typeof meta.path).toBe("string");
    }
  });
});

describe("TX-80 patch normalization", () => {
  it("coerces malformed data into a complete valid patch", () => {
    const p = normalizeTx80Patch({ layers: [{ level: 99, wave: "noise" }], lfoA: { rate: -4 } });
    expect(p.layers[0].level).toBe(1);
    expect(p.layers[0].wave).toBe("saw");
    expect(p.layers[1]).toEqual(TX80_INIT_PATCH.layers[1]);
    expect(p.lfoA.rate).toBe(0.05);
    expect(p.name).toBe("INIT");
  });

  it("preserves valid zero values exactly", () => {
    const src = cloneTx80Patch(TX80_INIT_PATCH);
    src.layers[0].subLevel = 0;
    src.layers[0].filter.envAmount = 0;
    src.master.balance = 0;
    const p = normalizeTx80Patch(JSON.parse(JSON.stringify(src)));
    expect(p.layers[0].subLevel).toBe(0);
    expect(p.layers[0].filter.envAmount).toBe(0);
    expect(p.master.balance).toBe(0);
  });

  it("every factory preset round-trips through serialization unchanged", () => {
    for (const entry of TX80_FACTORY_PRESETS) {
      const roundTripped = normalizeTx80Patch(JSON.parse(JSON.stringify(entry.patch)));
      expect(roundTripped, entry.id).toEqual(entry.patch);
    }
  });

  it("factory preset IDs are unique and stable", () => {
    const ids = TX80_FACTORY_PRESETS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith("tx80-factory-")).toBe(true);
  });
});
