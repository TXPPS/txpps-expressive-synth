# PWA / Offline Audit

**Files:** `public/manifest.webmanifest`, `public/sw.js`, `src/lib/pwa.ts`, `scripts/inject-sw-precache.mjs`, `src/routes/__root.tsx`, `CLOUDFLARE_DEPLOYMENT.md`

---

## Verdict

Offline/PWA design is **production-quality for a single-origin instrument** after a documented online warm-up. No CDN runtime dependencies. Fonts self-hosted. Versioned caches + build-ID handshake reduce mixed-asset disasters. Airplane-mode relaunch after warm-up is **architecturally verified**; physical retest **not run** in this audit session.

---

## Manifest — Verified

| Field             | Value                  |
| ----------------- | ---------------------- |
| name              | TXPPS TX27             |
| short_name        | TX27                   |
| display           | standalone             |
| orientation       | any                    |
| start_url / scope | `/`                    |
| theme/background  | `#1a1815`              |
| icons             | 192, 512, 512 maskable |

---

## Service worker strategy — Verified

| Concern       | Behavior                                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------------------------- |
| Registration  | Production only (`pwa.ts`), after `load`                                                                        |
| Install       | Precache `/` + injected asset inventory; **no** `skipWaiting`                                                   |
| Activate      | Delete obsolete `tx27-*` caches; `clients.claim()`                                                              |
| Navigation    | Network-first; offline → cached shell; **does not** overwrite shell from network response (avoids mixed hashes) |
| Static assets | Cache-first (content-hashed filenames)                                                                          |
| Cross-origin  | Ignored                                                                                                         |
| Dev/HMR paths | Ignored                                                                                                         |
| Offline miss  | Plain-text 503: instrument not yet cached                                                                       |

### Versioning

- `CACHE_VERSION` = SHA-256 of sorted `url:size` inventory (12 hex) via `inject-sw-precache.mjs`
- `BUILD_ID` = git short SHA (same as Vite `__TX27_BUILD_ID__`)
- Client posts `TX27_GET_VERSION`; mismatch → **at most one** sessionStorage-guarded reload

This session’s build: cache `6bf5a9ec6650`, build `821640d`, **10** precached assets including `JetBrainsMono.woff2`.

---

## Offline capability matrix

| Scenario                                           | Expected                                                  | Label                      |
| -------------------------------------------------- | --------------------------------------------------------- | -------------------------- |
| First visit online                                 | Works; SW installs                                        | Verified design            |
| Second visit online (SW controlling)               | Works                                                     | Verified design            |
| Airplane after warm-up (documented: load + reload) | Shell + assets from cache; synthesis works                | Present; device unverified |
| First visit ever offline                           | Fails honestly (503 / no shell)                           | Verified design            |
| Update deploy mid-session                          | Old SW keeps serving until next launch                    | Verified (no skipWaiting)  |
| Mixed client/SW build                              | One controlled reload                                     | Verified                   |
| Rollback                                           | Wrangler deployment rollback (ops)                        | Documented                 |
| localStorage vs SW                                 | SW never clears app storage                               | Verified                   |
| Storage quota full                                 | Precache may fail; no dedicated recovery UX               | Partial / Fragile          |
| Corrupted cache                                    | Activate deletes old versions; no repair UI beyond reload | Partial                    |

---

## External / CDN dependencies — Verified none

- No Google Fonts, unpkg, analytics scripts
- Only self-origin assets + Worker SSR
- Lovable reporting hooks are no-ops outside editor

---

## Gaps vs foundation goals

| Goal                         | Gap                                                             |
| ---------------------------- | --------------------------------------------------------------- |
| Clear-cache settings control | **Missing** in Settings UI                                      |
| Update available toast       | **Missing** (by design: next launch)                            |
| IndexedDB asset packs        | N/A today                                                       |
| Product-agnostic SW naming   | Hardcoded `tx27-` prefix — Product Adapter concern              |
| SSR Worker required          | Foundation should allow static-export option for simpler synths |

---

## Extraction recommendation

Promote as Foundation Core with **product placeholders**:

- Cache name prefix from `ProductManifest.id`
- Build ID define name configurable
- Keep network-first nav + atomic shell policy — do not “improve” into stale HTML/asset mixes

Do not invent Workbox abstractions; the current ~100-line SW is clearer and cheaper for agents to reason about.
