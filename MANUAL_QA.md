# TXPPS TX-80 — Manual QA Checklist

Every claim of "works" must be checked against this list in the live preview. Do not mark items complete based on a passing build alone.

## Milestone 1 — Responsive shell
- [ ] `bun run build` succeeds
- [ ] Preview loads without red console errors
- [ ] Header renders with FULL / EDIT / PLAY + status pill + PANIC
- [ ] Preset bar shows the default patch name
- [ ] Layer I and Layer II panels render independently
- [ ] Modulation, FX, and Master panels render
- [ ] Ribbon renders with mode readout
- [ ] Keyboard renders with adaptive width for viewport
- [ ] Phone portrait (~390×844): no horizontal page scroll, all panels reachable by vertical scroll
- [ ] Phone landscape (~844×390): performance zone dominates, keyboard playable
- [ ] Tablet portrait (~810×1080): panels reflow to 2-col
- [ ] Tablet landscape (~1194×834): panels reflow to 3-col
- [ ] Desktop (1440×900): full workstation without overlap
- [ ] Rotate device: UI state (params) preserved

## Milestone 2 — Audio + Layer I
- [ ] TAP TO ENABLE AUDIO succeeds (status → READY)
- [ ] Keyboard produces sound
- [ ] Multiple simultaneous fingers → polyphonic sound
- [ ] Note release stops sound cleanly
- [ ] PANIC kills all notes
- [ ] Voice stealing behaves at polyphony limit

## Milestone 3 — Layer II
- [ ] Layer II alone produces sound (mute Layer I)
- [ ] Layer I alone produces sound (mute Layer II)
- [ ] Both layers together sound combined + panned

## Milestone 4 — Portamento / Glissando / Ribbon
- [ ] Portamento glide is continuous
- [ ] Glissando steps in semitones
- [ ] Ribbon tracks pointer including outside bounds
- [ ] No stuck pitch / notes after pointer cancel

## Milestone 5 — Mod, FX, Presets, MIDI, safety
- [ ] LFO destination change resets previous target
- [ ] Reverb enable does not click
- [ ] Preset save/load round-trips every serialized param
- [ ] User presets survive refresh
- [ ] MIDI (if available) triggers notes

## Milestone 6 — Responsive polish
- [ ] All layouts re-verified after audio wiring

## Milestone 7 — PWA
- [ ] Manifest served
- [ ] Service worker disabled in preview
- [ ] Installed app loads offline
