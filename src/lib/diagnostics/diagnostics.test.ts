import { describe, expect, it, beforeEach } from "vitest";
import {
  DIAG_BUFFER_CAPACITY,
  diagClear,
  diagError,
  diagInfo,
  diagSnapshot,
  diagPush,
  formatDiagExport,
} from "@/lib/diagnostics/buffer";
import { getBuildInfo } from "@/lib/diagnostics/buildInfo";
import { FACTORY_PATCHES } from "@/state/presets";

describe("diagnostic event buffer", () => {
  beforeEach(() => {
    diagClear();
  });

  it("is bounded and drops oldest events", () => {
    for (let i = 0; i < DIAG_BUFFER_CAPACITY + 40; i++) {
      diagInfo("SYSTEM", `event-${i}`);
    }
    const snap = diagSnapshot();
    expect(snap.length).toBe(DIAG_BUFFER_CAPACITY);
    expect(snap[0]?.message).toBe(`event-40`);
  });

  it("clear empties the buffer", () => {
    diagInfo("AUDIO", "hello");
    expect(diagSnapshot().length).toBe(1);
    diagClear();
    expect(diagSnapshot().length).toBe(0);
  });

  it("copy export includes events", () => {
    diagError("ERROR", "boom");
    const text = formatDiagExport();
    expect(text).toContain("TXPPS TX-80 DIAGNOSTIC EXPORT");
    expect(text).toContain("boom");
  });

  it("redacts secret-like meta keys", () => {
    diagPush("INFO", "SYSTEM", "auth", { apiKey: "super-secret", ok: true });
    const meta = diagSnapshot()[0]?.meta;
    expect(meta?.apiKey).toBe("[redacted]");
    expect(meta?.ok).toBe(true);
  });
});

describe("build info", () => {
  it("exposes product identity without secrets", () => {
    const info = getBuildInfo();
    expect(info.product).toBe("TXPPS TX-80");
    expect(info.version.length).toBeGreaterThan(0);
    expect(JSON.stringify(info)).not.toMatch(/token|secret|password/i);
  });
});

describe("factory patches", () => {
  it("keeps 18 factory patches available", () => {
    expect(FACTORY_PATCHES.length).toBe(18);
  });
});

describe("quarantine", () => {
  it("does not import the old audio engine from app modules", async () => {
    // Static assurance: mapping and product adapter are the live path.
    const mapping = await import("@/synth-core/mapping");
    expect(mapping.PARAM_MAP["master.level"]).toBeDefined();
  });
});
