# Proposed Foundation Architecture

**Hypothesis challenged:** The starter tree with many `optional-modules/` packages is **too large** for current evidence. Prefer a lean layout until Gate 6.

---

## Decision: folder-first single repo

Recommended initial shape (improved from the brief):

```text
TXPPS-Web-Synth-Foundation/          # or evolve TX27 repo into this
├── AGENT_START_HERE.md
├── FEATURE_REGISTRY.json
├── foundation/                      # A — required runtime
│   ├── audio-runtime/               # context lifecycle, exclusive ops, output safety
│   ├── app-shell/                   # root document helpers, safe-area, viewport
│   ├── input/                       # note router, computer keyboard map, panic helpers
│   ├── state/                       # localStorage helpers, safe JSON
│   ├── settings/                    # typed settings load/save pattern
│   ├── pwa/                         # sw template, register, build handshake
│   ├── diagnostics/                 # local startup traces
│   └── testing/                     # audio mocks, lifecycle harness
├── contracts/                       # source of truth (not React)
│   ├── SynthEngine.ts
│   ├── ParameterContract.schema.json
│   ├── PresetContract.schema.json
│   ├── ProductManifest.schema.json
│   └── NativeEquivalence.md         # pointer to native-reference/
├── optional/                        # B — import only if product wants
│   ├── keyboard/
│   ├── meters/
│   ├── midi/                        # Web MIDI + capability gating
│   ├── effects-shell/               # graph helpers, not specific FX algorithms
│   └── preset-browser/
├── products/
│   └── tx27/                        # D — current app moves here over time
├── templates/
│   └── new-synth/                   # Gate 6 scaffold
├── native-reference/                # permanent JUCE translation package (docs+JSON)
├── scripts/
│   ├── build.mjs
│   ├── validate.mjs
│   ├── package-zip.mjs
│   └── new-synth.mjs
└── docs/                            # short; audits archived under docs/audit/
```

### Explicitly deferred

- `scope/` oscilloscope module — not present; don’t invent
- Separate `effects-shell` package until two products share FX
- Design-system / Radix purge can wait; quarantine unused UI first

---

## Core contracts (minimal)

### SynthEngine

```ts
interface SynthEngine {
  start(): Promise<void>;
  stop(): Promise<void>;
  destroy(): void;
  isUsable(): boolean;
  isRunning(): boolean;
  contextState(): string;
  onStateChange(cb: ((s: string) => void) | null): void;
  noteOn(note: number, velocity: number): void;
  noteOff(note: number): void;
  setSustain(on: boolean): void;
  panic(): void;
  setPitchBend(norm: number): void;
  setModWheel?(norm: number): void;
  setParameters(patch: unknown): void; // typed per product via adapter
  getAnalyser(): AnalyserNode | null;
}
```

Foundation owns lifecycle orchestration **around** this interface. Product owns DSP behind it.

### ProductManifest

- `id`, `displayName`, `version`, `parameterContractId`, `presetProductTag`
- PWA: `cachePrefix`, `themeColor`, `icons`
- Capabilities: `midi: boolean`, `offline: boolean`

### ParameterContract

Flat stable IDs, e.g. `op1.ratio`, `filter.cutoff`, `fx.reverb.mix` — suitable for APVTS.
Each entry: type, min, max, default, step, unit, automate, smoothMs, migrateFrom[].

---

## Runtime ownership rules

1. **No product DSP in UI components**
2. **No UI React state inside audio nodes** — UI sends intents; engine applies
3. **One parameter registry** — UI, sanitizer, tests, native docs all read it
4. **One persistence schema version** with explicit migrations
5. **Capability detection over marketing claims**

---

## Technology stance

| Choice                                     | Recommendation                                                     |
| ------------------------------------------ | ------------------------------------------------------------------ |
| Keep React + Vite + TanStack for TX27      | Yes — do not rewrite for preference                                |
| Require TanStack SSR for all future synths | **No** — allow static Vite SPA template                            |
| Bun                                        | Fine as package manager; document Node fallback                    |
| Cloudflare Workers                         | TX27 deploy adapter; foundation should also support static hosting |
| Shared UI kit (Radix)                      | Optional; products may keep lean custom controls                   |

---

## Hierarchy fit

```
Hunter → TXPPS Workshop → TDOS → TDH → Project Workspace → Product
                              ↓
                 Web Synth Foundation (technical asset)
                              ↓
                    Product adapters (TX27, …)
```

Foundation does not invent governance; it ships contracts + runtime + scripts Workshop/TDOS can reference.
