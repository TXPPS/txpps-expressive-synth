# TX-80 Manual QA — Human Verification Checklist

Automated coverage (unit + real-browser e2e) is recorded in
CURRENT_STATUS.md. This file lists what a HUMAN must still verify, because
this build environment cannot hear audio, has no WebKit/Edge browsers, and
has no physical devices.

## 1. Listening tests (required — cannot be automated here)

- [ ] Overall sound of each factory preset (Dual Strings, Velvet Brass,
      Glass Pad, Twin Bass, Ribbon Lead, Stepped Sky, Hollow Organ,
      Drift Choir, Pan Weaver, Init Layered) — level balance, character,
      release tails.
- [ ] Layer blending: Layer I alone, Layer II alone, both, muted states,
      opposite pans, detuned fine offsets (beating should be audible).
- [ ] Pulse width sweep by ear (static PW knob + LFO→PW) — audible timbre
      motion, acceptable aliasing at high pitches.
- [ ] Filter: cutoff sweep smoothness, resonance up to maximum at high
      polyphony (limiter must prevent harsh overload), envelope amount
      positive AND negative, key tracking across the keyboard.
- [ ] Portamento: smooth continuous glide, no zipper noise, exact arrival;
      short vs long TIME; solo legato vs poly behavior.
- [ ] Glissando: clearly discrete semitone steps up AND down, exact final
      pitch, interruption by a new note mid-travel.
- [ ] Ribbon in all three modes: no pitch jump on first touch, stepped
      audibility in GLISS, spring-back to true center, HOLD retention.
- [ ] LFOs at every destination — musical depth scaling, clean disable, no
      residual offset after destination changes, balance wobble behavior.
- [ ] Effects by ear: chorus width/rate, delay repeats + feedback safety at
      maximum, all three reverb types, bypass toggles (no level jump).
- [ ] Voice stealing audibility at 4V under fast playing (steal fade should
      be unobtrusive).
- [ ] Mod wheel vibrato depth taste; pitch-bend range settings.

## 2. Physical-device tests (as done for TX27 Gate 2)

- [ ] iPhone (Safari + installed PWA): launch, gesture audio start, first
      note, multitouch chords, ribbon with a second finger while holding
      keys, rotation while holding notes, screen lock/return, background/
      return, panic.
- [ ] Android phone + tablet (Chrome + installed PWA): same list.
- [ ] Airplane-mode relaunch of the installed PWA (offline precache).
- [ ] Real multitouch: several fingers on keys + one on ribbon + one on
      PITCH strip simultaneously (mouse-based e2e cannot exercise this).
- [ ] Hardware MIDI keyboard: ENABLE MIDI in SETUP, note on/off, velocity,
      sustain pedal, pitch bend, mod wheel, unplug → all notes release,
      replug → keeps working.

## 3. Browser-matrix tests not runnable in this container

- [ ] WebKit/iOS Safari emulation + real Safari (only Chromium installed
      here).
- [ ] Microsoft Edge channel run of `desktop-smoke.e2e.ts`.

## 4. Manual UI spot checks (verified by emulation, worth eyeballing)

- [ ] Desktop FULL: both layer panels side by side; PERF/MOD/OUT/FX reachable
      by scrolling the panel area; no clipped knobs.
- [ ] Phone portrait FULL: six-tab strip; every tab's panel fits; keyboard +
      ribbon reachable; no horizontal scroll.
- [ ] Phone landscape: ribbon + keyboard + PITCH/MOD immediately usable.
- [ ] PLAY mode on phone portrait and landscape; EDIT mode hides keyboard
      and releases held notes.
- [ ] Rotation mid-note: note releases (by design), no stuck highlight, same
      preset still loaded, audio still ON.

## How to run everything locally

```bash
bun install
bun run test          # 32 unit tests
bun run typecheck
bun run build
bun run test:e2e      # full Playwright matrix (needs its browsers installed)
bun run dev           # development server on :3000
bun run serve:prod    # production build on :8788 (after bun run build)
```
