# DX27 / TX27 Current-State Audit

**Audit date:** 2026-07-17
**Audited path (requested):** `C:\Users\TXPPS\Documents\APP Builds\TXPPS-TX27-FM-Synth TX27` — **does not exist**
**Actual project root:** `C:\Users\TXPPS\Documents\APP Builds\TXPPS-TX27-FM-Synth`
**Authority:** Primary evidence = working tree + git + build output. Status reports were not trusted.

---

## Gate 0 — Source integrity (summary)

| Item                                 | Result                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| Path integrity                       | Requested folder name with trailing ` TX27` missing; canonical checkout found |
| Build from existing `node_modules`   | **PASS** — `bun run build` succeeds                                           |
| Clean install rebuild                | **Present but unverified** this session (deps already installed)              |
| Lint                                 | **FAIL** — ~12k Prettier CRLF (`Delete ␍`) errors; not functional             |
| Automated tests                      | **Missing** — no test runner, no `*.test.*` / `*.spec.*`                      |
| Production behavior changed by audit | **No** — docs only                                                            |

### Version / identity

| Field                           | Value                                                                                | Status                |
| ------------------------------- | ------------------------------------------------------------------------------------ | --------------------- |
| UI version string               | `v1.0.0` (hardcoded in `src/routes/index.tsx`)                                       | Present               |
| `package.json` version          | **Missing**                                                                          | Missing               |
| Git branch                      | `main` (tracks `origin/main`)                                                        | Verified              |
| HEAD SHA                        | `821640d3a0581b87fced006a1d74228d87cda7ab`                                           | Verified              |
| Short build ID                  | `821640d` (baked into client + SW)                                                   | Verified              |
| HEAD message                    | `Fix TX27 mobile PWA audio startup and recovery`                                     | Verified              |
| HEAD date                       | 2026-07-17 06:35:20 -0500                                                            | Verified              |
| Working tree                    | **Dirty** — uncommitted refinements in `src/routes/index.tsx` (+ `routeTree.gen.ts`) | Verified              |
| Deploy target                   | Cloudflare Worker `txpps-tx27`                                                       | Verified              |
| Documented URL                  | `https://txpps-tx27.toppsmusicproductions.workers.dev`                               | Documented            |
| Last local build (`nitro.json`) | `2026-07-17T14:15:26.857Z`                                                           | Verified this session |
| SW cache version (this build)   | `6bf5a9ec6650`                                                                       | Verified              |

**Verdict on “latest ZIP”:** There was no separate ZIP attachment in this workspace. The audited checkout is the live git repo. HEAD contains the cold-launch / mobile PWA audio recovery work. The working tree is **slightly ahead** of HEAD with further idle/gesture cold-launch UI refinements. Treat **HEAD + dirty `index.tsx`** as current intended state, not a stale export.

---

## 1. Repository and build integrity

### Stack (verified)

- **Language:** TypeScript / TSX
- **UI:** React 19 + TanStack Start / TanStack Router (SSR)
- **Build:** Vite 8 + Nitro (`cloudflare-module`)
- **Package manager:** Bun (`bun.lock`, `bunfig.toml`)
- **Styling:** Tailwind CSS 4 + project CSS
- **Audio:** Web Audio API (no WASM DSP)
- **Deploy:** `wrangler deploy --name txpps-tx27`

### Entry points (verified)

| Role                                | Path                      |
| ----------------------------------- | ------------------------- |
| Router / QueryClient                | `src/router.tsx`          |
| HTML shell / PWA meta / SW register | `src/routes/__root.tsx`   |
| Instrument UI + audio orchestration | `src/routes/index.tsx`    |
| SSR / Cloudflare fetch wrapper      | `src/server.ts`           |
| Start bootstrap                     | `src/start.ts`            |
| Engine                              | `src/lib/audio/engine.ts` |

No source `index.html` / `App.tsx` — SSR generates the shell.

### Scripts

| Script    | Purpose                         | Verified            |
| --------- | ------------------------------- | ------------------- |
| `dev`     | `vite dev`                      | Present             |
| `build`   | Vite build + SW precache inject | **Works**           |
| `preview` | `vite preview`                  | Present             |
| `deploy`  | build + wrangler                | Present             |
| `lint`    | eslint                          | Runs; fails on CRLF |
| `test`    | —                               | **Missing**         |

### External services

| Service                     | Required for synthesis?                 |
| --------------------------- | --------------------------------------- |
| Cloudflare Worker (hosting) | Online first load / updates only        |
| Network after warm cache    | **Not required** for offline play       |
| Analytics / auth / DB       | **None**                                |
| CDN fonts/scripts           | **None** (self-hosted JetBrains Mono)   |
| Lovable editor hooks        | Optional; no-op outside Lovable preview |

### Dead / duplicate / scaffolding

- **46** unused shadcn `src/components/ui/*` components (starter bloat) — Legacy
- `src/lib/lovable-error-reporting.ts` — editor-only
- `src/lib/patchStorage.ts` — legacy v1 key path (retained for migration)
- Generated: `.output/`, `.tanstack/`, `.wrangler/`, `node_modules/` (gitignored)

### Reproducibility

- Build ID from `git rev-parse --short HEAD` → not reproducible from a git-less tarball (`unknown`)
- SW cache version = content hash of asset inventory → reproducible for same asset set
- Worker name in Nitro auto-gen differs from deploy script override (`txpps-tx27`) — fragile naming, not a runtime bug

---

## 2–10. Audit area pointers

Detailed findings live in sibling documents:

| Area                             | Document                              |
| -------------------------------- | ------------------------------------- |
| Audio lifecycle                  | `AUDIO_LIFECYCLE_AUDIT.md`            |
| Engine / params / classification | `REUSABILITY_CLASSIFICATION.md`       |
| PWA / offline                    | `PWA_OFFLINE_AUDIT.md`                |
| Device / MIDI                    | `DEVICE_AND_MIDI_COMPATIBILITY.md`    |
| Tests                            | `TEST_GAP_REPORT.md`                  |
| Risks                            | `RISK_REGISTER.md`                    |
| Extraction plan                  | `FOUNDATION_EXTRACTION_PLAN.md`       |
| Architecture proposal            | `PROPOSED_FOUNDATION_ARCHITECTURE.md` |
| Native / JUCE                    | `NATIVE_EQUIVALENCE_PLAN.md`          |
| Decisions                        | `DECISION_LOG.md`                     |
| Gates                            | `IMPLEMENTATION_GATES.md`             |

---

## Architecture snapshot (verified)

```
User gesture → ensureAudioReady() [index.tsx]
            → TX27Engine.start() [engine.ts]
            → AudioContext + buildGraph()
            → FMVoice × N [voice.ts] via algorithms.ts
            → Vintage → LPF → Chorus → Delay → Reverb → Limiter → Master → Analyser → destination
```

**Product identity:** TXPPS TX27 — four-operator FM + Vintage Circuit + FX, mobile-first PWA.

---

## Feature registry (honesty labels)

| Feature                                      | Label                                                          |
| -------------------------------------------- | -------------------------------------------------------------- |
| Desktop browser play                         | Verified (code); physical QA unverified                        |
| Android / iOS browser play                   | Present; cold-launch fixes present; device QA unverified       |
| Installable PWA                              | Verified in code + manifest                                    |
| Offline after warm-up                        | Verified by SW design; airplane retest unverified this session |
| On-screen keyboard + multi-touch + glissando | Verified                                                       |
| Computer keyboard                            | Verified                                                       |
| Hardware MIDI                                | **Missing**                                                    |
| Theme light/dark                             | **Missing** (fixed dark panel)                                 |
| Automated test suite                         | **Missing**                                                    |
| Parameter ID contract for JUCE               | **Missing**                                                    |
| Engine-replaceable runtime                   | **Partial** — lifecycle reusable; engine façade is FM-coupled  |

---

## Critical defects (verified in code)

1. **`glideMode` dropped** by `sanitizeImportedPatch` → imports / v2 reloads reset to `"off"`.
2. **Live FM/operator edits** do not update active voices (`setPatch` only pushes FX/filter/master).
3. **Mono retune** changes pitch without retargeting FM modulation gains → FM index drift.
4. **Vintage `drift`** modulates amplitude (`postGain`), not pitch — naming mismatch.
5. **Late `resume()` after timeout** can leave UI in `failed` while context is running.
6. **Start during stop ramp** can accept a gesture then kill notes when stop finishes.

---

## Bottom line

TX27 is a **working, buildable, deployable** mobile FM PWA with unusually strong audio-startup and offline infrastructure for its size. It is **not** yet a reusable multi-engine foundation: the product route owns lifecycle + FM UI, the engine owns FM voices, and there is **no** formal parameter contract, **no** Web MIDI, and **no** automated tests.

**Production code was not modified by this audit.**
