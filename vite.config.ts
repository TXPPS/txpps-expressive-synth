// Shared TanStack Start + Vite config package (build toolchain only — not
// user-facing branding). Do NOT re-add the included plugins manually or the
// app will break with duplicates:
//   - TanStack Start, viteReact, tailwindcss, tsConfigPaths,
//     nitro (cloudflare target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, and sandbox host/port defaults.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
  vite: {
    server: {
      host: "0.0.0.0",
    },
  },
});
