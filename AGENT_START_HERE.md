# TXPPS TX27 — Agent Start Here

**Current gate:** Gate 2 complete and validated. Gate 3 is ready but not
started or authorized; status is in `CURRENT_STATUS.md`.

## Read first

1. `CURRENT_STATUS.md` — verified state and known failures
2. `FEATURE_REGISTRY.md` — feature truth labels
3. `src/lib/synth/contracts.ts` — reusable engine boundary
4. `src/lib/tx27/productAdapter.ts` — TX27 product adapter
5. `native-reference/tx27/` — web/native contract

## Ownership boundary

- Reusable: `src/lib/synth/` (contracts, runtime, compile proof)
- TX27 product: `src/lib/tx27/`, `src/lib/audio/`, `src/components/tx27/`
- Application route: `src/routes/index.tsx`
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
