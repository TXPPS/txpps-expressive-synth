# Device Limitations

**Status:** Documented from platform behavior. Gate 2 validation added desktop
(Chromium + Edge), offline/PWA, and browser-emulation evidence (iPhone via the
WebKit engine; Android/tablet via Chromium). It did **not** add physical iOS or
Android device evidence. The physical addendum now passes on an iPhone 16 Pro
Max and Samsung Galaxy Tab A11 for critical browser/PWA launch, audio,
first-note, touch, responsive layout/orientation, background recovery, preset,
and panic behavior. No critical physical-device failure was observed.

## Environment limits of the Gate 2 validation pass

- Browser emulation (Playwright device descriptors) is **not** physical
  hardware. iPhone emulation uses the WebKit engine on Windows, the closest
  available approximation to iOS Safari — real iOS quirks (silent switch,
  `interrupted` state, `resume()` hangs, install banner, home-screen launch)
  are not exercised.
- Headless audio uses a null/silent output backend: `AudioContext` reaches
  `running` on a real gesture, but no acoustic output or spectral behavior is
  verified. Sound-design defects cannot be observed this way.
- Installed-PWA launch passes on both canonical devices.
- Airplane-mode and explicit offline relaunch remain **NOT TESTED**.

## Canonical physical-device scope

- **Apple iPhone 16 Pro Max:** Safari browser and installed Home Screen PWA
  critical smoke **PASS**. Exact iOS and Safari versions remain **TO RECORD**.
- **Samsung Galaxy Tab A11:** Chrome browser and installed Android PWA critical
  smoke **PASS**. Exact Android and Chrome versions remain **TO RECORD**.
- Physical testing must use the production HTTPS deployment (or another
  production-equivalent secure HTTPS deployment) and record the startup
  diagnostic build ID. A LAN development server is not installed-PWA proof.
- Online, browser-offline, and airplane-mode results are separate; success in
  the confirmed online/HTTPS flow does not imply success in the still-untested
  offline or airplane-mode flows.

## Platform behavior (design-level)

- Web Audio requires a user gesture on mobile.
- iOS may report non-standard `interrupted`, hang `resume()`, or close a context.
- The runtime tests are simulations, not iPhone/iPad validation.
- Standard Web MIDI is not available in iOS Safari; TX27 implements no Web MIDI on any platform.
- Bluetooth adds platform/device latency.
- Offline launch requires a successfully installed/controlling service worker and prior cache warm-up.
- First-ever offline load cannot work.
- Silent switch / OS audio policy can affect iOS output.
- Background execution is constrained; notes are released and recovery waits for a new gesture.
