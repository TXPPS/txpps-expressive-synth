// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { execSync } from "node:child_process";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Application build identifier, baked into the client bundle here and into
// sw.js by scripts/inject-sw-precache.mjs (same derivation — git short SHA),
// so the app can detect a controlling service worker from a different build.
let buildId = "unknown";
try {
  buildId = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
} catch {
  /* git unavailable (CI tarball) — version handshake simply stays inert */
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: {
      __TX27_BUILD_ID__: JSON.stringify(buildId),
    },
    server: {
      host: "0.0.0.0", // bind IPv4 — Replit environment does not support IPv6 (EAFNOSUPPORT)
      port: 3000,      // use a recognised proxy port (8082 is not routable in this environment)
    },
  },
});
