# TX-80 Stuck-Voice Analysis (Implementation A, `main` @ ad15b8e)

**Status: root cause identified with runtime evidence. NOT fixed in this
audit (by instruction).**

## 1. Reproduction (automated, real app, real UI events)

Environment: dev server (`npm run dev -- --host 0.0.0.0 --port 3000`),
headless Chromium (muted), Playwright-driven pointer input. Instrumentation:
`page.addInitScript` wrapping `AudioContext.prototype.createOscillator` /
`createGain` to count `start()`/`stop()` calls and to sample live
`gain.value` — pure observation, no app code changed.

Steps: warm the engine (one click — note that this first note is itself
dropped, §4), then press one key rapidly 8× with ~15 ms press duration,
release everything, wait 3 s (amp release is 0.35 s).

Measured result:

| Moment | osc started | osc stopped | gains parked at 0.5–0.99 |
| --- | --- | --- | --- |
| baseline (1 normal note) | 2 | 0 | 3 |
| 3 s after 8× rapid press/release | 20 | 2 | **19** |

Every spam press mints a voice whose amplitude gain ends up **parked at the
sustain level (0.8) or attack peak (1.0) indefinitely** — audibly stuck —
and **no oscillator is ever stopped** outside PANIC. Repeating with 10
presses on another run: 22 oscillators running, amp gains
`0.8/1.0` across all 11 voices, 3 s after all keys were released.
Multi-key spam accumulates the same way (D4+E4 → 21 parked gains).

## 2. Root cause A — release scheduling never cancels pending ramps

`src/audio/envelope.ts`:

```ts
trigger() {                       // at note-on time t0
  gain.setValueAtTime(0, t0);
  gain.linearRampToValueAtTime(1, t0 + attack);          // event E1
  gain.linearRampToValueAtTime(sustain, t0 + attack + decay); // event E2
}
release() {                       // at note-off time t1
  const current = gain.value;
  gain.setValueAtTime(current, t1);                      // event E3
  gain.linearRampToValueAtTime(0, t1 + release);         // event E4
}
```

`release()` **never calls `cancelScheduledValues()`** (or `cancelAndHold`),
so E1/E2 remain in the automation timeline. Web Audio orders events by
time. With the default patch (attack 0.005 s, decay 0.4 s, sustain 0.8,
release 0.35 s), a press shorter than `attack + decay − release ≈ 0.055 s`
puts the ramp-to-zero E4 **before** the still-pending decay ramp E2:

```
t1+release (E4): gain → 0        ← release completes…
t0+A+D    (E2): gain → 0.8       ← …then the stale decay ramp raises it back
                                    to sustain, where it stays FOREVER
```

This is deterministic — every sub-55 ms press/release cycle produces a
permanently sounding voice. That is precisely "rapidly pressing or spamming
keys leaves voices active". (Presses of intermediate length instead get a
partial mis-ramp; long holds behave correctly, which is why normal playing
sounds fine.)

## 3. Root cause B — the reaper exists but is never invoked

`VoiceManager.cleanup()` (which would `stop()` finished released voices)
has **zero call sites** — no interval, no rAF, nothing. Consequences:

- Even correctly-released voices never `osc.stop()`/disconnect: silent
  oscillator+buffer-source leak growing with every note ever played
  (confirmed: `stopped: 0` outside PANIC).
- The stuck voices of §2 are never reclaimed; `releasedVoices[]` grows
  without bound.

## 4. Aggravating and adjacent defects (verified in code, several at runtime)

1. **First-note race:** `useAudioEngine.handleNoteOn` fires `initialize()`
   (async) and calls `engine.noteOn()` synchronously → the first cold note
   is dropped (measured: 0 oscillators after a cold click). There is no
   pending-note queue. `initializeAttempted` latches `true` before success,
   so a failed init can never be retried without reload.
2. **No per-press identity:** `VoiceManager.voices` is keyed by MIDI note
   only. Re-pressing a note whose previous voice was released mints an
   unrelated voice (enables the §2 accumulation); two pointers on the same
   key collapse to one entry (first release silences the still-held finger);
   there are no generation tokens, so any future steal/recycle logic has no
   way to invalidate stale ownership.
3. **Steal path unsafety:** stealing calls `Voice.release()` — through the
   §2-defective envelope — so a steal executed shortly after the stolen
   voice's attack can itself produce a stuck voice.
4. `Voice.stop()`/`osc.stop()` are not guarded for double-stop (currently
   masked because only PANIC ever stops; any reaper added later must make
   disposal idempotent).
5. Sustain pedal, visibility/blur note release, and octave-change ownership
   are **not implemented in the engine at all** (sustain exists only as a
   store flag; the Keyboard does handle pointercancel/lostpointercapture
   correctly, and stores midi per pointerId so octave changes do not
   miscompute releases).
6. Inverted resume guard: the visibilitychange handler calls
   `resumeAudioContext()` only `if (isAudioContextRunning())` — i.e. only
   when there is nothing to resume.

## 5. Findings that did NOT hold

**5.4 Retraction:** an earlier probe in this audit concluded "PANIC
permanently kills note-on". Instrumented DOM hit-testing showed the real
cause: clicking PANIC (top of page) scrolls the panel page so the keyboard
leaves the viewport, and the probe's raw mouse coordinates then hit
`<html>` instead of a key. With the keyboard scrolled back into view,
**post-panic note-on works correctly** (a fresh voice is allocated). The
app-level implication is a UX/layout observation (keyboard below the fold
on desktop), not an engine defect.

## 6. Repair boundary (Gate 2 — do not fix during audit)

Contained to: `src/audio/envelope.ts` (cancel-and-anchor before every
retrigger/release; idempotent stop), `src/audio/voice-manager.ts` (per-press
voice identity with LIFO release per note; invoke a reaper on an interval;
idempotent disposal with node disconnect; safe steal fade),
`src/hooks/useAudioEngine.ts` (await/queue first notes; retryable init).
UI files are NOT in the repair boundary.

**Recommended alternative (per the authority decision):** rather than
repairing this engine in place, transplant Implementation B's proven
allocator/voice/lifecycle (`SynthRuntime`, `TX80Engine`, `Tx80Voice`),
which already implement counted press/sustain ownership, LIFO same-note
release, fast-fade stealing, a 200 ms reaper with per-AudioParam
disconnects, first-note queuing, and panic — all covered by its 48-test
browser suite (including a same-note stacking test and an
analyser-decay-after-release test). The comparison of ownership models is
in `TX80_RECONCILIATION_MATRIX.md`.

Regression tests required at Gate 2 (whichever path is taken): a rapid
same-key spam test asserting all gains decay to <0.05 and all sources stop
within release+ε; a stacking test (two simultaneous presses of one note,
LIFO release); a steal-under-spam test; a cold-first-note test.
