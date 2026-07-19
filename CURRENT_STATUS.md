# TXPPS TX-80 — Current Status

**Phase**: Gate 1 + Gate 2 integrated on `main` (authoritative).
**Last update**: 2026-07-19

## Branch authority

- **`main` is the sole active development branch.** All new TX-80 work must branch from `main`.
- Gate 1 (synth-core transplant + mapping) and Gate 2 (runtime switchover, UI wiring, branding, interaction lock, diagnostics) are **integrated** into `main`.
- **`feat/gate2-runtime-switchover`** is retained on the remote as historical evidence of the Gate 2 line of work. Do not treat it as the active development tip.
- **Archive / reference branches are rollback and history only** — do not develop on them:
  - `archive/pre-gate2-main` — remote `main` immediately before Gate 1+2 promotion (`ad15b8e`)
  - `archive/m2-copilot-audio` — Milestone-2 audio checkpoint (same SHA as pre-gate2 main)
  - `reference/claude-tx80-96c97e2` — donor reference tree
  - `feat/gate1-synth-core-transplant` — Gate 1 feature tip (historical)
- Public preview is built and deployed **from `main`**:
  https://txpps-tx-80.toppsmusicproductions.workers.dev/

Resume development:

```bash
git checkout main && git pull --ff-only origin main
```

## Gate 2 — COMPLETE (on main)

Production audio routes exclusively through the transplanted synth-core
runtime: Zustand → `mapping.ts` → `TX80ProductEngine` → `TX80Engine` →
one `AudioContext`. Bridge: `src/hooks/useAudioEngine.ts`.

Included on main:

- Authoritative synth-core runtime; fixed first-note; note ownership;
  same-note stacking; safe voice stealing; sustain; panic
- Ribbon modes (continuous / glissando / hold); pitch and mod controls;
  touch-friendly sustain; Master/Performance controls
- 18 factory patches; FULL / EDIT / PLAY modes
- UI selection lock; selectable diagnostic terminal; SETTINGS interface
- Custom TXPPS favicon and PWA icons; no Lovable product branding
- Production Workers deployment configuration
- Quarantined legacy `src/audio/` (not in the live module graph; retained
  until a later removal gate)

Automated checks (Gate 2 tip / post-merge main): typecheck ✓ · unit 35/35 ✓ ·
lint clean on changed files ✓ · build ✓ · Playwright 20/20 ✓.

**Physical phone and human-listening validation still required.**

Details: `docs/TX80_GATE2_RUNTIME_SWITCHOVER.md`,
`docs/TX80_CONTROL_CONNECTION_AUDIT.md`,
`docs/TX80_DIAGNOSTIC_TERMINAL.md`,
`docs/TX80_NEXT_ROADMAP.md`.

## Gate 1 — COMPLETE (on main)

Strategy A: this repository/`main` is the permanent product home; the Claude
TX-80 tree was a **donor** of proven engine subsystems only.

- Dark transplant under `src/synth-core/` with provenance
- UI↔engine parameter mapping (`src/synth-core/mapping.ts`)
- npm canonical package manager; IPv4 Vite bind

## Deferred (honest — not started)

| Item | Status |
|------|--------|
| MIDI input / output | Deferred Gate 5 — SETTINGS MIDI disabled with explanation |
| Ribbon **trigger** mode | Deferred Gate 7 — disabled with explanation |
| Unmapped layer knobs (`osc.pwm`, `filt.type`, `filt.drive`, `layer.modAmt`) | Deferred Gate 6 |
| Removal of quarantined `src/audio/` | Later removal gate — files stay until approved |
| Physical-device multitouch / iOS Safari | Still required |
| Human listening / audible quality sign-off | Still required |

## Quarantine note

`src/audio/` remains in the tree with **zero live imports**. Do not delete
it during routine development. A dedicated removal gate will retire it.

---

## Historical — Milestone 1 shell status (pre-reconciliation)

Preserved below for archaeology. Do not treat as current product truth.

**Milestone**: 1 of 7 — Responsive shell (superseded by Gates 1–2 on main)

### Verification vocabulary
- **implemented** = code exists
- **build-verified** = build compiles it
- **preview-verified** = observed in live preview
- **manually-exercised** = clicked / touched / played in preview
- **device-tested** = tested on target device / orientation
- **unverified** = not yet observed
- **defective** = observed to be broken
