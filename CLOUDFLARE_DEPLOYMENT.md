# TXPPS TX27 — Cloudflare Deployment Guide

Stable production URL:

**https://txpps-tx27.toppsmusicproductions.workers.dev**

- Cloudflare Worker name: `txpps-tx27`
- Source repository (private): `TXPPS/TXPPS-TX27-Replit-Refinement`, branch `main`

---

## 1. Architecture

**Cloudflare Workers** running the TanStack Start SSR server, with the client
bundle served through the Worker's **static assets binding**.

The production build (Nitro `cloudflare-module` preset) emits:

```
.output/
├── nitro.json                  build metadata (preset, deploy commands)
├── public/                     static assets  → Worker ASSETS binding
│   ├── _headers                CDN header rules (immutable caching for /assets)
│   ├── assets/                 hashed JS + CSS bundles
│   ├── fonts/JetBrainsMono.woff2
│   ├── icon-192.png · icon-512.png · icon-512-maskable.png
│   ├── apple-touch-icon.png · favicon.ico
│   ├── manifest.webmanifest    PWA manifest
│   └── sw.js                   service worker (precache list injected at build)
└── server/
    ├── index.mjs               the Worker entry (SSR + error handling)
    └── wrangler.json           generated Worker config (assets binding,
                                nodejs_compat, compatibility date)
```

### Why Workers (not Pages / static SPA)

- The repo's build **already produces a valid Cloudflare Worker** — no
  conversion or structural change was needed.
- The service worker precaches `/` as the offline app shell. On this stack
  `/` is the **SSR-rendered page**, so keeping the Worker preserves the
  offline boot path exactly as designed.
- Nothing else is server-side: no database, no analytics, no auth. The Worker
  only renders the shell and serves assets.

---

## 2. Required local tools

| Tool | Purpose |
|---|---|
| Bun (≥ 1.3) | package manager + script runner |
| Node.js (≥ 20) | build scripts, wrangler host runtime |
| Wrangler (via `npx wrangler`, no install needed) | Cloudflare deploys |

One-time Cloudflare authorization on a new machine:

```
npx wrangler login
```

(Browser opens → Allow. Credentials are stored locally by Wrangler; nothing
is kept in this repository.)

---

## 3. Commands

| Step | Command |
|---|---|
| Install dependencies | `bun install` |
| Type check | `bunx tsc --noEmit` |
| Production build (incl. SW precache injection) | `bun run build` |
| Deploy (build + publish) | `bun run deploy` |
| Local production-like preview (workerd) | `npx wrangler dev` |

`bun run deploy` = `bun run build && npx wrangler deploy --name txpps-tx27`.

The `--name txpps-tx27` flag is required: the auto-generated config would
otherwise create a second Worker under a different name. **Always deploy
through `bun run deploy`.**

---

## 4. Update workflow

### Manual (current workflow)

1. Commit and push approved changes to `main` (Lovable syncs from this branch;
   never force-push).
2. `bun run deploy`
3. Verify: root URL 200, new `sw.js` cache version, spot-check the app.

### GitHub → Cloudflare (optional, later)

Workers Builds can watch the GitHub repo and run the build on every push:

1. Cloudflare dashboard → Workers & Pages → `txpps-tx27` → Settings → Builds.
2. Connect the GitHub repository (works with private repos) and branch `main`.
3. Build command: `bun run build` · Deploy command:
   `npx wrangler deploy --name txpps-tx27`.

Until that is configured, deploys are manual and deliberate — which also
keeps "what is live" pinned to an approved commit.

### Rollback

Workers keep prior versions:

```
npx wrangler deployments list --name txpps-tx27
npx wrangler rollback --name txpps-tx27          # interactive version pick
```

Or check out the last good commit and `bun run deploy`.

---

## 5. PWA / cache update behavior

- `scripts/inject-sw-precache.mjs` runs after every build: it inventories
  `.output/public`, injects the precache list into `sw.js`, and stamps a
  content-hash **cache version**. Any asset change ⇒ new version.
  (`_headers`/`_redirects` are excluded — Cloudflare serves them as CDN
  config, not as files, and a 404 during precache would break offline setup.)
- The service worker registers **in production only**, scope `/`.
- Updates install in the background and activate **on the next launch** — an
  update never interrupts someone playing the synth mid-session.
- Old `tx27-*` caches are deleted on activation. `localStorage` (presets,
  favorites, settings) is **never** touched by the service worker.
- Navigations are network-first (fresh page when online), falling back to the
  cached shell offline. Hashed assets are cache-first.

---

## 6. Installing on devices

### iPhone / iPad (Safari)

1. Open the URL in **Safari** (must be Safari — installed PWAs use it).
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Launch from the Home Screen icon: standalone, no browser chrome.
4. iOS tip: Silent-mode switch can mute Web Audio; raise ringer volume.

### Android (Chrome)

1. Open the URL in Chrome.
2. Menu (⋮) → **Add to Home screen** (or the automatic **Install app** prompt).
3. Launch from the icon — standalone app window.

### Windows / macOS desktop (Chrome / Edge)

1. Open the URL.
2. Click the **install icon** in the address bar (or Menu → *Install TX27*).
3. TX27 opens in its own window and appears in the Start menu / Dock.

---

## 7. Offline test procedure

1. Open the app **online** once and wait a few seconds (service worker
   installs and precaches in the background).
2. Reload once while still online (the SW takes control).
3. Go offline (airplane mode, or DevTools → Network → Offline).
4. Reload the app (or relaunch the installed PWA).
5. The complete TX27 interface must appear; presets, Patch Library, and all
   sound features work — the synth needs no network at runtime.

User data (presets, favorites, settings) lives in `localStorage` on the
device and survives offline use, reloads, and app updates.

---

## 8. Troubleshooting

### Audio doesn't start

- Audio requires a **user gesture**: tap POWER or any key once.
- iPhone/iPad: check the silent switch and ringer volume; Safari mutes Web
  Audio in silent mode on some versions.
- Bluetooth audio can add latency or fail to route — test with the built-in
  speaker first.
- If the LCD shows `AUDIO ERR`, close other audio apps and relaunch.

### App seems stale after a deploy

- The new version installs in the background; **close the app/tab fully and
  reopen it** — updates activate on the next launch by design.
- Verify what is live: `curl -s <URL>/sw.js | head -20` and compare
  `CACHE_VERSION` with the local build output.
- Hard fallback on a device: browser settings → site data → remove the site's
  **cache** (do NOT clear "cookies and site data"/localStorage, which would
  delete user presets), then reload twice.

### Deploy fails with a subdomain/route error

The account's `workers.dev` subdomain must exist (one-time setup):
dashboard → Workers & Pages → change/register subdomain
(`toppsmusicproductions.workers.dev` is the current one).

---

*No credentials, tokens, or account secrets are stored in this repository.
Wrangler authenticates via its own local OAuth store (`wrangler login`).*
