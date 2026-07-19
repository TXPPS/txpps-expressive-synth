import { describe, expect, it } from "vitest";
import { defaultPatch, PARAM_REGISTRY } from "@/state/params";
import { ENGINE_ONLY_IDS, mapPatchToEngine, mapUiParamToEngine, PARAM_MAP } from "./mapping";
import {
  getTx80ParameterDefinition,
  setTx80Parameter,
  TX80_PARAMETER_DEFINITIONS,
} from "./tx80/parameters";
import { TX80_INIT_PATCH } from "./tx80/types";

describe("UI ↔ engine parameter mapping", () => {
  it("covers every UI registry id with exactly one entry", () => {
    const uiIds = PARAM_REGISTRY.map((d) => d.id);
    for (const id of uiIds) {
      expect(PARAM_MAP[id], `missing mapping for ${id}`).toBeDefined();
    }
    for (const id of Object.keys(PARAM_MAP)) {
      expect(uiIds, `mapping for unknown UI id ${id}`).toContain(id);
    }
  });

  it("every mapped engine id exists in the engine registry", () => {
    for (const [uiId, entry] of Object.entries(PARAM_MAP)) {
      if (entry.kind === "direct") {
        expect(
          () => getTx80ParameterDefinition(entry.engineId),
          `${uiId} → ${entry.engineId}`,
        ).not.toThrow();
      } else if (entry.kind === "derived") {
        const produced = entry.compute(defaultPatch());
        for (const engineId of Object.keys(produced)) {
          expect(() => getTx80ParameterDefinition(engineId), `${uiId} ⇒ ${engineId}`).not.toThrow();
        }
      }
    }
  });

  it("every unmapped entry documents a reason and a disposition", () => {
    for (const [uiId, entry] of Object.entries(PARAM_MAP)) {
      if (entry.kind !== "unmapped") continue;
      expect(entry.reason.length, uiId).toBeGreaterThan(10);
      expect(entry.disposition, uiId).toMatch(/Gate \d/);
    }
  });

  it("the full default UI patch translates into values the engine accepts", () => {
    const engineUpdates = mapPatchToEngine(defaultPatch());
    expect(Object.keys(engineUpdates).length).toBeGreaterThan(50);
    let patch = TX80_INIT_PATCH;
    for (const [engineId, value] of Object.entries(engineUpdates)) {
      // setTx80Parameter throws on unknown ids, wrong types, and invalid
      // enum values — this asserts full acceptance, not just id validity.
      expect(
        () => {
          patch = setTx80Parameter(patch, engineId, value);
        },
        `${engineId} = ${JSON.stringify(value)}`,
      ).not.toThrow();
    }
  });

  it("every UI enum value translates to a value the engine accepts", () => {
    const base = defaultPatch();
    for (const def of PARAM_REGISTRY) {
      if (def.type !== "enum" || !def.values) continue;
      const entry = PARAM_MAP[def.id];
      if (!entry || entry.kind === "unmapped") continue;
      for (const v of def.values) {
        const updates = mapUiParamToEngine(def.id, v, base);
        for (const [engineId, ev] of Object.entries(updates)) {
          expect(
            () => setTx80Parameter(TX80_INIT_PATCH, engineId, ev),
            `${def.id}=${v} → ${engineId}=${String(ev)}`,
          ).not.toThrow();
        }
      }
    }
  });

  it("boundary numeric values clamp into engine ranges", () => {
    const base = defaultPatch();
    for (const def of PARAM_REGISTRY) {
      if (def.type !== "float" && def.type !== "int") continue;
      const entry = PARAM_MAP[def.id];
      if (!entry || entry.kind !== "direct") continue;
      for (const v of [def.min ?? 0, def.max ?? 1]) {
        const updates = mapUiParamToEngine(def.id, v, base);
        for (const [engineId, ev] of Object.entries(updates)) {
          const engineDef = getTx80ParameterDefinition(engineId);
          if (
            typeof ev === "number" &&
            engineDef.minimum !== undefined &&
            engineDef.maximum !== undefined
          ) {
            expect(ev, `${def.id}=${v} → ${engineId}`).toBeGreaterThanOrEqual(engineDef.minimum);
            expect(ev, `${def.id}=${v} → ${engineId}`).toBeLessThanOrEqual(engineDef.maximum);
          }
        }
      }
    }
  });

  it("pitch-travel derivation is coherent", () => {
    const base = defaultPatch();
    expect(mapUiParamToEngine("porta.on", true, base)["pitch.mode"]).toBe("porta");
    const both = { ...base, "porta.on": true };
    expect(mapUiParamToEngine("gliss.on", true, both)["pitch.mode"]).toBe("gliss");
    expect(mapUiParamToEngine("gliss.on", false, both)["pitch.mode"]).toBe("porta");
    expect(mapUiParamToEngine("porta.on", false, base)["pitch.mode"]).toBe("off");
  });

  it("engine-only ids are valid and disjoint from mapped targets", () => {
    const mappedTargets = new Set(
      Object.values(PARAM_MAP).flatMap((e) => (e.kind === "direct" ? [e.engineId] : [])),
    );
    for (const id of ENGINE_ONLY_IDS) {
      expect(() => getTx80ParameterDefinition(id), id).not.toThrow();
      expect(mappedTargets.has(id), `${id} is both engine-only and mapped`).toBe(false);
    }
  });

  it("engine registry ids not addressed at all are accounted for", () => {
    const addressed = new Set<string>([
      ...ENGINE_ONLY_IDS,
      ...Object.values(PARAM_MAP).flatMap((e) =>
        e.kind === "direct"
          ? [e.engineId]
          : e.kind === "derived"
            ? Object.keys(e.compute(defaultPatch()))
            : [],
      ),
    ]);
    const unaddressed = TX80_PARAMETER_DEFINITIONS.map((d) => d.id).filter(
      (id) => !addressed.has(id),
    );
    // Every engine id must be either UI-mapped or explicitly engine-only.
    expect(unaddressed, `unaccounted engine ids: ${unaddressed.join(", ")}`).toEqual([]);
  });
});
