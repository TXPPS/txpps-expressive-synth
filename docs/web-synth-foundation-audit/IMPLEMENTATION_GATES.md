# Implementation Gates

**Rule:** Do not proceed past a failed gate. This audit stops at **Gate 1** pending approval.

---

## Gate 0 — Source integrity

| Check                           | Result                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------- |
| Source located and complete     | **PASS** (canonical path; requested alias path missing)                      |
| Builds                          | **PASS** (`bun run build`, SW inject OK)                                     |
| Represents latest intended DX27 | **CONDITIONAL PASS** — HEAD has cold-launch fixes; dirty tree slightly ahead |
| Clean install verified          | **NOT RUN** this session                                                     |
| Lint clean                      | **FAIL** (CRLF prettier — non-blocking for integrity)                        |
| Tests                           | **N/A / FAIL** (none exist)                                                  |

**Gate 0 status: PASS WITH EXCEPTIONS** (document dirty tree + lint noise; build OK).

---

## Gate 1 — Audit acceptance

| Deliverable                | Path                                  |
| -------------------------- | ------------------------------------- |
| Current-state audit        | `DX27_CURRENT_STATE_AUDIT.md`         |
| Reusability classification | `REUSABILITY_CLASSIFICATION.md`       |
| Audio lifecycle            | `AUDIO_LIFECYCLE_AUDIT.md`            |
| PWA offline                | `PWA_OFFLINE_AUDIT.md`                |
| Device/MIDI                | `DEVICE_AND_MIDI_COMPATIBILITY.md`    |
| Extraction plan            | `FOUNDATION_EXTRACTION_PLAN.md`       |
| Architecture               | `PROPOSED_FOUNDATION_ARCHITECTURE.md` |
| Native equivalence         | `NATIVE_EQUIVALENCE_PLAN.md`          |
| Test gaps                  | `TEST_GAP_REPORT.md`                  |
| Risks                      | `RISK_REGISTER.md`                    |
| Decisions                  | `DECISION_LOG.md`                     |
| Gates                      | `IMPLEMENTATION_GATES.md`             |

**Gate 1 status: ACCEPTED (2026-07-17).**

Approval means: docs accepted, D4–D11 direction agreed (or amended), authorization to start Gate 2 only.

---

## Gate 2 — Extraction boundary

Exit criteria:

- [x] `SynthEngine` interface wraps TX27 in place (no file moves required)
- [x] List of files to move vs stay accepted from Gate 1 classification
- [x] P0 unit tests for sanitizer + lifecycle mocks green
- [x] No DX27 sound behavior change; approved persistence/lifecycle fixes only

**Gate 2 status: COMPLETE — PASS.** Build, 21 tests, typecheck, targeted lint,
service-worker generation, local HTTP launch, 40 browser/emulation checks, and
critical physical-device smoke pass.

### Gate 2 validation pass (2026-07-17)

Browser/device smoke completed against the real production build served by
`wrangler dev` (see `GATE_2_DEVICE_SMOKE_MATRIX.md`). A minimal Playwright
layer (`tests/e2e/`) adds 40 checks:

- [x] Desktop Chromium + Microsoft Edge: launch, gesture audio start,
      first-note preservation, note on/off, rapid-activation dedup, panic,
      reconnect, background/visibility release
- [x] Offline/PWA: SW register+control, precache, offline reload, no CDN,
      content-hash cache version + build id, old-cache cleanup
- [x] Preset/state: `glideMode` UI→storage persistence, settings separation,
      factory preset navigation
- [x] Responsive emulation: iPhone (WebKit), Pixel 7 + Galaxy Tab S4 (Chromium),
      portrait + landscape
- [x] Physical iOS/Android critical smoke: Apple iPhone 16 Pro Max (Safari +
      Home Screen PWA) and Samsung Galaxy Tab A11 (Chrome + installed Android
      PWA) pass launch, audio/first note, touch, responsive orientation,
      background recovery, preset, and panic behavior
- [ ] Offline/airplane-mode physical relaunch — non-blocking Gate 5 follow-up
- [ ] Acoustic/spectral audio behavior — not observable headless (Gate 5)

**Gate 2 validation decision: PASS.**
**Physical addendum: PHYSICAL DEVICE VALIDATION PASS.**
No Gate 2-caused regression or critical physical failure was found; no
production behavior changed. Gate 3 is ready to begin when explicitly
authorized.

---

## Gate 3 — Foundation skeleton

Exit criteria:

- [ ] `foundation/` + `contracts/` exist with A-class modules only
- [ ] `AGENT_START_HERE.md` + `FEATURE_REGISTRY.json`
- [ ] TX27 still runs via adapter
- [ ] No speculative optional packages

---

## Gate 4 — DX27 migration

Exit criteria:

- [ ] Product code under `products/tx27` (or equivalent)
- [ ] Functional parity checklist signed (audio, PWA, presets, UI modes)
- [ ] Known defects R1–R5 addressed or explicitly waived

---

## Gate 5 — Regression validation

Exit criteria:

- [x] P0 automated tests green (unit + browser smoke; Gate 2 pass)
- [x] Desktop matrix recorded in registry (Chromium + Edge)
- [x] **Physical** critical matrix recorded for iPhone 16 Pro Max Safari + Home Screen
      PWA and Galaxy Tab A11 Chrome + installed Android PWA
- [ ] Offline airplane relaunch verified on a physical device
- [ ] Installed-PWA direct-to-instrument verified on a physical device
- [ ] Acoustic/spectral audio + CPU/leak tests
- [ ] Clean ZIP packaging script works without `node_modules`/`.output`

---

## Gate 6 — Second-synth proof

Exit criteria:

- [ ] Minimal 5-voice subtractive product using foundation
- [ ] Zero imports from TX27 FM modules
- [ ] Shares PWA + lifecycle + keyboard
- [ ] Proves engine replacement

**Not** the commercial Prophet-inspired instrument.

---

## Gate 7 — Foundation release

Exit criteria:

- [ ] Versioned tag
- [ ] Native-reference templates complete
- [ ] Docs token-budgeted
- [ ] Packaged archive preserved

---

## Authorization stop

**Gate 2 is complete and Gate 3 is ready for explicit authorization. Do not
begin Gate 3 or P5IVE in this documentation-closeout task.**
