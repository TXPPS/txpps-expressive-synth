# Foundation Extraction Plan

**Stop condition:** No production refactor until Gates 0–1 accepted and Gate 2 boundary signed.

---

## Goal

Extract a **small** TXPPS Web Synth Foundation that preserves DX27 behavior while enabling a second non-FM proof product.

**Non-goals:** Universal DSP framework, design system rewrite, backend, competing Workshop/TDOS governance, Prophet product build.

---

## Proven extractable systems (Gate 2 candidates)

| System                                      | Source                           | Risk if extracted carefully      |
| ------------------------------------------- | -------------------------------- | -------------------------------- |
| Audio lifecycle UI machine                  | `index.tsx`                      | Medium — high coupling today     |
| Engine timeouts / exclusive ops / usability | `engine.ts`                      | Medium — peel from FM class      |
| PWA SW + inject + handshake                 | `sw.js`, `pwa.ts`, script        | Low                              |
| Keyboard + stuck-note hygiene               | `Keyboard.tsx`                   | Low–medium (styling)             |
| Perf strips                                 | `PerfStrip.tsx`                  | Low                              |
| Settings load/validate                      | `settings.ts` pattern            | Low                              |
| Startup diagnostics                         | `startup-diagnostics.ts`         | Low                              |
| Error capture (local)                       | `error-capture.ts`               | Low                              |
| Patch-library metadata utils                | `patch-library/metadata.ts` etc. | Medium — strip product constants |

## Must stay DX27 (do not extract)

- `FMVoice`, algorithms, Vintage Circuit
- Operator/algorithm UI, factory bank, FM randomizer
- TX27 branding, colors, LCD chrome
- Product-specific sanitizer ranges (until ParameterContract)

## Fix before or during extraction (E defects)

1. Copy `glideMode` in `sanitizeImportedPatch`
2. Decide live-edit policy for active voices (document + implement)
3. Mono retune FM gain retarget
4. Late-resume UI reconciliation
5. Start-during-stop guard

These are **behavior fixes**, not foundation theater — do them on DX27 first if they ship as product bugs.

---

## Phases (aligned to gates)

### Phase 0 — Integrity (Gate 0)

- Confirm canonical repo path (done)
- Pin version: add `package.json` version OR derive from git tag
- Commit or park dirty `index.tsx` so audit baseline is clear
- Optional: `bun install` clean CI job

### Phase 1 — Audit acceptance (Gate 1) ← **current stop**

- Accept these docs
- Approve defect priority
- Approve “folder-first, packages-later” architecture

### Phase 2 — Boundary proof (Gate 2)

- Draft TypeScript interfaces only (no move yet):
  - `SynthEngine` (start/stop/note/panic/setParams/getAnalyser)
  - `ParameterContract` JSON schema
  - `ProductManifest`
- Spike: wrap `TX27Engine` behind `SynthEngine` **in place** without moving files
- Prove DX27 still builds and plays

### Phase 3 — Skeleton (Gate 3)

Create **one** repo folder (not npm publish yet):

```
foundation/
  audio-runtime/
  pwa/
  input/
  state/
  settings/
  diagnostics/
contracts/
products/tx27/   # still the app
```

Move only A-class code that already has a proven interface. No optional modules yet.

### Phase 4 — DX27 migration (Gate 4)

- App imports foundation; product supplies adapter
- Parity checklist: startup, offline, presets, keyboard, FX, Vintage

### Phase 5 — Regression (Gate 5)

- Manual device matrix + new automated lifecycle tests
- ZIP packaging script

### Phase 6 — Second-synth proof (Gate 6)

- Minimal 5-voice subtractive: 1 osc, ADSR, LPF, master
- Reuse foundation shell/PWA/keyboard
- **No** FM imports allowed in proof product

### Phase 7 — Foundation release (Gate 7)

- Version tag, `AGENT_START_HERE.md`, feature registry JSON, clean ZIP

---

## Token-efficiency mechanisms (ship with foundation)

| Artifact                    | Purpose                              | Max size target  |
| --------------------------- | ------------------------------------ | ---------------- |
| `AGENT_START_HERE.md`       | Single entry for agents              | ≤150 lines       |
| `FEATURE_REGISTRY.json`     | Verified/Missing/Partial flags       | Machine-readable |
| `ARCHITECTURE_MAP.md`       | One diagram + file pointers          | ≤80 lines        |
| `contracts/*`               | Implement without reading DSP        | Stable           |
| `scripts/audit-offline.mjs` | Repeatable checks                    | —                |
| `scripts/new-synth.mjs`     | Scaffold product                     | —                |
| `prompts/*.md`              | Tiny task prompts                    | ≤40 lines each   |
| Test report artifacts       | Stop re-investigating known behavior | CI               |

**Do not** generate encyclopedic docs that agents must re-read every session.

---

## Challenge: monorepo vs copy

Given ~123 source files and one product, **do not** start with npm workspaces / publishable packages. A single repo with `foundation/` + `products/tx27/` is enough through Gate 6. Split packages only if a second commercial product lands and version skew hurts.
