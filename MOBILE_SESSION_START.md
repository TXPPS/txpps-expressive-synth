# TX27 Mobile Session Start

## Project identity

- **Project:** TXPPS TX27 mobile FM synthesizer
- **Purpose:** Production browser/installable PWA and source for the reusable
  TXPPS Web Synth Foundation boundary
- **Local root:** `C:\Users\TXPPS\Documents\APP Builds\TXPPS-TX27-FM-Synth`
- **GitHub:** `https://github.com/TXPPS/TXPPS-TX27-Replit-Refinement`
  (private)
- **Branch:** `main`
- **Verified Gate 2 implementation commit:**
  `366ae915b6b260089298b339a825b8a6fbed82f4`
- **Authoritative GitHub HEAD:** the handoff-correction commit containing this
  file, immediately after the implementation commit above. Confirm its exact
  hash with `git log -1 --oneline` after pulling.

## Current state

- Gate 1: **ACCEPTED**
- Gate 2: **COMPLETE — PASS**
- Gate 3: **READY, NOT STARTED, NOT AUTHORIZED**
- Automated tests: **21/21 PASS**
- Browser/emulation checks: **40/40 PASS**
- Physical validation: **PASS** on iPhone 16 Pro Max and Samsung Galaxy Tab A11
- Gate 2 implementation, tests, audit, native reference, and completion
  documentation are all present on `origin/main`
- Non-blocking gaps: exact OS/browser versions; offline/airplane relaunch;
  forced-failure retry; screen-lock recovery; update testing
- Preserved desktop-only local state: unresolved deletion of
  `public/favicon.ico`; content-identical `src/routeTree.gen.ts` worktree marker

## Protected behavior

Do not regress audio startup, first-note preservation, AudioContext recovery,
browser/PWA lifecycle, preset loading, responsive layout, touch interaction,
panic behavior, or existing TX27 DSP/product behavior.

## Next authorized action

Gate 3 has not started and may begin only after explicit authorization. The
next intended task is extraction and stabilization of the reusable TXPPS Web
Synth Foundation. Do not begin P5IVE product implementation yet. Mobile work
must start only after pulling a commit at or after the verified Gate 2
implementation hash above and confirming no history divergence.

## Work by environment

**Mobile-safe:** documentation/status updates, architecture review, small
isolated edits, parameter-contract work, test planning, roadmap refinement,
Git review, and documentation commits.

**Desktop-preferred:** long builds, Playwright suites, Wrangler/local-server
testing, physical-device hosting, broad refactors, audio debugging, dependency
upgrades, large migrations, and release packaging.

## Essential commands

```powershell
bun install --frozen-lockfile
bun run test
bun run build
bun run test:e2e:build
bun run start:local
git status --short --branch
git pull --ff-only
git push
```

## Start-of-session checklist

1. Read this file.
2. Read `CURRENT_STATUS.md`.
3. Read `docs/web-synth-foundation-audit/IMPLEMENTATION_GATES.md`.
4. Run or inspect `git status`.
5. Confirm the current branch.
6. Confirm the latest remote commit.
7. Preserve unrelated work.
8. Stop if local and remote histories conflict.
9. Do not begin Gate 3 without explicit authorization.
