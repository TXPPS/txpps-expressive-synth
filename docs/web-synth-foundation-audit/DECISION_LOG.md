# Decision Log

Gate 1 audit decisions plus the accepted Gate 2 boundary work.

| ID  | Date       | Decision                                                                                   | Rationale                                                       | Status                           |
| --- | ---------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | -------------------------------- |
| D1  | 2026-07-17 | Canonical source path is `...\TXPPS-TX27-FM-Synth`, not `...\TXPPS-TX27-FM-Synth TX27`     | Requested path missing; git repo found                          | Accepted                         |
| D2  | 2026-07-17 | Treat HEAD `821640d` + dirty `index.tsx` as current intended implementation                | Cold-launch commit present; uncommitted refinements continue it | Accepted for audit               |
| D3  | 2026-07-17 | Do not refactor production code in this phase                                              | User Gate 1 stop rule                                           | Accepted                         |
| D4  | 2026-07-17 | Folder-first foundation; defer npm workspaces/packages until after Gate 6                  | Repo ~123 files; one product; avoid token/overhead              | Proposed — needs Gate 1 approval |
| D5  | 2026-07-17 | Keep React/Vite/TanStack for TX27; do not rewrite stack                                    | Working build; constraint against preference rewrites           | Proposed                         |
| D6  | 2026-07-17 | Do not require SSR/Cloudflare for all future synths                                        | Foundation must allow static SPA                                | Proposed                         |
| D7  | 2026-07-17 | Web MIDI is optional module; TX27 currently has none; never claim iOS Web MIDI             | Code + platform reality                                         | Accepted                         |
| D8  | 2026-07-17 | ParameterContract with stable flat IDs is mandatory before native work                     | Patch nested objects unsuitable for APVTS                       | Proposed                         |
| D9  | 2026-07-17 | Extract AudioRuntime + PWA first; leave FM DSP in product                                  | Highest reuse, lowest contamination                             | Proposed                         |
| D10 | 2026-07-17 | Fix glideMode sanitizer as product defect (not “foundation only”)                          | User data loss                                                  | Proposed priority                |
| D11 | 2026-07-17 | Challenge optional-modules sprawl (scope, effects packages) until second synth shares them | YAGNI                                                           | Proposed                         |
| D12 | 2026-07-17 | Foundation sits under Hunter→Workshop→TDOS→TDH hierarchy as technical asset                | User authority rule                                             | Accepted                         |
| D13 | 2026-07-17 | Second-synth proof must be minimal subtractive 5-voice, not Prophet product                | Gate 6 intent                                                   | Accepted                         |
| D14 | 2026-07-17 | Audit deliverables live in `docs/web-synth-foundation-audit/`                              | Keeps product root clean                                        | Accepted                         |
| D15 | 2026-07-17 | Lint CRLF failure does not block Gate 0 build integrity                                    | Build succeeded; lint is tooling noise                          | Accepted                         |
| D16 | 2026-07-17 | Use one generic `SynthEngine<State>` and one `SynthRuntime`; no DI/container/event bus     | Smallest boundary proven by current app                         | Implemented                      |
| D17 | 2026-07-17 | Keep TX27 FM engine intact behind `TX27ProductEngine`                                      | Avoid sound rewrite in Gate 2                                   | Implemented                      |
| D18 | 2026-07-17 | Stable IDs map to existing patch fields; persisted patch fields are not renamed            | Avoid preset corruption                                         | Implemented                      |
| D19 | 2026-07-17 | App settings remain outside parameter contract                                             | DSP/preset and application state have different lifetimes       | Implemented                      |
| D20 | 2026-07-17 | Fix `glideMode` loss and late-resume UI reconciliation only                                | Directly required for boundary validation                       | Implemented                      |
| D21 | 2026-07-17 | Non-FM proof is silent/in-memory, not a second product                                     | Gate 6 remains separate                                         | Implemented                      |
| D22 | 2026-07-17 | Add a minimal Playwright smoke layer (`tests/e2e`) for Gate 2 validation                    | Matrix needs real browser behavior; unit sims cannot cover it  | Implemented                      |
| D23 | 2026-07-17 | Run smoke against real `.output` via `wrangler dev`, not `vite preview`/dev                 | Only the built worker exercises the real SW/precache/SSR shell | Implemented                      |
| D24 | 2026-07-17 | Use `.e2e.ts` suffix so Vitest never picks up Playwright specs                              | Vitest default matches `*.test/*.spec`; keep runners separate  | Implemented                      |
| D25 | 2026-07-17 | iPhone emulation uses the WebKit engine; label EMU, never physical iOS                      | Closest iOS-Safari approximation available on Windows          | Implemented                      |
| D26 | 2026-07-17 | Add `start:local` one-command launch wrapping build + wrangler + open-once                  | Convenience without replacing Cloudflare build architecture    | Implemented                      |
| D27 | 2026-07-17 | Do not fix FM sound-design defects; observe only (headless has no audio output)             | Out of Gate 2 validation scope; not blocking                   | Accepted                         |
| D28 | 2026-07-17 | Commit the complete validated Gate 2 boundary, tests, audit, and native reference together | GitHub must match the tested implementation before mobile work | Implemented                      |
| D29 | 2026-07-17 | Exclude the unresolved `public/favicon.ico` deletion from Gate 2                            | Asset is still referenced; no evidence ties deletion to Gate 2 | Accepted                         |

---

## Deferred decisions (need explicit approval)

- Whether pre-existing live-edit / retune fixes land before extraction
- Whether TX27 repo becomes the foundation monorepo or a new repo is created
- Theme system necessity
- JUCE timeline for TX27 specifically
