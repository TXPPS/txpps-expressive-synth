# TXPPS TX-80 — Architecture

Status: **Milestone 1 in progress** — responsive shell, design system, state scaffolding, parameter registry. No audio engine yet.

## Module map

```
src/
  audio/            (M2+) AudioContext, engine, voices, effects, mod, portamento, glissando, midi
  state/
    params.ts       ✅ Authoritative parameter registry (single source of truth)
    store.ts        ✅ Zustand store: patch + UI + transient perf state
    presets.ts      (M5) IndexedDB user presets + bundled factory presets
  components/
    synth/
      Header.tsx           ✅ Brand + mode tabs + status + panic
      PresetBar.tsx        ✅ Current patch readout (functional prev/next in M5)
      Panel.tsx            ✅ Consistent panel chrome
      LayerPanel.tsx       ✅ Reused for Layer I & II — all controls in registry
      ModPanel.tsx         ✅ LFO1 / LFO2 controls
      FxPanel.tsx          ✅ Chorus / Delay / Reverb controls
      MasterPanel.tsx      ✅ Master, portamento, glissando, ribbon config
      PerformanceStrip.tsx ✅ Pointer-driven pitch / mod / sustain
      Ribbon.tsx           ✅ Pointer-capture ribbon (visual + state; engine hook in M4)
      Keyboard.tsx         ✅ Multitouch keyboard with per-pointer note tracking
  routes/
    index.tsx       ✅ Full responsive shell
    __root.tsx      ✅ Head metadata, fonts, error boundaries
  pwa/              (M7)
```

## Signal path (target — implemented incrementally)

```
UI control → Zustand store → engine.setParam(id, v) → node.param
Keyboard  → engine.noteOn(midi, vel) → voice = allocate()
                                        ├─ Layer I sub-voice → OSC → VCF → VCA → layer bus
                                        └─ Layer II sub-voice → OSC → VCF → VCA → layer bus
                                                                  layer bus → LFO mod
                                                                              → Chorus → Delay → Reverb
                                                                              → Master limiter → destination
```

## Responsive layout strategy

Not a "shrink desktop" layout. CSS Grid areas rearrange:

| Viewport | Layout |
|---|---|
| Phone portrait (<640) | Single column, stacked panels, keyboard anchored bottom |
| Phone landscape (<500h) | Main panels hidden; performance zone (pitch/mod/ribbon/keys) fills screen |
| Tablet (640–1023) | 2-column layer grid + mod/fx row + full-width master |
| Desktop (1024–1399) | 3-column workstation with wide keyboard footer |
| Wide desktop (≥1400) | 4-column top row + full-width performance footer |

All layouts share the same DOM tree — no route swaps, no state loss on rotation.
