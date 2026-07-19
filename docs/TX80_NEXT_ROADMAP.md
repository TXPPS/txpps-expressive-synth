# TX-80 Next Roadmap — Finish-Oriented, Gated

Authoritative direction (pending Hunter's approval, per
`TX80_DUAL_IMPLEMENTATION_AUDIT.md` §6): **`main` of
`txpps-expressive-synth` stays authoritative for product/UI/state/registry;
Implementation B's engine-side subsystems are transplanted behind the
approved UI.** Each gate is small, reversible, and ends with the app
working. No gate bundles two high-risk changes. Model guidance assumes
Claude Code; "Sonnet" = standard capability tier, "Opus/high" = strongest
available tier for high-risk audio work.

Conventions: every gate branches from the previous gate's merged result,
lands via PR into `main` (Lovable-connected — never force-push), and its
rollback point is the merge commit of the previous gate.

---

## Gate 0 — Source preservation and branch authority
- **Objective:** both implementations preserved and reachable from this repo; broken install fixed so every later gate starts reproducible.
- **Authoritative subsystem:** Git refs + lockfile.
- **Files:** tags/branches only, plus `package-lock.json` (regenerate in sync — the ONLY sanctioned lockfile change; keep or delete `bun.lock` after choosing ONE package manager and documenting it in README/AGENTS), optional `"typecheck": "tsc --noEmit"` and `vite.config.ts` host/port fix (`EAFNOSUPPORT` on IPv6-less hosts).
- **Depends on:** Hunter approving the authority decision.
- **Boundary:** no runtime source edits beyond vite host config; no engine work.
- **Automated tests:** `npm ci && npx tsc --noEmit && npm run build` green from a clean clone.
- **Manual:** none. **Physical:** none.
- **Acceptance:** tag `archive/m2-copilot-audio` at `ad15b8e`; orphan branch `reference/claude-tx80-96c97e2` holding B's tree; clean-clone install/build passes.
- **Rollback:** delete tag/branch; revert lockfile commit.
- **Branch:** `chore/gate0-preservation`.
- **Out of scope:** any fix to audio, UI, or tests.
- **Model/effort:** Sonnet, low.

## Gate 1 — Reconciliation and authoritative baseline (engine transplant, dark)
- **Objective:** B's engine core lives in this repo, compiling and unit-tested, NOT yet driving the UI (existing `src/audio` stays the live path).
- **Authoritative subsystem:** `src/synth-core/` (new home for the transplant).
- **Files:** copy from B@`96c97e2`: `lib/synth/*` → `src/synth-core/runtime/`; `lib/tx80/{types,parameters,engine/*,storage,midi,presets}.ts` → `src/synth-core/tx80/`; unit tests alongside; add vitest as devDependency + `"test"` script; commit message records source repo/branch/SHA.
- **Depends on:** Gate 0.
- **Boundary:** no imports from app code into synth-core; no UI changes; `src/audio` untouched.
- **Automated tests:** transplanted unit suite (32) green here; typecheck green; a NEW mapping-table unit test translating every `state/params.ts` id ↔ synth-core registry id (or documenting deliberate no-map entries).
- **Manual:** app still behaves exactly as before (spot check).
- **Acceptance:** `npm run test` green; zero behavior change in the running app.
- **Rollback:** revert the transplant commits (self-contained directory).
- **Branch:** `feat/gate1-synth-core-transplant`.
- **Out of scope:** wiring the UI to the new engine; deleting `src/audio`.
- **Model/effort:** Sonnet, medium.

## Gate 2 — Voice ownership and stuck-note repair (engine switchover)
- **Objective:** the audible path becomes B's allocator; the reproduced stuck-voice defect is dead with regression tests.
- **Authoritative subsystem:** `src/synth-core` engine behind `useAudioEngine`.
- **Files:** `src/hooks/useAudioEngine.ts` (drive `SynthRuntime` + `TX80ProductEngine`), an id-mapping module (Gate 1's table), `src/routes/index.tsx` (status wiring), delete-or-quarantine `src/audio/` (move to `legacy/audio-m2/` until Gate 5 confirms parity); add Playwright + config (with the Chromium-executable override) and port the engine e2e spec incl. diagnostics hooks.
- **Depends on:** Gate 1.
- **Boundary:** no visual redesign; keyboard component unchanged; Layer II may remain silent until Gate 5 if mapping is incomplete — but ownership/lifecycle must be complete.
- **Automated tests (required):** rapid same-key spam (≥8×15 ms presses → all sources stopped/decayed <0.05 within release+2 s); same-note two-press LIFO stacking; steal-under-spam at min polyphony; panic-then-play; analyser signal + decay.
- **Manual:** play on desktop; spam by hand; confirm silence after release.
- **Physical:** none yet (Gate 4).
- **Acceptance:** all new e2e green; the §1 reproduction from `TX80_STUCK_VOICE_ANALYSIS.md` no longer reproduces.
- **Rollback:** re-point `useAudioEngine` at legacy `src/audio` (one-commit revert).
- **Branch:** `feat/gate2-voice-ownership`.
- **Out of scope:** FX, LFOs, ribbon, presets, PWA.
- **Model/effort:** Opus/high — this is the highest-risk gate.

## Gate 3 — AudioContext lifecycle and first-note validation
- **Objective:** gesture-gated, bounded, retryable startup; first intended note preserved; enable-pill reflects real context state.
- **Authoritative subsystem:** `SynthRuntime` (already transplanted) + store `audioStatus`.
- **Files:** `useAudioEngine.ts`, `Header.tsx`/enable pill status mapping, store `audioStatus` transitions.
- **Depends on:** Gate 2.
- **Boundary:** no engine DSP changes.
- **Automated tests:** cold-click-first-note (voice count ≥1 after activation), rapid-activation dedup, power/suspend-resume cycle, visibilitychange note-release; failed-init → retry path (mock).
- **Manual:** background/return, tab switch, repeated enable taps.
- **Physical:** none yet.
- **Acceptance:** cold first note audible-by-graph (analyser), no duplicate contexts (assert 1 AudioContext constructed), status label never claims running while suspended.
- **Rollback:** Gate 2 merge commit.
- **Branch:** `feat/gate3-audio-lifecycle`.
- **Out of scope:** iOS-specific tuning beyond the transplanted handling.
- **Model/effort:** Sonnet, high.

## Gate 4 — Physical phone and browser validation
- **Objective:** the Gate 2/3 behavior holds on real hardware.
- **Subsystem:** none (validation gate).
- **Files:** docs only (test log in `docs/GATE4_DEVICE_LOG.md`).
- **Depends on:** Gate 3; a deployed HTTPS build.
- **Tests — physical (required):** iPhone Safari + Android Chrome: launch, first note, multitouch chords, same-key spam, rotation mid-note, background/return, panic. Browser matrix: WebKit + Edge runs of the e2e suite where available.
- **Acceptance:** no stuck note reproducible by hand on either device; log recorded with OS/browser versions.
- **Rollback:** n/a (findings feed fixes as Gate 2/3 patch branches).
- **Branch:** `docs/gate4-device-log`.
- **Out of scope:** feature work.
- **Model/effort:** Sonnet, low (human does the touching).

## Gate 5 — Dual-layer synthesis validation
- **Objective:** Layer II panel controls a real, independent second layer.
- **Subsystem:** synth-core dual-layer voices (already capable) + full layer id mapping.
- **Files:** mapping module; `LayerPanel.tsx` bindings only where ids mismatch; delete `legacy/audio-m2/`.
- **Depends on:** Gate 2.
- **Automated tests:** layer independence (L1 edit ≠ L2 state), L2-alone audible via analyser, both-layer voice counts, live-edit reach (cutoff on sounding note).
- **Manual:** A/B mute listening by human.
- **Acceptance:** every `layerII.*` control provably reaches audio; legacy engine removed.
- **Rollback:** Gate 2 merge (legacy path restorable from history).
- **Branch:** `feat/gate5-dual-layer`.
- **Out of scope:** new synthesis features not in either implementation.
- **Model/effort:** Sonnet, medium.

## Gate 6 — Parameter and control completeness
- **Objective:** zero decorative controls: every visible control maps to a registry id AND an engine destination, or is removed/disabled with intent.
- **Subsystem:** `state/params.ts` as UI registry ↔ synth-core registry via the mapping table; regenerate a real PARAMETER_MATRIX (port B's generator).
- **Files:** `state/params.ts`, mapping module, `scripts/generate-parameter-matrix.mjs` (ported), root `PARAMETER_MATRIX.md`, panel components for velocity/sustain/bend/mod wiring.
- **Depends on:** Gate 5.
- **Automated tests:** exhaustive: for each mapped id, set via store → engine `getParameter` reflects it (unit); spot e2e for one param per panel.
- **Acceptance:** generated matrix has no "unrouted" rows without an explicit waiver line.
- **Rollback:** Gate 5 merge.
- **Branch:** `feat/gate6-parameter-completeness`.
- **Out of scope:** ribbon/porta/gliss (next gate), preset UX.
- **Model/effort:** Sonnet, medium.

## Gate 7 — Ribbon, portamento, and stepped glissando
- **Objective:** ribbon is a real performance controller; travel modes audible and exact.
- **Subsystem:** synth-core ribbon/travel paths behind A's `Ribbon.tsx`.
- **Files:** `Ribbon.tsx` (relative-origin ownership from B's component logic, keeping A's visuals), `PerformanceStrip.tsx` (bend/mod → engine), mapping for `perf.*`/`ribbon.*` ids; decide `trigger` mode: implement or formally de-scope in the registry.
- **Depends on:** Gate 6.
- **Automated tests:** ribbon drag/release no-stale-offset e2e; porta exact-arrival + gliss stepped-arrival smoke; bend recentre on release.
- **Manual:** feel test on touch hardware.
- **Acceptance:** all ribbon modes in the registry behave or are removed from the registry; no stale pitch after any gesture.
- **Rollback:** Gate 6 merge.
- **Branch:** `feat/gate7-ribbon-travel`.
- **Out of scope:** MPE/aftertouch ideas.
- **Model/effort:** Sonnet, high.

## Gate 8 — Effects, presets, and MIDI
- **Objective:** FX panel drives the real chorus→delay→reverb→limiter chain; factory+user presets persist; guarded MIDI in.
- **Subsystem:** synth-core FX/preset/MIDI modules.
- **Files:** FX id mapping; `PresetBar.tsx` → preset controller (factory list curated for the TX-80 sound identity; B's presets as starting material); storage decision: keep B's localStorage discipline OR honor the installed `idb` dependency — pick ONE, document, and delete the other dependency; `midi.ts` behind a SETUP/UI affordance.
- **Depends on:** Gate 6 (params), Gate 7 for preset completeness of perf fields.
- **Automated tests:** FX bypass/no-cycle levels via analyser bounds; preset save→reload→restore e2e; MIDI unit tests with mocked access (grant/deny/disconnect).
- **Manual:** hardware MIDI keyboard smoke; preset listening pass.
- **Acceptance:** preset round-trip byte-stable through normalization; delay feedback bounded; MIDI failure modes non-fatal.
- **Rollback:** Gate 7 merge.
- **Branch:** `feat/gate8-fx-presets-midi`.
- **Out of scope:** preset cloud sync, JSON import/export (post-RC).
- **Model/effort:** Sonnet, medium.

## Gate 9 — Responsive PWA and offline validation
- **Objective:** installable, offline-capable, responsive on phone/tablet/desktop without decorative-layout regressions.
- **Subsystem:** B's SW + manifest pattern under TX-80 identity; A's grid layout.
- **Files:** `public/manifest.webmanifest`, `public/sw.js`, precache-inject script, `__root.tsx` metadata, layout fixes (desktop keyboard below the fold; phone-landscape editing access decision — keep hide-panels behavior only if PLAY-style access to presets/panic remains).
- **Depends on:** Gate 8.
- **Automated tests:** port B's offline/responsive e2e (SW controls page, offline reload, same-origin, no horizontal scroll, keyboard+ribbon in viewport across 4 emulations).
- **Manual/physical:** installed-PWA launch + airplane-mode relaunch on both platforms.
- **Acceptance:** offline reload works on the production build; SW disabled in dev; no stale-bundle serving (build-id handshake).
- **Rollback:** Gate 8 merge (SW registration is one guarded call).
- **Branch:** `feat/gate9-pwa-offline`.
- **Out of scope:** app-store packaging.
- **Model/effort:** Sonnet, medium.

## Gate 10 — Listening and sound-quality refinement
- **Objective:** human-validated sound: factory presets, layer balance, filter/env feel, FX character, travel feel.
- **Files:** preset data, engine scaling constants only (no structure).
- **Depends on:** Gate 8 (9 parallel-safe).
- **Tests:** structured listening checklist (port B's MANUAL_QA listening section); regression e2e must stay green after every tuning commit.
- **Acceptance:** Hunter signs off each factory preset; documented in `docs/GATE10_LISTENING_LOG.md`.
- **Rollback:** per-commit (data-only changes).
- **Branch:** `feat/gate10-sound-refinement`.
- **Out of scope:** new DSP features.
- **Model/effort:** Sonnet, low (human ears lead).

## Gate 11 — Performance, stress, and regression testing
- **Objective:** stability under abuse: max polyphony spam soak, long sessions, rotation storms, memory/node counts flat.
- **Files:** new stress e2e specs; perf notes doc.
- **Depends on:** Gates 2–9 merged.
- **Automated tests:** 5-minute spam soak asserting bounded node counts (diagnostics hook), voice-count ceiling honored, no console errors; CPU sampling smoke; orientation-change loop with held notes.
- **Physical:** low-end Android soak.
- **Acceptance:** zero stuck voices and bounded memory across soak; documented headroom numbers.
- **Rollback:** n/a (test-only) — findings spawn patch branches.
- **Branch:** `test/gate11-stress`.
- **Out of scope:** micro-optimizations without measurements.
- **Model/effort:** Sonnet, medium.

## Gate 12 — Release candidate
- **Objective:** tagged RC with everything green and honest status docs.
- **Files:** root docs rewritten to describe reality (retire M1 placeholders), version bump, CHANGELOG.
- **Depends on:** all prior gates.
- **Tests:** full matrix rerun (typecheck, unit, e2e incl. WebKit/Edge where available, build, physical smoke).
- **Acceptance:** Hunter approval; tag `v1.0.0-rc1`; deployment URL recorded.
- **Rollback:** previous tag.
- **Branch:** `release/gate12-rc1`.
- **Out of scope:** post-RC features (JSON import/export, ribbon `trigger` mode if de-scoped, JUCE work).
- **Model/effort:** Sonnet, low.

---

### Standing rules for every gate
- Git is the source of truth; never trust prior reports without re-running.
- Never force-push `main` (Lovable sync, AGENTS.md).
- No gate may claim audible quality from a headless container — graph-level
  evidence only, with human listening logged where required.
- Any lockfile or dependency change must be its own reviewed commit.
