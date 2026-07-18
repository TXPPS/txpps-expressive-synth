import { describe, expect, it } from "vitest";
import type { SynthEngine } from "./contracts";
import { ProofSubtractiveEngine, type ProofSubtractiveState } from "./proofEngine";

describe("non-FM compile proof", () => {
  it("implements the shared engine contract without TX27 state", async () => {
    const engine: SynthEngine<ProofSubtractiveState> = new ProofSubtractiveEngine();
    await engine.start();
    expect(engine.isRunning()).toBe(true);
    expect(engine.setParameter("filter.cutoff", 50000)).toBe(20000);
    expect(engine.exportState()).toEqual({ cutoff: 20000 });
  });
});
