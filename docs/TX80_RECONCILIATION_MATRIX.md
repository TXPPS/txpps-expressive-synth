# TX-80 Reconciliation Matrix

**A** = `txpps-expressive-synth` `main` @ `ad15b8e` (Lovable M1 shell +
Copilot audio). **B** = `txpps/txpps-tx-80`
`claude/tx80-synth-completion-nkt36a` @ `96c97e2` (TX27-foundation build).
"Verified" = observed this audit/session; "code" = established by reading
source; "—" = absent.

| Axis | A (main / Copilot) | B (Claude branch) |
| --- | --- | --- |
| Framework | TanStack Start, React 19, Vite 8, Nitro, Tailwind v4 | Same template family (TX27 fork of it) |
| Routing | `/` only | `/` = TX-80, `/tx27` = intact TX27 |
| State management | Zustand store (`state/store.ts`) | React state + refs in route (TX27 house pattern) |
| Parameter registry | `state/params.ts` (~100 defs, scopes, serialize flags, destination hints; ids like `layerI.filt.cutoff`) | `lib/tx80/parameters.ts` (79 defs + coercion/clamping + generated matrix doc + tests; ids like `l1.filter.cutoff`) |
| Registry→engine coverage | Partial: engine consumes Layer I + master.level only | Complete: every id routes to a live destination (e2e-verified sampling) |
| Persistence | `idb` dependency installed, **unused**; nothing persists | localStorage (versioned payloads, graceful failure), user presets + settings verified across reload |
| UI structure | 10 `components/synth/*` panels — **the approved TX-80 visual design** | TXPPS/TX27-family panels — polished but not the approved TX-80 skin |
| TX-80 visual fidelity | Authoritative | Divergent (would need re-skin) |
| TX27 reuse | None | Foundation + shared components, TX27 preserved |
| Layer I independence | Only layer synthesized | Verified independent (unit + e2e) |
| Layer II | **Panel only — engine hardcodes `layerI`; no sound** | Fully synthesized, independently toggleable (verified) |
| Dual-layer coordination | — | One `Tx80Voice` owns both sub-voices; shared note lifecycle (verified) |
| Keyboard pointer ownership | Per-pointer map, capture, slide via elementFromPoint (good) | Same discipline + release on range change/blur/visibility |
| pointercancel / lostpointercapture | Handled (code) | Handled (code + e2e background-release test) |
| Computer-keyboard input | — | 2-octave map, repeat-guarded, Space sustain |
| Unique press identity | **None — voices keyed by MIDI note only** | Counted presses per note; LIFO instance release (e2e-verified) |
| Repeated same-note handling | Early-return while held; unrelated new voice after release (fuel for stuck-voice accumulation) | Stacks one voice per press; releases one-for-one |
| Release ordering | Single map entry; wrong-press release impossible to express | LIFO (noteOff), oldest-first (sustain pedal-up) |
| AudioContext creation | Lazy singleton on gesture (good) | Lazy singleton inside gesture, serialized lifecycle ops |
| Resume/interruption handling | `resume()` unbounded; iOS "interrupted" unhandled; inverted visibility guard | Bounded (`withTimeout`), treats interrupted as resumable, rebuilds closed contexts (e2e reconnect test) |
| First-note preservation | **Dropped** (measured: 0 oscillators on cold click); failed init never retryable | Queued + flushed (e2e-verified); failed init retried on next gesture |
| Async startup races | Un-awaited init + immediate noteOn | Single in-flight activation promise shared by all callers |
| Voice allocation | Map<midi, Voice> + arrays | Voice list + per-note counts + solo path |
| Max polyphony | Fixed at init (`master.polyphony` changes are a TODO) | 4/8/12/16 live (e2e cap test) |
| Voice stealing | Oldest via `shift()`, released through the defective envelope | Oldest fast-fade (40 ms), both layers together (e2e) |
| Generation tokens / ownership invalidation | None | Unique voice ids; reaper checks per-voice end times |
| Sustain | Store flag only — **engine ignores it** | Counted deferral, pedal-up oldest-first release (verified) |
| Panic | Stops all sources; instrument stays playable (verified after probe correction) | Stops voices + recentres bend/ribbon (e2e) |
| All-notes-off (MIDI CC) | — (no MIDI) | CC120/123 handled |
| Oscillator lifecycle | `start()` at build; **`stop()` only ever via PANIC** | start at build, stop at reap/steal/panic, guarded idempotent |
| Envelope lifecycle | **Defective release (no cancel) — root cause of stuck voices** | Anchored cancel-and-ramp on release (decay-to-zero e2e-verified) |
| Timer safety | No timers at all (reaper never scheduled) | Interval reaper cleared on destroy; tracked shutdown waits |
| Node cleanup | Never disconnects anything | Per-AudioParam disconnects of shared sources per voice dispose |
| Live parameter updates | Levels/pan/cutoff/reso reach active voices; env updates mid-note mutate shared params object | Filter/tuning/levels/pan/PW retarget live voices; env/wave apply to new notes (documented) |
| Portamento | — | Exponential ramp, exact arrival, solo+poly policies (e2e smoke) |
| Stepped glissando | — | True chromatic `setValueAtTime` steps, exact final pitch (e2e smoke) |
| Ribbon | Visual only (local state; not even in store) | Relative-origin pointer capture → engine cents source; pitch/gliss/hold modes (e2e); A's registry also specs a `trigger` mode B lacks |
| Modulation (LFO) | Panel + params only; no LFO exists | 2 LFOs, 6 destinations on static buses, clean rewiring (e2e cycling test) |
| Effects | Panel + params only; no FX graph | Chorus→delay(≤0.85 fb)→reverb(cached lazy IR)→limiter (graph verified) |
| Master safety / meter | None (voice-manager gain → destination) | Limiter + analyser-driven meter (signal + decay e2e-verified) |
| Presets | One hardcoded label | Factory + user save/rename/delete + reload restore (e2e) |
| MIDI | — | Guarded Web MIDI in/out-of-scope status, reconnect, all-notes-off on unplug (code; no hardware test) |
| Responsive layouts | CSS-grid reflow; phone-landscape hides ALL editing; desktop keyboard below the fold (1280×900) | FULL/EDIT/PLAY modes; e2e-verified across 4 emulated devices/orientations, no horizontal scroll |
| Orientation changes | Untested; likely fine for layout, no note-release handling | Range-change and visibility releases (e2e background test) |
| PWA / offline | **Absent** (public/ = favicon only) | Manifest + versioned SW, offline reload e2e-verified, prod-only guard |
| Automated tests | **None** | 32 unit + 48 browser e2e (Chromium set) |
| Physical-device validation | None | None for TX-80 (TX27 foundation had physical Gate-2 pass) |
| Human listening validation | None | None (explicitly listed in MANUAL_QA.md) |
| Known defects | Stuck voices (root-caused), first-note drop, unretryable init, lockfile out of sync, IPv6-only dev bind, decorative panels | Wave/env edits new-notes-only; pulse aliasing at extremes; balance-mod floor; no idb; TX27 legacy lint noise |
| Unfinished features | Layer II, FX, LFO, ribbon, sustain, velocity, presets, MIDI, PWA, meter, tests | `trigger` ribbon mode, JSON preset import/export, physical/listening QA |
| Migration (JUCE) suitability | Registry has destination hints (good); engine too thin to port | Engine boundary (`SynthEngine` contract) mirrors the TX27 native-equivalence plan; parameter contract documented |
| Long-term maintainability | Small, readable, but everything audio must still be built | Larger, layered, tested; carries TX27 alongside |

## Zustand vs React state — the required judgment

B avoided Zustand because the project it was handed (the TX27 foundation
ZIP) manages state with React state + refs, and its instructions were to
follow the existing architecture. A uses Zustand because the Lovable
Milestone-1 shell was built that way. Neither choice buys audio
correctness: in both designs the engine is driven through an imperative
boundary (`engine.setParam(...)` / `SynthEngine.setParameter(...)`), and
B's engine has **zero** dependency on any state library.

Verdict: **a harmless implementation choice — and, for reconciliation, an
advantage**: A's Zustand store can drive B's engine through the same
boundary with only an ID-mapping layer. It is not duplication (the two
stores serve different UIs) and it is not an integration risk beyond the
parameter-ID translation, which must be tested (Gate 1/6).

## Transplant list (what moves from B into A's repo — nothing else)

1. `src/lib/synth/` (contracts + SynthRuntime + tests) — verbatim.
2. `src/lib/tx80/engine/{engine,voice}.ts`, `types.ts`, `parameters.ts`
   (as the engine-side registry), `midi.ts`, `storage.ts` discipline,
   `presets.ts` (sound data reviewed at Gate 8).
3. Test assets: `tests/e2e/tx80-engine.e2e.ts` (diag hooks + spam/stacking/
   steal/panic/analyser tests), unit test patterns, Playwright config
   (incl. the `PLAYWRIGHT_CHROMIUM_EXECUTABLE` override).
4. PWA: `public/sw.js` + `scripts/inject-sw-precache.mjs` + `src/lib/pwa.ts`
   pattern (renamed for TX-80 identity).

Explicitly NOT transplanted: B's routes/UI components, TX27 product code,
B's docs (A's root docs get updated instead).

## Merge safety

Direct `git merge` between the repositories: **unsafe and meaningless**
(unrelated histories; colliding doc filenames; different layout). All reuse
happens as reviewed file transplants committed normally to this repo with
source SHA `96c97e2` recorded. Cherry-picking runtime commits across the
repos is equally inapplicable.
