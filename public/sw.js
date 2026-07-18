/*
 * TXPPS TX27 service worker.
 *
 * The two placeholders below are rewritten by scripts/inject-sw-precache.mjs
 * after `vite build`, so the production copy in .output/public/sw.js carries
 * the real cache version (content hash of the asset list) and the full
 * precache inventory. The source copy in public/ keeps the placeholders and
 * is never registered in development.
 */
const CACHE_VERSION = "__TX27_CACHE_VERSION__";
const PRECACHE_URLS = ["__TX27_PRECACHE_MANIFEST__"];
// Application build identifier (git short SHA — same value vite bakes into
// the client bundle). Lets a running page ask which build controls it.
const BUILD_ID = "__TX27_BUILD_ID__";

const CACHE_NAME = `tx27-${CACHE_VERSION}`;
const NAV_FALLBACK = "/";

// Version handshake: the app posts TX27_GET_VERSION at startup and compares
// the reply with its own baked-in build id (see src/lib/pwa.ts — at most one
// controlled reload on mismatch, never a loop).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "TX27_GET_VERSION") {
    const reply = { type: "TX27_VERSION", buildId: BUILD_ID, cacheVersion: CACHE_VERSION };
    if (event.source) event.source.postMessage(reply);
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Precache the app shell (root SSR HTML) plus every built asset.
      await cache.add(new Request(NAV_FALLBACK, { cache: "reload" }));
      await cache.addAll(PRECACHE_URLS);
      // No skipWaiting(): the new worker activates on the next launch, so an
      // update never forces a reload or interrupts live audio.
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop obsolete versioned caches (never touches localStorage).
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith("tx27-") && n !== CACHE_NAME)
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Only handle same-origin requests; never dev/HMR or external resources.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/@") || url.pathname.includes("__vite")) return;

  if (req.mode === "navigate") {
    // Network-first for navigations so a fresh SSR page (and new asset
    // hashes) wins when online; cached shell keeps the app booting offline.
    event.respondWith(
      (async () => {
        try {
          // Network-first when online. The cached shell is deliberately NOT
          // overwritten here: fresh HTML may reference newer hashed assets
          // than this worker's precache, and mixing them would break offline
          // boot. The shell + assets stay atomic per cache version; a new
          // deploy ships a new sw.js whose install re-caches both together.
          return await fetch(req);
        } catch {
          const cached =
            (await caches.match(req)) || (await caches.match(NAV_FALLBACK));
          if (cached) return cached;
          return new Response("TX27 is offline and not yet cached.", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          });
        }
      })(),
    );
    return;
  }

  // Static assets: cache-first (hashed filenames make this safe), with a
  // network fill for anything not precached.
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      const resp = await fetch(req);
      if (resp.ok && (resp.type === "basic" || resp.type === "default")) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, resp.clone());
      }
      return resp;
    })(),
  );
});
