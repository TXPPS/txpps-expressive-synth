# TX-80 Control Connection Audit (Gate 2)

Audit date: post selection-lock + diagnostics pass.
Authority: this audit describes the product as shipped on **`main`**
after Gate 1+2 consolidation.

| Control | Status | Notes |
|---------|--------|-------|
| Header FULL/EDIT/PLAY | CONNECTED | Layout visibility changes |
| Header READY pill | CONNECTED | Reflects audioStatus |
| Header PANIC | CONNECTED | Clears voices, ribbon, sustain |
| Header SETTINGS | CONNECTED | Modal with SYSTEM/AUDIO/MIDI/DIAGNOSTICS/ABOUT |
| Patch prev/next | CONNECTED | 18 factory + user |
| Patch SAVE | CONNECTED | localStorage user presets |
| Patch favorite | CONNECTED | local favorite set |
| Layer I/II visible knobs | CONNECTED | Mapped via PARAM_MAP |
| Modulation LFOs | CONNECTED | Mapped |
| Effects chorus/delay/reverb | CONNECTED | Mapped |
| Master level | CONNECTED | → master.volume |
| Tune | CONNECTED | → master.tune (cents detune) |
| Poly | CONNECTED | snapped 4/8/12/16 |
| Portamento / Glide | CONNECTED | pitchTravel derived |
| Glissando / Step | CONNECTED | pitchTravel derived |
| Ribbon mode continuous/glissando/hold | CONNECTED | Engine pitch/gliss/hold |
| Ribbon trigger | DISABLED WITH EXPLANATION | Pending Gate 7; not selectable |
| Ribbon range | CONNECTED | Engine ribbon.range |
| Ribbon gesture | CONNECTED | setRibbonPosition / releaseRibbon |
| Pitch wheel | CONNECTED | setPitchBend |
| Mod wheel | CONNECTED | setModulation |
| Sustain | CONNECTED | Large target under octave |
| Octave ± / C# display | CONNECTED | Local keyboard range |
| Keyboard multitouch | CONNECTED | playNote/releaseNote |
| MIDI section | DISABLED WITH EXPLANATION | Deferred Gate 5 |
| Layer params not on panel (pwm, filt.type, drive, modAmt) | DISABLED WITH EXPLANATION | Gate 6 mapping |

## Selection lock

- Shell: `user-select: none`, `-webkit-touch-callout: none`
- Perf surfaces: `.tx80-perf-surface` + `touch-action: none`
- Exception: `.tx80-diag-terminal` selectable/copyable
- Inputs that require typing remain selectable

## Preview

https://txpps-tx-80.toppsmusicproductions.workers.dev/
