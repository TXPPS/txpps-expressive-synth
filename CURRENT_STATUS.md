# Current Status

**Repository:** `C:\Users\TXPPS\Documents\APP Builds\TXPPS-TX27-FM-Synth`
**Baseline:** `main` at `821640d3a0581b87fced006a1d74228d87cda7ab`

## Gate 2

- **Verified:** product-neutral `SynthEngine<State>` boundary
- **Verified:** TX27 adapter retains FM engine behind the boundary
- **Verified:** stable TX27 parameter registry; settings remain separate
- **Verified:** `glideMode` survives sanitize, export/import, and current storage reload
- **Verified:** silent non-FM compile proof
- **Verified:** 21 Vitest simulations/tests, TypeScript, and targeted semantic lint
- **Verified:** production build and generated service worker (cache `32f37a3ad261`)
- **Verified:** local server launch and SSR shell HTTP smoke

## Gate 2 browser/device validation (2026-07-17)

Validated against the **real** production build (`.output`) served by
`wrangler dev`, using a minimal Playwright smoke layer (`tests/e2e/`). 40
browser/emulation checks pass alongside the 21 unit tests.

- **Verified (browser):** cold launch, gesture-driven audio start, first-note
  preservation, note on/off, rapid-activation dedup, panic, power-off→reconnect,
  background/visibility note release — Chromium + Microsoft Edge.
- **Verified (browser):** offline/PWA — SW registers/controls, precache
  populated, offline reload usable, no remote-CDN requests, content-hash cache
  version + build id, old-cache cleanup present.
- **Verified (browser):** `glideMode` UI→localStorage persistence across reload;
  settings persistence separate from patch; factory preset navigation.
- **Verified (emulation):** responsive layout on iPhone (WebKit), Pixel 7 and
  Galaxy Tab S4 (Chromium), portrait + landscape — no horizontal scroll,
  controls within viewport, SETUP + keyboard usable.
- **Verified (physical):** Apple iPhone 16 Pro Max (Safari + installed Home
  Screen PWA) and Samsung Galaxy Tab A11 (Chrome + installed Android PWA).
- **Physical PASS:** browser and installed-PWA launch, audio startup/first
  note, touch, portrait/landscape responsive layout, orientation,
  background/return recovery, preset interaction, and panic/audio stop.
- **No critical physical-device failures observed.**
- **Non-blocking NOT TESTED:** offline/airplane relaunch, forced audio failure
  retry, screen-lock recovery, persistence, active-note orientation/touch
  cancellation, multitouch specifics, and service-worker update behavior.
- **TO RECORD:** exact iOS/Safari and Android/Chrome versions.
- **Test target:** reachable HTTPS production deployment
  `https://txpps-tx27.toppsmusicproductions.workers.dev`; the deployed build ID
  must be recorded from STARTUP DIAGNOSTICS before testing.

**Gate 2 validation decision: PASS.**
**Physical addendum: PHYSICAL DEVICE VALIDATION PASS.**
**Gate 2 is complete; Gate 3 is READY but NOT STARTED and may begin only when
explicitly authorized.**
See `docs/web-synth-foundation-audit/GATE_2_DEVICE_SMOKE_MATRIX.md`.

## Pre-existing work preserved

- Modified `src/routes/index.tsx` cold-launch refinements
- Modified/generated `src/routeTree.gen.ts` line-ending state
- Deleted `public/favicon.ico`
- Untracked Gate 1 audit documents under `docs/web-synth-foundation-audit/`
- Gate 2 boundary files (synth contracts/runtime, tx27 adapter/parameters, tests)

## Validation infrastructure added (no production behavior change)

- `playwright.config.ts`, `tests/e2e/*.e2e.ts` — browser smoke layer
- `scripts/launch-local.mjs` + `start:local` / `serve:prod` / `test:e2e` scripts
- `.gitignore` entries for Playwright artifacts

## Known unresolved product defects (Gate 2 observation)

Not fixed in this pass (pre-existing, not caused by Gate 2, not blocking
validation). Headless audio has no acoustic/spectral output, so sound-design
defects cannot be observed automatically:

- Active FM voices not receiving all operator/algorithm edits — **Not tested**
  (requires audio-perception / spectral analysis)
- Mono retune changing effective FM index — **Not tested** (requires spectral
  analysis)
- Vintage drift affecting amplitude rather than pitch — **Not tested**
  (requires spectral analysis)
- Start-during-stop overlap dropping notes — **Not reproduced** in browser
  smoke (power-off→reconnect and rapid-activation dedup pass); a targeted
  timing test is still needed for the specific overlap race
- Global lint remains noisy from pre-existing CRLF formatting — unchanged

No Gate 2-caused regression was found, so no regression test was required this
pass. No Gate 3 extraction and no P5IVE implementation have begun.
