# Device and MIDI Compatibility

---

## Platforms (honest)

| Platform                            | Code support                                 | Claim level                                                  |
| ----------------------------------- | -------------------------------------------- | ------------------------------------------------------------ |
| Desktop Chromium / Firefox / Safari | Full Web Audio path                          | Present; QA unverified                                       |
| Windows / macOS browsers            | Same                                         | Present                                                      |
| Android Chrome (browser + PWA)      | Touch + PWA meta                             | Present; device unverified                                   |
| iPhone / iPad Safari                | Gesture unlock, interrupted, closed rebuild  | Partial; device unverified                                   |
| iOS installed PWA                   | `apple-mobile-web-app-*`, standalone display | Partial; device unverified                                   |
| Web MIDI hardware                   | —                                            | **Missing — do not claim**                                   |
| iOS Web MIDI                        | N/A                                          | **Unsupported by platform; must stay documented as limited** |

---

## Responsive UI — Verified / Partial

| Concern                            | Status                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| Portrait / landscape branching     | Verified (`matchMedia`)                                                                           |
| Phone width ≤767px                 | Verified                                                                                          |
| PLAY vs FULL modes                 | Verified                                                                                          |
| `100dvh` + `overflow-hidden` shell | Verified                                                                                          |
| Safe-area insets                   | Verified (`env(safe-area-inset-*)`, `viewport-fit=cover`)                                         |
| Keyboard width via ResizeObserver  | Verified (7/10/14 white keys)                                                                     |
| Touch targets                      | Partial — performance controls OK; dense knobs small                                              |
| Overflow / clipped overlays        | Present careful dialog focus; physical overflow QA unverified                                     |
| Screen-reader labels               | Partial (`aria-*` on key controls)                                                                |
| Focus management                   | Partial — dialogs trap/return                                                                     |
| Pinch zoom                         | **Disabled** (`maximum-scale=1, user-scalable=no`) — intentional instrument choice; a11y tradeoff |
| `prefers-reduced-motion`           | **Missing**                                                                                       |
| Light / system theme               | **Missing** — fixed dark hardware aesthetic                                                       |
| Low-power performance              | Unverified (12-voice FM + FX + rAF meter)                                                         |

### Shell vs product

- **Shell:** `__root.tsx` (document, meta, SW, errors)
- **Product:** `index.tsx` + `components/tx27/*`

Foundation should keep shell + layout primitives; leave FM panels in product.

---

## Input — Verified

| Feature              | Status             | Notes                                                |
| -------------------- | ------------------ | ---------------------------------------------------- |
| On-screen keyboard   | Verified           | Pointer Events                                       |
| Multi-touch          | Verified           | `Map` by `pointerId`                                 |
| Glissando            | Verified           | `elementFromPoint` + `data-note`                     |
| Pointer capture      | Verified           |                                                      |
| Note-off reliability | Verified           | blur, visibility, cancel, range change, library open |
| Computer keyboard    | Verified           | Two-octave map; z/x octave                           |
| Octave shift         | Verified           | 1–7                                                  |
| Velocity             | Fixed 0.85 / 0.9   | **Not expressive**                                   |
| Pitch bend           | On-screen strip    | Not from computer keys                               |
| Mod wheel            | On-screen latching | Panic does not clear MOD                             |
| Sustain              | Space + SUS button | Verified                                             |
| Panic                | Verified           | Stuck-note clear                                     |

---

## MIDI — Missing (explicit)

There is **no** `navigator.requestMIDIAccess`, no MIDI message handler, no channel select, no MIDI learn, no MIDI indicator.

Docs correctly avoid claiming hardware MIDI. Foundation plan must:

1. Add optional Web MIDI module (**B**) with capability detection
2. Surface **unsupported** on iOS Safari in UI copy
3. Never imply universal MIDI

---

## Settings / diagnostics inventory

| Setting                          | Exists                                 | Reusable?                                    |
| -------------------------------- | -------------------------------------- | -------------------------------------------- |
| Bend range 1–12 ST               | Yes                                    | Yes (global perf)                            |
| Confirm preset change            | Yes                                    | Yes                                          |
| Startup diagnostics viewer       | Yes                                    | Optional B                                   |
| Reset settings                   | Yes                                    | Yes                                          |
| Theme                            | No                                     | Propose later only if multi-product needs it |
| Audio quality / sample rate / OS | No                                     | Report-only diagnostics later                |
| Oversampling                     | No                                     | Product DSP choice                           |
| Polyphony                        | Patch param (4/8/12)                   | Product                                      |
| MIDI settings                    | No                                     | When MIDI exists                             |
| Touch keyboard settings          | No                                     | Optional                                     |
| Animation settings               | No                                     | Optional                                     |
| Reset audio                      | Via POWER/RETRY + panic                | Promote explicit “Reset audio”               |
| Clear cache                      | No                                     | Needed for support                           |
| App / engine version             | UI `v1.0.0` + build SHA in diagnostics | Formalize                                    |
| Offline / update status          | Implicit                               | Surface in diagnostics                       |

---

## Foundation implication

Ship **DeviceCapability** reporter (A): Web Audio, MIDI API presence, standalone display, touch points, reduced-motion preference — without claiming features that fail the probe.
