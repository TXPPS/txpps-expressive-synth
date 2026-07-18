# TX27 Feature Registry

Labels: **Verified** = code/build/test evidence; **Documented** = specified but not runtime-tested; **Missing** = absent; **Experimental** = compile/simulation proof only.

Additional labels: **Verified (browser)** = real-browser Playwright evidence
against the production build; **Verified (physical)** = observed on the named
physical device.

| Feature                              | Status                        | Evidence                                                    |
| ------------------------------------ | ----------------------------- | ---------------------------------------------------------- |
| Production build                     | Verified                      | `bun run build`                                            |
| PWA manifest + versioned precache    | Verified (browser)            | SW registers/controls + precache populated (offline e2e)   |
| Offline after warm cache             | Verified (browser)            | offline reload usable on built app (`offline-pwa.e2e.ts`)  |
| Airplane-mode relaunch (physical)    | NOT TESTED                    | planned on iPhone 16 Pro Max + Galaxy Tab A11              |
| No remote CDN at runtime             | Verified (browser)            | same-origin request assertion                              |
| Cache version = content hash + build | Verified (browser)            | served `sw.js` assertion + old-cache cleanup present       |
| Gesture-gated audio lifecycle        | Verified (browser + unit sim) | `lifecycle.e2e.ts` + `src/lib/synth/runtime.test.ts`       |
| Activation deduplication             | Verified (browser + unit sim) | rapid-activation e2e + runtime test                        |
| Late-resume status reconciliation    | Verified (unit simulation)    | runtime test                                               |
| First-note preservation              | Verified (browser + unit sim) | first-note e2e (diag trace) + runtime test                 |
| Background/visibility note release   | Verified (browser)            | held-note release on visibilitychange (`lifecycle.e2e.ts`) |
| Panic / all-notes-off                | Verified (browser)            | Chromium + Edge e2e                                        |
| TX27 FM DSP / presets / UI           | Verified (build)              | product code unchanged except adapter routing              |
| Stable product parameter IDs         | Verified                      | `src/lib/tx27/parameters.ts` + tests                       |
| `glideMode` UI→storage persistence   | Verified (browser + unit)     | `preset-state.e2e.ts` + migration/import/storage tests     |
| Responsive layout (emulation)        | Verified (emulation)          | 6 emulated devices, portrait+landscape (`responsive.e2e.ts`)|
| Non-FM engine compatibility          | Experimental                  | silent compile proof only                                  |
| Hardware Web MIDI                    | Missing                       | no `requestMIDIAccess`                                     |
| iOS Web MIDI                         | Missing / platform-limited    | standard Web MIDI unavailable in Safari                   |
| iPhone 16 Pro Max Safari             | Verified (physical)           | launch/audio/first note/touch/layout/recovery/preset/panic |
| iPhone 16 Pro Max installed PWA      | Verified (physical)           | installed launch + critical smoke; offline/airplane N/T    |
| Galaxy Tab A11 Chrome                | Verified (physical)           | launch/audio/first note/touch/layout/recovery/preset/panic |
| Galaxy Tab A11 installed PWA         | Verified (physical)           | installed launch + critical smoke; offline/airplane N/T    |
| JUCE implementation                  | Missing                       | translation contract only                                 |
| P5IVE product                        | Missing by design             | explicitly out of scope                                   |
