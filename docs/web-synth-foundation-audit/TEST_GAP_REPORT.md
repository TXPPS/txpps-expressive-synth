# Test Gap Report

---

## Inventory

| Kind                       | Count   | Evidence                                 |
| -------------------------- | ------- | ---------------------------------------- |
| Unit tests                 | 0       | No `*.test.*` / `*.spec.*`               |
| Integration / E2E          | 0       | No Playwright/Cypress                    |
| DSP golden tests           | 0       | —                                        |
| `package.json` test script | Missing | —                                        |
| Test dependencies          | None    | —                                        |
| Manual QA docs             | Partial | `CLOUDFLARE_DEPLOYMENT.md` offline steps |

**Lint** exists but is currently red due to CRLF Prettier noise (~12k issues) — not a substitute for tests.

---

## Coverage assessment

| Area                           | Automated             | Simulated                         | Needs physical device  |
| ------------------------------ | --------------------- | --------------------------------- | ---------------------- |
| Unit: sanitize/migrate patches | Missing               | Easy                              | No                     |
| Unit: settings validation      | Missing               | Easy                              | No                     |
| DSP: algorithm routing         | Missing               | Possible with offline graph mocks | No                     |
| DSP: clipping / limiter        | Missing               | Analyser or offline render        | No                     |
| Audio startup state machine    | Missing               | Mock AudioContext                 | No                     |
| Repeated cold launches         | Missing               | Mock + fake timers                | iOS PWA yes            |
| Resume timeouts / late resume  | Missing               | Mock hanging resume               | Nice-to-have on device |
| Interrupted context            | Missing               | Mock state                        | iOS yes                |
| First-note preservation        | Missing               | Mock                              | iOS yes                |
| Voice stealing / stuck notes   | Missing               | Engine harness                    | Touch multi yes        |
| Preset migration / glideMode   | Missing               | **Should catch known defect**     | No                     |
| Offline launch                 | Missing               | Playwright offline                | Android/iOS PWA        |
| SW update / build mismatch     | Missing               | SW test harness                   | Optional               |
| Mobile layouts / orientation   | Missing               | Playwright viewports              | Real phones            |
| MIDI connect/disconnect        | N/A (feature missing) | —                                 | When added; not iOS    |
| Memory / AudioNode leaks       | Missing               | Long-run harness                  | Mid-tier phones        |
| CPU / voice count              | Missing               | —                                 | Low-end Android        |
| Browser matrix                 | Missing               | Smoke CI                          | Safari iOS critical    |

---

## Priority test backlog (foundation `testing/`)

### P0 — must before Gate 5

1. `sanitizeImportedPatch` preserves `glideMode`
2. Library v2 reload round-trip
3. AudioRuntime: suspended → running within timeout
4. AudioRuntime: resume hang → failed; late resume → reconciled state
5. Closed context → recover rebuild
6. Pending note queue flush / cancel on noteOff
7. Panic clears sustain + notes

### P1 — Gate 6

8. Second synth engine satisfies `SynthEngine` contract tests
9. ParameterContract schema validation
10. SW precache inventory non-empty + BUILD_ID injected

### P2 — product polish

11. Visual viewport smoke (Playwright)
12. Keyboard multi-pointer simulation
13. Reverb IR determinism (after seed fix)

---

## Physical device matrix (minimum)

| Device                 | Checks                                                              |
| ---------------------- | ------------------------------------------------------------------- |
| iPhone Safari          | Cold launch, background, silent switch note, standalone PWA offline |
| iPad                   | Landscape PLAY mode, multitouch glissando                           |
| Android Chrome         | Install PWA, offline, voice polyphony CPU                           |
| Desktop Chrome/Edge    | Keyboard, POWER cycles, SW update                                   |
| Desktop Safari (macOS) | Gesture unlock, suspend                                             |

Record results into `FEATURE_REGISTRY.json` so agents stop re-auditing.

---

## Recommendation

Add **Vitest** for unit/lifecycle mocks first (cheap, token-saving). Add Playwright only after lifecycle unit tests exist. Do not block foundation skeleton on full device lab — but **do** block Gate 7 release on P0 + one iOS cold-launch manual sign-off.
