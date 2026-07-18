# Audio Lifecycle Audit

**Primary files:** `src/lib/audio/engine.ts`, `src/routes/index.tsx`, `src/components/tx27/Keyboard.tsx`, `src/lib/startup-diagnostics.ts`, `src/lib/pwa.ts`

---

## Verdict

Cold-launch / mobile PWA audio recovery work from commit `821640d` is **present in code**. Uncommitted `index.tsx` refinements further clarify idle/READY vs failed and avoid false starts from pitch/MOD strips. Behavior is **strong for a web instrument**, but **fragile under late-resume and stop/start overlap**, and **unverified by automated or recorded device tests**.

---

## State model (UI) — Verified

Defined in `index.tsx`:

| State        | Meaning                                          |
| ------------ | ------------------------------------------------ |
| `idle`       | Armed; no AudioContext work yet (READY/ARMED UI) |
| `starting`   | Gesture-triggered create/resume                  |
| `recovering` | Dead/closed engine rebuild                       |
| `ready`      | Context confirmed `running`                      |
| `suspended`  | Powered off / background / interrupted           |
| `failed`     | Bounded attempt failed; retry UI                 |

`onCtxStateChange` syncs POWER from real context state (not optimistic).

---

## Engine lifecycle — Verified

| Concern        | Implementation                                                                            | Label    |
| -------------- | ----------------------------------------------------------------------------------------- | -------- |
| Creation       | `TX27Engine.start()` — `webkitAudioContext ?? AudioContext`, `latencyHint: "interactive"` | Verified |
| Resume         | Awaited with **4s** timeout (`withTimeout`)                                               | Verified |
| Suspend        | `stop()` ramp + **3s** suspend timeout                                                    | Verified |
| Interrupted    | `needsResume()` treats non-running/non-closed as resumable                                | Verified |
| Closed         | Rejected / rebuilt via UI `isUsable()` check                                              | Verified |
| Serialization  | `runExclusive()` start/stop queue                                                         | Verified |
| Destroy        | Panic, disconnect, async `close()`                                                        | Verified |
| Duplicate init | Shared `readyPromiseRef`                                                                  | Verified |

Overall UI startup race timeout: **8s**.

---

## First gesture — Verified

`ensureAudioReady()` starts AudioContext work **synchronously** before first await (preserves Safari user activation).

Triggers: note (keyboard/computer), POWER/RETRY, preset load/INIT/randomize, entering PLAY mode.
Non-triggers (intentional): pitch/MOD strips.

Pending notes queued during init; `noteOff` during init removes pending note (stuck-note prevention).

---

## Visibility / background — Partial

Listeners: `visibilitychange`, `pagehide`, `pageshow` (incl. bfcache). On background: release sustain, noteOff all, clear pending, clear highlights. On return: resync POWER from engine; **does not auto-resume** (policy-correct). Recovery requires next qualifying gesture — **knob turns do not recover**.

Keyboard also releases on blur/visibility independently.

---

## iOS Safari / installed PWA — Partial

Present: webkit prefix, interrupted handling, resume timeouts, closed rebuild, standalone meta, diagnostics display-mode.
Absent: automated WebKit tests; no explicit `navigator.standalone` fallback (uses display-mode media query). Physical-device matrix **unverified** this audit.

---

## Panic / reconnect — Partial

- **Panic:** clears voices/sustain/bend/highlights; does **not** reconnect AudioContext.
- **Reconnect:** POWER/RETRY / next musical gesture via `ensureAudioReady`.

---

## Cold-launch fixes checklist

| Fix                        | In HEAD `821640d` | In dirty `index.tsx`   |
| -------------------------- | ----------------- | ---------------------- |
| Bounded resume/suspend     | Yes               | —                      |
| Interrupted handling       | Yes               | —                      |
| Gesture-synchronous start  | Yes               | Refined sources logged |
| Closed-context rebuild     | Yes               | —                      |
| Real state sync            | Yes               | —                      |
| Visibility lifecycle       | Yes               | —                      |
| Pending first-note queue   | Yes               | —                      |
| Retry UI                   | Yes               | —                      |
| Startup diagnostics        | Yes               | —                      |
| SW build handshake         | Yes               | —                      |
| Idle as armed (not failed) | —                 | Yes                    |
| Avoid pitch/MOD as unlock  | —                 | Yes                    |

---

## Fragilities (Evidence)

### F1 — Late resume after timeout (Fragile)

`withTimeout` rejects without cancelling `AudioContext.resume()`. Late success can set `powered=true` while preserving `audioState="failed"`, leaving RETRY banner stale; RETRY click may route to powerOff because handler keys off `powered`.

### F2 — Gesture during stop ramp (Fragile)

During 45 ms shutdown, context may still report `running`; `ensureAudioReady` can return early, then queued `stop` kills the note.

### F3 — Outer 8s timer not cancelled (Partial)

`Promise.race` timer may fire after success (handled) but wastes work; operation not abortable.

### F4 — Silent suspend failure (Partial)

`stop()` swallows suspend errors; voices silenced but UI may disagree briefly.

---

## Tests

**Missing** entirely for lifecycle. Highest-priority additions listed in `TEST_GAP_REPORT.md`.

---

## Extraction note

Lifecycle logic in `index.tsx` + timeout/`runExclusive`/`isUsable` pieces in `engine.ts` are the **#1 Foundation Core** candidates. Extract behind a thin `AudioRuntime` that does **not** know about FM patches.
