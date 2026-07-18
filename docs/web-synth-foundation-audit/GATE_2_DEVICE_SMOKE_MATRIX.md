# Gate 2 — Browser / Device Smoke Matrix

**Date:** 2026-07-17
**Repo:** `C:\Users\TXPPS\Documents\APP Builds\TXPPS-TX27-FM-Synth`
**Baseline:** `main` @ `821640d` (+ accepted Gate 2 working tree)
**Automated server under test:** real production build (`.output`,
nitro/Cloudflare Worker) served locally via `wrangler dev` on
`http://127.0.0.1:8788` — the actual `sw.js`, precache, and SSR shell, **not**
the Vite dev server.

**Canonical physical-device target:** the HTTPS production deployment
`https://txpps-tx27.toppsmusicproductions.workers.dev`. It was reachable when
this addendum was prepared. Before testing, record the deployment/build ID from
SETUP → STARTUP DIAGNOSTICS and confirm it is the intended Gate 2 build; do not
attribute results to an unknown or stale deployment.

## Test-type legend

| Code    | Meaning                                                    |
| ------- | --------------------------------------------------------- |
| **AUT** | Automated unit / simulation (Vitest)                      |
| **DSK** | Desktop manual/automated browser test (real Chromium)     |
| **EMU** | Browser device **emulation** (NOT physical hardware)      |
| **PWA** | Offline / service-worker runtime test on the built app    |
| **iOS** | Physical iPhone/iPad test                                 |
| **AND** | Physical Android test                                     |
| **N/T** | Not tested                                                |

## Tooling / engines used

| Engine        | Build / version                              | Used for                          |
| ------------- | -------------------------------------------- | --------------------------------- |
| Chromium      | Playwright 1.61.1 bundled (headless-shell)   | Desktop Chrome + Android/tablet EMU |
| Microsoft Edge| `msedge` channel `150.0.4078.65`             | Desktop Edge smoke (Chromium)     |
| WebKit        | Playwright WebKit 26.5 (v2311)               | iPhone/iPad EMU (Safari engine)   |

> WebKit-on-Windows is the closest available engine to iOS Safari and is used
> for iPhone **emulation only**. It is not a substitute for physical iOS.

## Coverage matrix

| Area                                   | AUT | DSK (Chrome) | DSK (Edge) | EMU | PWA | iOS | AND |
| -------------------------------------- | --- | ------------ | ---------- | --- | --- | --- | --- |
| Cold launch / arm state                | ✔   | ✔            | ✔          | ✔   | –   | ✔   | ✔   |
| Reload / hard reload                   | –   | ✔            | –          | –   | ✔   | N/T | N/T |
| First-note-during-activation preserved | ✔   | ✔            | ✔          | –   | –   | ✔   | ✔   |
| Note on/off + multiple notes           | ✔   | ✔            | ✔          | –   | –   | N/T | N/T |
| Rapid repeated activation (dedup)      | ✔   | ✔            | –          | –   | –   | N/T | N/T |
| Panic / all-notes-off                  | ✔   | ✔            | ✔          | –   | –   | ✔   | ✔   |
| Power off → re-activate (reconnect)    | ✔   | ✔            | –          | –   | –   | N/T | N/T |
| Background / visibility note release   | –   | ✔            | –          | –   | –   | ✔   | ✔   |
| Suspended/closed/timeout/late-resume   | ✔   | –            | –          | –   | –   | N/T | N/T |
| Preset change / navigation             | ✔   | ✔            | –          | –   | –   | ✔   | ✔   |
| `glideMode` UI → storage persistence   | ✔   | ✔            | –          | –   | ✔   | N/T | N/T |
| Settings persistence (separate state)  | ✔   | ✔            | –          | –   | –   | N/T | N/T |
| No horizontal scroll                   | –   | –            | –          | ✔   | –   | N/T | ✔   |
| Controls within viewport               | –   | –            | –          | ✔   | –   | ✔   | ✔   |
| SETUP open/close within viewport       | –   | –            | –          | ✔   | –   | N/T | N/T |
| Keyboard present/playable              | –   | ✔            | ✔          | ✔   | –   | ✔   | ✔   |
| Service worker registers + controls    | –   | –            | –          | –   | ✔   | N/T | N/T |
| Precache populated                     | –   | –            | –          | –   | ✔   | N/T | N/T |
| Offline reload usable                  | –   | –            | –          | –   | ✔   | N/T | N/T |
| No remote CDN at runtime               | –   | –            | –          | –   | ✔   | N/T | N/T |
| Cache version = content hash + build id| –   | –            | –          | –   | ✔   | N/T | N/T |
| Old-cache cleanup                      | –   | –            | –          | –   | ✔   | N/T | N/T |
| Airplane-mode relaunch                 | –   | –            | –          | –   | –   | N/T | N/T |
| Installed-PWA direct-to-instrument     | –   | –            | –          | –   | –   | ✔   | ✔   |

Legend: ✔ = covered/passed · – = not applicable to that type · N/T = not tested.

## Emulated device set (EMU)

All passed responsive checks (no horizontal scroll, controls in viewport,
SETUP open/close, keyboard present):

| Emulated device        | Engine   | Orientation |
| ---------------------- | -------- | ----------- |
| iPhone 13              | WebKit   | portrait    |
| iPhone 13              | WebKit   | landscape   |
| Pixel 7                | Chromium | portrait    |
| Pixel 7                | Chromium | landscape   |
| Galaxy Tab S4          | Chromium | portrait    |
| Galaxy Tab S4          | Chromium | landscape   |

## Physical-device validation addendum

Canonical initial physical devices:

| Device | OS / browser version | Test surfaces | Current result |
| ------ | -------------------- | ------------- | -------------- |
| Apple iPhone 16 Pro Max | iOS: **TO RECORD** · Safari: **TO RECORD where visible** | Safari browser; installed Home Screen PWA | **PASS** |
| Samsung Galaxy Tab A11 | Android: **TO RECORD** · Chrome: **TO RECORD** | Chrome browser; installed Android PWA | **PASS** |

Emulation results are not physical-device results. Replace a result below only
with observed evidence from the named device and surface. Allowed values are
**PASS**, **PASS WITH EXCEPTION**, **FAIL**, and **NOT TESTED**.

### iPhone 16 Pro Max — Safari browser

| Network | Case | Result | Evidence / diagnostics / reproduction |
| ------- | ---- | ------ | -------------------------------------- |
| Online | Browser launch | **PASS** | Production/local HTTPS test flow |
| Online | No startup modal or large power screen | **NOT TESTED** | Not separately reported |
| Online | First interaction activates audio; first intentional note sounds | **PASS** | Audible first-note playback confirmed |
| Online | Retry after audio-start failure | **NOT TESTED** | — |
| Online | Background→foreground recovery | **PASS** | Return recovery confirmed |
| Online | Screen lock→unlock recovery | **NOT TESTED** | Not separately reported |
| Online | Suspended/interrupted AudioContext recovery | **NOT TESTED** | — |
| Online | Rapid repeated touches do not duplicate engine/runtime | **NOT TESTED** | — |
| Online | Preset interaction | **PASS** | Preset interaction confirmed |
| Online | `glideMode` and settings persistence | **NOT TESTED** | Not separately reported |
| Online | Panic/all-notes-off | **PASS** | Panic/audio stop behavior confirmed |
| Online | Portrait and landscape layout/orientation | **PASS** | Both orientations confirmed |
| Online | Orientation change while a note is active | **NOT TESTED** | Not separately reported |
| Online | General touch interaction | **PASS** | Physical touch interaction confirmed |
| Online | Touch cancellation produces no stuck note | **NOT TESTED** | — |
| Online | Audio/offline/update status is clear | **NOT TESTED** | — |
| Offline | Warm-cached Safari reload | **NOT TESTED** | — |

### iPhone 16 Pro Max — installed Home Screen PWA

| Network | Case | Result | Evidence / diagnostics / reproduction |
| ------- | ---- | ------ | -------------------------------------- |
| Online | Install and launch directly to instrument | **PASS** | Installed Home Screen PWA launch confirmed |
| Online | Audio startup and first-note playback | **PASS** | Confirmed on physical device |
| Online | Background→foreground recovery | **PASS** | Confirmed on physical device |
| Online | Preset interaction and panic/audio stop | **PASS** | Confirmed on physical device |
| Online | Portrait/landscape layout and touch interaction | **PASS** | Confirmed on physical device |
| Online | Retry, persistence, active-note orientation and touch cancellation | **NOT TESTED** | Not separately reported |
| Offline | Offline relaunch after successful cache warm-up | **NOT TESTED** | — |
| Airplane mode | Terminated-app relaunch and playable cached instrument | **NOT TESTED** | — |
| Online after offline | Reconnect/update status and non-mixed-version recovery | **NOT TESTED** | — |

### Samsung Galaxy Tab A11 — Chrome browser

| Network | Case | Result | Evidence / diagnostics / reproduction |
| ------- | ---- | ------ | -------------------------------------- |
| Online | Browser launch; audio startup and first-note playback | **PASS** | Production/local HTTPS test flow |
| Online | Background/foreground recovery | **PASS** | Return recovery confirmed |
| Online | Retry and repeated activation attempts | **NOT TESTED** | Not separately reported |
| Online | Screen lock/unlock recovery where practical | **NOT TESTED** | — |
| Online | Preset interaction | **PASS** | Preset interaction confirmed |
| Online | `glideMode` and settings persistence | **NOT TESTED** | Not separately reported |
| Online | Panic/all-notes-off | **PASS** | Panic/audio stop behavior confirmed |
| Online | Tablet portrait and landscape responsive layout | **PASS** | Both orientations confirmed |
| Online | Controls stay in sections / no horizontal scroll | **PASS** | No critical responsive-layout failure observed |
| Online | Active-note orientation change produces no stuck note | **NOT TESTED** | — |
| Online | General touch interaction | **PASS** | Physical touch interaction confirmed |
| Online | Multitouch keyboard and pointer cancellation | **NOT TESTED** | Not separately reported |
| Online | No controls hidden beneath the keyboard | **NOT TESTED** | Not separately reported |
| Online | Audio/offline/update status is clear | **NOT TESTED** | — |
| Offline | Warm-cached Chrome reload | **NOT TESTED** | — |

### Samsung Galaxy Tab A11 — installed Android PWA

| Network | Case | Result | Evidence / diagnostics / reproduction |
| ------- | ---- | ------ | -------------------------------------- |
| Online | Install and launch directly to instrument | **PASS** | Installed Android PWA launch confirmed |
| Online | Audio startup and first-note playback | **PASS** | Confirmed on physical device |
| Online | Background→foreground recovery | **PASS** | Confirmed on physical device |
| Online | Preset interaction and panic/audio stop | **PASS** | Confirmed on physical device |
| Online | Portrait/landscape layout and touch interaction | **PASS** | Confirmed on physical device |
| Online | Retry, persistence, multitouch and pointer cancellation | **NOT TESTED** | Not separately reported |
| Offline | Offline relaunch after successful cache warm-up | **NOT TESTED** | — |
| Airplane mode | Terminated-app relaunch and playable cached instrument | **NOT TESTED** | — |
| Update | Service-worker update activates without a broken mixed version | **NOT TESTED** | — |

### Evidence protocol

For each surface, record the exact OS/browser version, test time, deployed URL,
startup diagnostic build ID/mode/online/SW state, and result. For any exception
or failure, record deterministic steps, expected versus actual behavior,
whether audio was audible, the current and previous STARTUP DIAGNOSTICS text,
orientation/network state, and whether a force-quit/relaunch reproduces it.

Do not simulate an audio-start failure by corrupting production storage or
assets. If no natural failure occurs, mark retry-after-failure **NOT TESTED**;
the automated lifecycle simulation remains separate evidence.

## Result

40 browser/emulation checks + 21 automated unit/simulation tests pass against
the real production build. Physical browser and installed-PWA launch, audio
startup/first note, touch, responsive portrait/landscape layout,
background/return recovery, preset interaction, and panic/audio stop pass on
both canonical devices. No critical physical-device failure was observed.

Unreported OS/browser versions, offline/airplane-mode behavior, forced-failure
retry, screen-lock recovery, persistence, cancellation/multitouch specifics,
and service-worker update behavior remain **NOT TESTED** documentation gaps;
they do not block Gate 2 closure.

**Decision: GATE 2 VALIDATION PASS.**
**Physical addendum status: PHYSICAL DEVICE VALIDATION PASS.**
