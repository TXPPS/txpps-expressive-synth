# Validation Tests

**Status:** Gate 2 validation complete. Unit/simulation, desktop browser,
browser emulation, and critical physical-device smoke pass.

Automated (`bun run test`):

- Patch defaults and malformed-value sanitization
- `glideMode` sanitize, storage reload, and export/import round-trip
- Stable parameter IDs, set/serialize/restore, clamping, invalid rejection
- Suspended/interrupted startup simulations
- Closed-engine recreation
- Resume timeout, retry, and late-success reconciliation
- Activation deduplication
- First-note queue/cancel and panic
- Non-FM compile proof

Build (`bun run build`):

- Client/SSR/Worker output
- Service-worker precache and build ID injection

Browser / emulation smoke (`bun run test:e2e`, Playwright against the real
`wrangler dev` production build — see `playwright.config.ts` and
`tests/e2e/`). 40 checks, all passing:

- Desktop Chromium + Microsoft Edge: cold launch, gesture-driven audio start,
  first-note preservation, note on/off, rapid activation dedup, panic,
  power-off→reconnect, background/visibility note release.
- Offline/PWA (Chromium): SW registers + controls page, precache populated,
  offline reload stays usable, no remote-CDN runtime requests, injected
  content-hash cache version + build id, old-cache cleanup present.
- Preset/state (Chromium): `glideMode` UI→localStorage persistence across
  reload, settings persistence (separate from patch), factory preset
  navigation, quick-access open/dismiss.
- Responsive emulation (iPhone via WebKit; Pixel 7 + Galaxy Tab S4 via
  Chromium; portrait + landscape): no horizontal scroll, controls within
  viewport, SETUP open/close, keyboard present/playable.

Local run:

- `bun run test` — unit/simulation (21)
- `bun run build` then `bun run test:e2e` — browser smoke (40)
- `bun run test:e2e:build` — build + browser smoke in one command
- `bun run start:local` — build + serve production + open browser once

Physical addendum completed:

- HTTPS production deployment:
  `https://txpps-tx27.toppsmusicproductions.workers.dev`
- iPhone 16 Pro Max: Safari browser and installed Home Screen PWA pass for
  launch, audio startup/first note, touch, responsive portrait/landscape,
  background/return, presets, and panic/audio stop.
- Samsung Galaxy Tab A11: Chrome browser and installed Android PWA pass for
  the same critical smoke cases.
- No critical physical-device failure was observed.
- Exact iOS/Safari and Android/Chrome versions remain **TO RECORD**.
- Use only PASS, PASS WITH EXCEPTION, FAIL, or NOT TESTED. Do not infer
  unobserved cases.

Non-blocking documentation / later regression gaps:

- Installed-PWA airplane-mode relaunch on both devices
- Warm-cached browser/PWA offline relaunch
- Forced audio-start failure/retry, screen-lock recovery, persistence,
  active-note orientation/cancellation, multitouch specifics, and Android
  service-worker update behavior
- Audio golden/CPU/leak tests
