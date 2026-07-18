# TXPPS TX-80 / TX27 — Agent Start Here

**This repository now ships TWO products on one foundation:**
TX-80 (dual-layer performance synth) at `/`, TX27 (FM synth, unchanged
behavior) at `/tx27`. TX-80 state and verification: `CURRENT_STATUS.md`.

## Read first

1. `CURRENT_STATUS.md` — verified state, audit findings, limitations
2. `ARCHITECTURE.md` — TX-80 design and signal path
3. `PARAMETER_MATRIX.md` — generated TX-80 parameter/validation matrix
4. `MANUAL_QA.md` — human verification still required
5. `src/lib/synth/contracts.ts` — reusable engine boundary
6. `src/lib/tx80/productAdapter.ts` — TX-80 product adapter

## Ownership boundary

- Reusable: `src/lib/synth/` (contracts, runtime, compile proof)
- TX-80 product: `src/lib/tx80/`, `src/components/tx80/`, `src/routes/index.tsx`
- TX27 product: `src/lib/tx27/`, `src/lib/audio/`, `src/components/tx27/`,
  `src/routes/tx27.tsx` (Keyboard/PerfStrip/Knob/TxSelect/dialog shells are
  shared with TX-80)
- PWA: `public/sw.js`, `src/lib/pwa.ts`, `scripts/inject-sw-precache.mjs`

## Commands

```text
bun run test
bun run typecheck
bun run build
bun run dev
```

## Hard rules

- Do not begin P5IVE in this repo/gate.
- Do not move systems into a final foundation layout before Gate 3 approval.
- Do not rename parameter IDs or storage keys without an explicit migration.
- Do not claim Web MIDI support or infer untested physical-device scenarios.
- The validated Gate 2 cold-launch work belongs in the authoritative commit.
- The unresolved `public/favicon.ico` deletion is not Gate 2 work; do not stage
  or alter it without an explicit asset decision.
- Do not mass-format line endings.
