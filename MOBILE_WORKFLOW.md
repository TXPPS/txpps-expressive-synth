# TX27 Mobile Workflow

GitHub is the authoritative transfer point between desktop and mobile.

## GitHub-first workflow

### Desktop

1. Finish one coherent task.
2. Run the available validation.
3. Update status documentation.
4. Review and commit intentionally.
5. Push to the private GitHub repository.

### Mobile

1. Open the same repository.
2. Fetch and run `git pull --ff-only`.
3. Read `MOBILE_SESSION_START.md`.
4. Confirm the branch is clean and synchronized.
5. Work only within the explicitly authorized scope.
6. Review, commit, and push completed mobile work.

### Return to desktop

1. Fetch and run `git pull --ff-only`.
2. Review the mobile diff/commits.
3. Run full desktop validation.
4. Correct environment-specific issues.
5. Update authoritative status documentation.

## Conflict prevention

- Never edit the same files simultaneously on desktop and mobile.
- Never force-push.
- Never reset shared work without explicit permission.
- Pull before beginning a session.
- Push before switching devices.
- Use small, focused commits.
- Stop when histories diverge; reconcile on desktop before continuing.

## ZIP fallback

Use a ZIP only when GitHub access is unavailable.

1. Create a source-only ZIP.
2. Label it with repository, branch, commit, date, and purpose.
3. Include `.git` only when preserving history is intentional and secure.
4. Never treat an unidentified ZIP as more authoritative than GitHub.
5. Reconcile ZIP changes through desktop diff/review before merging or pushing.

Exclude repository-specific dependencies, generated output, caches, secrets,
logs, and transient editor/test files:

```text
node_modules/
dist/
dist-ssr/
.output/
.vinxi/
.tanstack/
.nitro/
.wrangler/
test-results/
playwright-report/
blob-report/
.playwright/
logs/
*.log
.dev.vars
.env
.env.*
*.local
.vscode/
.idea/
```

If an `.env.example` exists, it may be included because it must contain
placeholders only, never credentials.
