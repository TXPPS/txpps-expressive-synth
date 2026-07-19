# TX-80 Dual-Implementation Audit

**Date:** 2026-07-19 · **Auditor:** Claude (session-verified, evidence-based)
**Repository audited:** https://github.com/TXPPS/txpps-expressive-synth
**Audit branch:** `audit/tx80-dual-implementation-reconciliation` (documentation only — no runtime files changed)

Every claim below was verified against the real Git remotes or observed at
runtime in this audit session. Where a previous report's claim did NOT hold,
that is stated explicitly. One preliminary observation made during this audit
was itself wrong and is retracted with an explanation (§5.4).

---

## 1. Repository and history facts

- Default branch: `main`. HEAD: `ad15b8e5e1bd18b595c82424ebe618245a309430`.
- Remote branches: **`main` only.** No tags. Full map in
  `TX80_GIT_HISTORY_MAP.md`.
- History: Lovable template (`b195b89`, 2026-07-16) → four `Changes` commits
  by `gpt-engineer-app[bot]` → merge `2760b2f` "Reached Milestone 1 complete"
  → `ad15b8e` "feat(tx-80): integrate initial browser audio engine and
  playable synthesis" (the Copilot/VS Code commit).
- **The reported Claude branch `claude/tx80-synth-completion-nkt36a` does NOT
  exist in this repository** — not as a branch, tag, merged history, or
  unreachable object. Searching all history for its distinctive paths
  (`src/lib/tx80/`, `src/components/tx80/`, `tests/e2e/tx80-engine.e2e.ts`,
  `scripts/generate-parameter-matrix.mjs`) returns nothing: those files were
  never committed here.
- The Claude implementation DOES exist, verified this session by
  `git ls-remote` against the **separate repository `txpps/txpps-tx-80`**:
  branch `claude/tx80-synth-completion-nkt36a`, HEAD
  `96c97e2869a189e372396c8532787e0e20923974` (2 commits: TX27-foundation
  import `9bf1c83` + TX-80 implementation `96c97e2`). It was pushed to the
  repository that session was scoped to — not to this one. Nothing important
  exists only locally; the branch is on that remote.
- **The two implementations share NO Git ancestry.** Root commits differ
  (`b195b89` Lovable template vs `9bf1c83` TX27 ZIP import); there is no
  merge base. Direct merging is therefore not meaningful; any reuse is a
  transplant, not a merge.
- The root-level `ARCHITECTURE.md` / `CURRENT_STATUS.md` /
  `PARAMETER_MATRIX.md` / `MANUAL_QA.md` in this repo were written by the
  Lovable Milestone-1 bot (`7389fa9`). They share filenames with the Claude
  implementation's docs by coincidence; contents are unrelated.
- No build artifacts or node_modules were committed (99 tracked files).
- **Committed lockfiles are inconsistent:** `package-lock.json` (added by the
  Copilot commit) is OUT OF SYNC with `package.json` — `npm ci` fails
  (`Missing: lru-cache@11.5.2 from lock file`). `bun.lock` (template-era)
  does list `zustand`/`idb`. This must be repaired at Gate 0/1.

Explanation of the original divergence: the "Milestone 1 TX-80 shell"
(Zustand, panels, ribbon, registry) was approved **in this repository**. The
ZIP handed to the earlier Claude session, however, contained the **TX27
foundation project** instead of this shell, so that session — following
"use the existing project as the source of truth" — built TX-80 on the TX27
foundation in the other repository. Both implementations are real; they were
built from different starting points that were each presented as "the
project".

## 2. Implementation A — `main` here (Lovable shell + Copilot audio)

### 2.1 Validation results (this audit, this container)

| Check | Result |
| --- | --- |
| Install | `npm ci` **fails** (lockfile out of sync). `bun install --frozen-lockfile` failed here for two tarballs (environment proxy). Used `npm install --package-lock=false` — committed lockfiles untouched; versions resolved from package.json ranges. Deviation noted. |
| Typecheck | **No `typecheck` script exists** (claim confirmed). Manual `npx tsc --noEmit`: **clean**. |
| Lint | `npm run lint`: **146 problems** — 135 auto-fixable `prettier/prettier`, 6 react-refresh warnings, ~5 real minor errors (1 `prefer-const`, 2 `no-explicit-any`, 3 `no-empty`). The "thousands of CRLF findings" claim is **wrong** for this repo. |
| Unit tests | **None exist** (no test script, no test framework installed). |
| Browser/e2e tests | **None exist.** |
| Production build | `npm run build`: **succeeds** (claim confirmed). |
| Dev server | `npm run dev` **fails by default** in IPv4-only environments (`listen EAFNOSUPPORT :::8080`). Works with `npm run dev -- --host 0.0.0.0 --port 3000`. URL used: `http://127.0.0.1:3000/`. |
| Console | No app errors during normal play (one unrelated dev-tooling `ERR_CONNECTION_RESET` resource log). |

### 2.2 Verified runtime behavior (instrumented headless Chromium)

Method: `addInitScript` wrappers counting `createOscillator`/`createGain`
and `start()`/`stop()` calls, plus sampling live `gain.value` — observing the
real app, real UI events. Full data in `TX80_STUCK_VOICE_ANALYSIS.md`.

- On-screen keyboard **does produce audible synthesis** (claim confirmed) —
  one voice = main osc + sub osc + noise through filter/amp to master gain.
- **First cold note is silently dropped** — a cold click starts init but
  `noteOn` executes before the engine exists (0 oscillators created). No
  first-note preservation. A failed init is permanently unretryable
  (`initializeAttempted` latches before success).
- **Stuck-voice defect confirmed and reproduced deterministically**: 8 rapid
  ~15 ms presses of one key → 3 s after all releases, **18 oscillators still
  running, 0 stopped, ~9 amp-envelope gains parked at sustain (0.8) or
  attack peak (1.0)** — voices sounding indefinitely. Root cause chain
  (envelope release without `cancelScheduledValues` + a reaper that is never
  invoked) in `TX80_STUCK_VOICE_ANALYSIS.md`.
- **PANIC works and the instrument remains playable afterwards** (all
  sources stopped; a fresh key press allocates a new voice). An earlier
  observation in this audit that panic "killed" note-on was a **probe
  artifact** (page scroll put the keyboard outside the viewport for raw
  mouse coordinates) and is retracted; see §5.4 of the stuck-voice analysis.

### 2.3 What is real vs decorative (verified against code + runtime)

Real: Layer I osc (saw/square/triangle/sine)+sub+noise → lowpass → amp env →
pan → per-manager master gain; polyphony cap with oldest stealing;
`master.level`; the Zustand parameter registry (`src/state/params.ts`,
~100 defs, well-specified incl. Layer II / LFO / FX / ribbon modes).

Not wired to audio (UI + store only): **the entire Layer II panel** (engine
hardcodes `scope = "layerI"`), all FX controls (no effects graph exists),
both LFOs (no LFO exists), ribbon (visual-only, doesn't even write store),
pitch bend / mod wheel / sustain (store transients the engine never reads),
velocity (accepted, ignored), filter envelope (created but its output gain
is connected to nothing), filter key tracking (read, unused), pulse width
("approximated" by detuning the oscillator — not pulse width), `master.polyphony`
changes after init (TODO in code). No limiter, no analyser/meter, no
presets persistence (single hardcoded preset label), no MIDI, no PWA
(public/ contains only favicon.ico). Phone-landscape CSS hides all editing
panels; on a 1280×900 desktop the keyboard sits below the fold.

### 2.4 Architecture trace (files/functions)

Input: `components/synth/Keyboard.tsx` — container-level Pointer Events with
`setPointerCapture`; per-pointer note map `pointerNotes: Map<pointerId,
midi>`; slide via `elementFromPoint`; releases on pointerup/cancel/
lostpointercapture; panic effect releases pointer-owned notes. (This layer
is competently built; ownership identity is pointer→midi only.)
→ `hooks/useAudioEngine.ts` `handleNoteOn` (fires unawaited `initialize()`;
races) → `audio/engine.ts AudioEngine.noteOn` → `audio/voice-manager.ts
VoiceManager` (`voices: Map<midiNote, Voice>` — **note-number-keyed, no
per-press identity**; same-note re-press early-returns; steal via
`activeVoices.shift()`) → `audio/voice.ts Voice` (nodes) →
`audio/envelope.ts ADSREnvelope` (defective release) → masterGain →
`ctx.destination` (no limiter/analyser).
Release: pointerup → `release(pointerId)` → `noteOff(midi)` →
`Voice.release()` (defective scheduling) → **nothing ever disposes**:
`VoiceManager.cleanup()` has zero call sites; oscillators are stopped only
by PANIC.

## 3. Implementation B — `claude/tx80-synth-completion-nkt36a` @ `txpps/txpps-tx-80`

Validated this session at `96c97e2` in this same container class
(commands: `bun install`, `bun run typecheck`, `bun run test`,
`bun run build`, `bunx playwright test …`):

| Check | Result |
| --- | --- |
| Typecheck | `tsc --noEmit` clean (`typecheck` script exists). |
| Lint | Clean on all TX-80 files; pre-existing TX27 CRLF noise confined to legacy files and documented. |
| Unit tests | **32/32 pass** (parameter registry, normalization, preset round-trips + TX27 foundation suites). |
| Browser/e2e | **48/48 pass** against the production build (Chromium desktop + Pixel 7 / Galaxy Tab S4 portrait+landscape emulation): gesture-gated audio lifecycle, first-note preservation, chord/voice counts, same-note LIFO stacking, voice stealing cap, solo legato, porta/gliss, LFO destination cycling, panic, preset save/reload, offline PWA, responsive/no-horizontal-scroll. |
| Build | Production build + service-worker precache injection green. |
| Not verified | WebKit/iOS, Edge, physical devices, and **anything audible by a human** (explicitly listed in its MANUAL_QA.md). |

Architecture trace: route `src/routes/index.tsx` → shared `SynthRuntime`
(gesture-gated activation, bounded resumes, pending-note queue) →
`TX80ProductEngine implements SynthEngine<Tx80Patch>` →
`src/lib/tx80/engine/engine.ts TX80Engine` (dual-layer buses, counted held
notes, counted sustain, LIFO same-note release, oldest-voice fast-fade
stealing, solo legato, portamento exponential ramps with exact arrival,
stepped glissando via `setValueAtTime` chains, ribbon ConstantSource, two
LFOs on static destination buses, chorus→delay→reverb(cached IR)→limiter→
masterGain→analyser) → `engine/voice.ts Tx80Voice`/`Tx80SubVoice`
(per-AudioParam disconnects on dispose; 200 ms reaper interval).
Release path: pointer/key/MIDI → note-count decrement → sustain-count
deferral → envelope release ramps → end-time → reaper dispose →
per-param disconnect. Its keyboard/ribbon input layers mirror A's pointer
discipline and add blur/visibility/range-change releases.

## 4. Claims vs evidence summary

| Prior claim | Verdict |
| --- | --- |
| A: Zustand state, TanStack/Vite/Nitro, TX-80 UI | Confirmed |
| A: Copilot added modular src/audio; keys audible | Confirmed |
| A: key spam leaves voices sounding | **Confirmed, reproduced, root-caused** |
| A: build succeeds | Confirmed |
| A: thousands of Prettier/CRLF findings | **Wrong** (146 problems, 135 auto-fixable) |
| A: typecheck script may be absent | Confirmed absent (manual tsc is clean) |
| B: branch pushed | True — but to `txpps/txpps-tx-80`, **not this repo** |
| B: 32 unit / 48 e2e pass | Re-confirmed this session at `96c97e2` |
| B: physical/human-audible validation | Correctly reported as NOT done |

## 5. Strongest / weakest subsystems

- A strongest: the approved TX-80 **visual shell and Zustand parameter
  registry** (well-specified, serialization-aware), plus a competent
  keyboard pointer layer. Weakest: **everything from noteOn down** — voice
  lifecycle (defective), engine coverage (Layer I only; FX/LFO/ribbon/
  sustain/velocity absent), audio safety (no limiter), lifecycle races,
  zero tests, broken npm lockfile, no PWA.
- B strongest: the **verified engine + browser-audio lifecycle + allocator**
  (exactly the subsystems A lacks), tests, PWA, docs. Weakest: its UI is
  TX27-family styling rather than the approved TX-80 panel design; TX27
  legacy lint noise; no physical-device or listening validation yet; lives
  in a different repository with unrelated history.

## 6. Authority decision (recommendation for Hunter)

**Strategy A (as defined in the task): keep `main` of this repository
authoritative for product, UI, state and registry — and transplant
Implementation B's engine-side subsystems behind it.** Rationale against
the priority list: priorities 1–6 (note ownership, no stuck notes, safe
stealing, first-note preservation, stable lifecycle, mobile reliability)
are all properties B has verified and A lacks structurally; priority 7
(intended TX-80 interface) is exactly what A has and B lacks; B's engine is
deliberately UI-agnostic (`SynthEngine` contract), so it can sit behind A's
Zustand store without adopting B's UI or React-state pattern. This is also
the only direction that keeps the Lovable-connected `main` (see AGENTS.md)
continuously working.

Zustand vs React-state is a **harmless implementation choice**, not an
architectural advantage on either side: B's engine has zero coupling to any
state library, and A's store can call the same `setParameter` boundary.
The only real integration risk is the **parameter-ID mapping** (A:
`layerI.filt.cutoff` … vs B: `l1.filter.cutoff` …), which is a contained,
testable translation layer (Gate 1/6).

Direct merging is **not safe** (unrelated histories, colliding root-doc
filenames, different file layouts). Transplant = copying B's product-neutral
modules (`src/lib/synth/*`) and TX-80 engine modules
(`src/lib/tx80/{types,parameters,engine/*,midi,storage,presets}.ts`) into
this repo as a self-contained core, then binding A's store/UI to the
`SynthEngine` boundary. B's UI components are NOT transplanted.

Subsystems worth transplanting (in gate order): SynthRuntime + engine
lifecycle; Tx80Voice/TX80Engine allocator (per-press LIFO identity, counted
sustain, stealing, reaper); first-note queue; portamento/glissando/ribbon
engine paths; LFO destination buses; effects chain + limiter + analyser;
preset storage discipline; guarded MIDI; PWA service-worker pattern;
Playwright e2e harness incl. the engine-diagnostics hooks and spam tests.

Fallbacks considered: Strategy B (make the Claude branch authoritative,
re-skin with A's UI) is equivalent work but abandons the Lovable-connected
repo and the approved shell's home; C/D (new shared foundation first) adds
a third architecture before the product is finished — rejected as
replacement-architecture churn; E (archive one) is subsumed by Gate 0.

## 7. Roadmap

See `TX80_NEXT_ROADMAP.md` (Gates 0–12, each with objective, files, tests,
acceptance, rollback, branch, out-of-scope, and model/effort guidance).

**No runtime source files were modified by this audit. No branches were
merged. The stuck-voice defect was intentionally NOT fixed.**
