# TXPPS TX-80

Expressive dual-layer browser synthesizer for TXPPS.

## Branch authority

**`main` is the sole active development branch.** Gate 1 and Gate 2 are
integrated there. Branch all new work from `main`:

```bash
git checkout main && git pull --ff-only origin main
```

Historical / rollback refs (do not develop on these):

| Ref | Role |
|-----|------|
| `feat/gate2-runtime-switchover` | Gate 2 feature history |
| `archive/pre-gate2-main` | `main` before Gate 1+2 promotion |
| `archive/m2-copilot-audio` | Milestone-2 audio checkpoint |
| `reference/claude-tx80-96c97e2` | Donor reference tree |

## Public preview

https://txpps-tx-80.toppsmusicproductions.workers.dev/

Deployed from `main` via Cloudflare Workers.

## Develop locally

```bash
npm install
npm run dev
```

Checks:

```bash
npm run typecheck
npm run test
npm run lint
npm run build
npx playwright test tests/e2e/gate2-runtime.e2e.ts
```

## Status

See `CURRENT_STATUS.md` and `docs/TX80_NEXT_ROADMAP.md`.

Live audio path: Zustand → `src/synth-core/mapping.ts` → product engine →
one `AudioContext`. Legacy `src/audio/` is quarantined (not live).

## Package manager

**npm** is canonical (`package-lock.json`). Do not reintroduce Bun lockfiles
as the source of truth.
