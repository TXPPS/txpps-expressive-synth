/**
 * Build-time identity for diagnostics. Injected via Vite `define`.
 * Never includes credentials. Missing fields display as UNKNOWN.
 */

export interface Tx80BuildInfo {
  product: string;
  version: string;
  commit: string;
  branch: string;
  builtAt: string;
  env: "development" | "production";
}

declare const __TX80_BUILD_VERSION__: string;
declare const __TX80_BUILD_COMMIT__: string;
declare const __TX80_BUILD_BRANCH__: string;
declare const __TX80_BUILD_TIME__: string;

function readDefine(value: unknown, fallback = "UNKNOWN"): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null") return fallback;
  return trimmed;
}

export function getBuildInfo(): Tx80BuildInfo {
  let version = "0.2.0";
  let commit = "UNKNOWN";
  let branch = "UNKNOWN";
  let builtAt = "UNKNOWN";
  try {
    version = readDefine(__TX80_BUILD_VERSION__, "0.2.0");
    commit = readDefine(__TX80_BUILD_COMMIT__);
    branch = readDefine(__TX80_BUILD_BRANCH__);
    builtAt = readDefine(__TX80_BUILD_TIME__);
  } catch {
    /* defines missing in some tooling */
  }
  return {
    product: "TXPPS TX-80",
    version,
    commit,
    branch,
    builtAt,
    env: import.meta.env.PROD ? "production" : "development",
  };
}

export function formatBuildSummary(info: Tx80BuildInfo = getBuildInfo()): string {
  return [
    `product=${info.product}`,
    `version=${info.version}`,
    `commit=${info.commit}`,
    `branch=${info.branch}`,
    `builtAt=${info.builtAt}`,
    `env=${info.env}`,
  ].join("\n");
}
