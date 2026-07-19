# TX-80 Git History Map

Verified 2026-07-19 against the live remotes (`git fetch --all --tags
--prune`; `git ls-remote`).

## Repository 1: `txpps/txpps-expressive-synth` (THIS repo — Implementation A)

Remote URL verified: https://github.com/txpps/txpps-expressive-synth
Default branch: `main`. Branches: `main` only (plus this audit's
`audit/tx80-dual-implementation-reconciliation`). Tags: none.

```
* ad15b8e5e1bd18b595c82424ebe618245a309430  2026-07-18  TXPPS
|     feat(tx-80): integrate initial browser audio engine and playable synthesis
|     → adds src/audio/* (8 files), src/hooks/useAudioEngine.ts,
|       package-lock.json (OUT OF SYNC with package.json), wires index.tsx
*   2760b2f6b0416f20a00a5c7239dfd2086655500d  2026-07-18  gpt-engineer-app[bot]
|\      Reached Milestone 1 complete   (merge of the shell line below)
| * ae7ae2fe9795f1281c33b0a4722672144a5c258c  Changes (routeTree revert)
| * 3bf6d8d805ea9086028032291595a6d0ad204ce0  Changes (routeTree)
| * 7389fa9777681ed3e124a061409195e6814e1524  Changes
|       → the Milestone-1 TX-80 shell: src/state/{params,store}.ts,
|         src/components/synth/* (10 components), root docs
|         (ARCHITECTURE / CURRENT_STATUS / PARAMETER_MATRIX / MANUAL_QA),
|         styles. Zustand + registry born here.
| * 3b744996fbff684720902ccc77336baf14b8092f  Changes (deps: zustand, idb)
|/
* b195b8926de276f988dbf16480d452936314388e  2026-07-16  Lovable
      template: tanstack_start_ts_current-219b062142fe
```

History searches performed here: no commit at any point contains
`src/lib/tx80/`, `src/components/tx80/`, `tests/e2e/tx80-engine.e2e.ts`, or
`scripts/generate-parameter-matrix.mjs`. The Claude implementation was never
pushed to, merged into, or rewritten out of this repository.

## Repository 2: `txpps/txpps-tx-80` (Implementation B)

Verified via `git ls-remote` this session:

```
96c97e2869a189e372396c8532787e0e20923974  refs/heads/claude/tx80-synth-completion-nkt36a  (= remote HEAD)

* 96c97e2  Add TXPPS TX-80 dual-layer performance synthesizer on the TX27 foundation
* 9bf1c83  Import TXPPS TX27 foundation baseline (Gate 2 state)   (root)
```

## Cross-repository relationship

- Root commits differ (`b195b89` vs `9bf1c83`); **no common ancestor, no
  merge base**. `git merge` between them would be an unrelated-histories
  merge with path and root-doc filename collisions — not safe, not useful.
- Reuse direction must therefore be **file-level transplant** with its own
  commit(s) in this repo, recording the source repo/branch/SHA in the
  commit message (see Roadmap Gate 1).

## Preservation obligations (Gate 0)

- Tag `main` before any engine work: suggested `archive/m2-copilot-audio`
  at `ad15b8e`.
- Import a read-only snapshot of Implementation B into this repo as
  `reference/claude-tx80-96c97e2` (orphan branch holding the tree of
  `96c97e2`, no merge into main) so both implementations are inspectable
  from one place even if the other repository goes away.
- AGENTS.md (Lovable): do not force-push or rewrite `main` history.
