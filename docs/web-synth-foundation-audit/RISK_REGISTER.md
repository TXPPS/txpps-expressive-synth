# Risk Register

| ID  | Risk                                                  | Severity        | Likelihood       | Evidence                            | Mitigation                                           | Owner gate       |
| --- | ----------------------------------------------------- | --------------- | ---------------- | ----------------------------------- | ---------------------------------------------------- | ---------------- |
| R1  | `glideMode` silently lost on import/v2 load           | High            | Certain          | `sanitizeImportedPatch` omits field | Copy/clamp `glideMode`; add unit test                | Before Gate 4    |
| R2  | Live FM/operator knobs don’t affect held notes        | High            | Certain          | `setPatch` skips voice DSP          | Document policy; update voices or disable live claim | Gate 4           |
| R3  | Mono retune changes FM index                          | Medium          | Certain          | `retune` skips mod/feedback gains   | Retarget gains on retune                             | Gate 4           |
| R4  | Late resume leaves UI `failed` while audio runs       | High            | Medium           | timeout vs uncancellable resume     | Reconcile on statechange; clear error if running     | Gate 3–5         |
| R5  | Gesture during stop ramp drops notes                  | Medium          | Medium           | 45 ms running-during-stop           | Treat stop-in-flight as not ready                    | Gate 3–5         |
| R6  | No automated tests → regressions during extraction    | High            | High             | zero test files                     | P0 Vitest suite before moves                         | Gate 2–5         |
| R7  | Extraction accidentally couples foundation to FM      | High            | Medium           | `TX27Engine` monolith               | Interface spike before file moves                    | Gate 2           |
| R8  | Over-architecture burns tokens without second product | Medium          | High             | optional module sprawl temptation   | Folder-first; Gate 6 proof required                  | All              |
| R9  | CRLF lint failure hides real issues                   | Low             | Certain          | 12k prettier errors                 | `.gitattributes` / format once                       | Anytime          |
| R10 | Dirty tree vs HEAD ambiguity for “latest”             | Medium          | Certain          | uncommitted `index.tsx`             | Commit or revert before Gate 2                       | Gate 0/1         |
| R11 | Package name / Worker auto-name drift                 | Low             | Certain          | nitro name vs `txpps-tx27`          | Document deploy script as source of truth            | Ops              |
| R12 | Unused shadcn + `dangerouslySetInnerHTML` surface     | Low             | Low              | dead `chart.tsx`                    | Delete unused UI kit                                 | Gate 3           |
| R13 | iOS Safari audio edge cases unproven in lab           | High            | Medium           | no device report in repo            | Manual matrix + registry                             | Gate 5           |
| R14 | False MIDI marketing                                  | High if claimed | N/A              | no Web MIDI code                    | Capability UI; never claim iOS MIDI                  | Always           |
| R15 | Vintage “drift” ≠ pitch drift                         | Medium          | Certain          | modulates `postGain`                | Spec decision; rename or fix                         | Native + product |
| R16 | Reverb nondeterminism (`Math.random` early refs)      | Low             | Certain          | `reverb.ts`                         | Seeded RNG                                           | Native parity    |
| R17 | Parameter range drift UI vs sanitizer                 | Medium          | Certain          | feedback 0.8 vs 0.85; cutoff ranges | Single ParameterContract                             | Gate 3           |
| R18 | SSR/Cloudflare required for simple synths             | Medium          | Medium           | TanStack Start stack                | Static SPA template option                           | Gate 6–7         |
| R19 | Storage quota / private mode                          | Medium          | Low              | catch-swallowed writes              | Diagnostics + user messaging                         | Gate 5           |
| R20 | Lovable history constraints                           | Medium          | —                | `AGENTS.md`                         | No force-push/rebase of published history            | Always           |
| R21 | Agent re-audit loops without registry                 | Medium          | High             | large codebase                      | `FEATURE_REGISTRY.json` + AGENT_START_HERE           | Gate 3           |
| R22 | Silent change of preset IDs breaks users              | High            | Medium if rushed | nested Patch JSON in wild           | Aliases + migrateFrom; never silent rename           | Native plan      |

---

## Top 5 to act on first

1. R1 glideMode loss
2. R6 test vacuum
3. R4/R5 lifecycle races
4. R7 FM coupling during extraction
5. R13 iOS verification

---

## Risks explicitly accepted for now

- Fixed dark theme (product identity)
- No Web MIDI in TX27 v1
- No pinch-zoom (instrument choice)
- Offline requires prior warm-up
