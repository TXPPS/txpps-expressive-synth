import { execSync } from "node:child_process";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

function git(cmd: string): string {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "UNKNOWN";
  }
}

const buildCommit = process.env.TX80_BUILD_COMMIT || git("git rev-parse --short HEAD");
const buildBranch = process.env.TX80_BUILD_BRANCH || git("git rev-parse --abbrev-ref HEAD");
const buildTime = process.env.TX80_BUILD_TIME || new Date().toISOString();
const buildVersion = process.env.TX80_BUILD_VERSION || "0.2.0";

// Shared TanStack Start + Vite config package (build toolchain only — not
// user-facing branding). Do NOT re-add the included plugins manually.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    server: {
      host: "0.0.0.0",
    },
    define: {
      __TX80_BUILD_VERSION__: JSON.stringify(buildVersion),
      __TX80_BUILD_COMMIT__: JSON.stringify(buildCommit),
      __TX80_BUILD_BRANCH__: JSON.stringify(buildBranch),
      __TX80_BUILD_TIME__: JSON.stringify(buildTime),
    },
  },
});
