// Post-build step: inventory .output/public and inject the precache manifest
// and a content-hash cache version into the built sw.js. Run automatically by
// `bun run build` (see package.json).
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

// Same derivation as vite.config.ts `define` — the app bundle and sw.js must
// carry the SAME build id for the startup version handshake.
let buildId = "unknown";
try {
  buildId = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
} catch {
  /* git unavailable — handshake stays inert */
}

const root = join(process.cwd(), ".output", "public");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

// sw.js never precaches itself. _headers/_redirects are Cloudflare control
// files: they configure the CDN but are NOT served on the deployed origin
// (they 404), and one failed request would abort cache.addAll() and leave
// the PWA without offline support.
const SKIP = new Set(["sw.js", "_headers", "_redirects"]);
const urls = walk(root)
  .map((p) => relative(root, p).split(sep).join("/"))
  .filter((p) => !SKIP.has(p))
  .map((p) => "/" + p)
  .sort();

const version = createHash("sha256")
  .update(urls.map((u) => u + ":" + statSync(join(root, u.slice(1))).size).join("\n"))
  .digest("hex")
  .slice(0, 12);

const swPath = join(root, "sw.js");
let sw = readFileSync(swPath, "utf8");
sw = sw
  .replace('"__TX27_CACHE_VERSION__"', JSON.stringify(version))
  .replace('"__TX27_BUILD_ID__"', JSON.stringify(buildId))
  .replace('["__TX27_PRECACHE_MANIFEST__"]', JSON.stringify(urls));
writeFileSync(swPath, sw);

// Nitro bakes each public asset's size and etag into the server bundle at
// build time; since we just rewrote sw.js, patch its manifest entry too or
// the node server will truncate the response to the old content-length.
const swBuf = readFileSync(swPath);
// Same format nitro/etag uses: "<size hex>-<sha1 base64, 27 chars>", stored
// in the bundle as a JSON string with escaped quotes: "\"...\""
const etagBody = `${swBuf.length.toString(16)}-${createHash("sha1")
  .update(swBuf)
  .digest("base64")
  .substring(0, 27)}`;
const serverBundle = join(process.cwd(), ".output", "server", "index.mjs");
let server = readFileSync(serverBundle, "utf8");
const etagRe = /("\/sw\.js":\s*\{[\s\S]*?"etag":\s*")(?:\\.|[^"\\])*(")/;
const sizeRe = /("\/sw\.js":\s*\{[\s\S]*?"size":\s*)\d+/;
if (!etagRe.test(server) || !sizeRe.test(server)) {
  throw new Error("[tx27-sw] could not find /sw.js asset entry in server bundle");
}
server = server
  .replace(etagRe, `$1\\"${etagBody}\\"$2`)
  .replace(sizeRe, `$1${swBuf.length}`);
writeFileSync(serverBundle, server);
console.log(
  `[tx27-sw] precached ${urls.length} assets, cache version ${version}, sw.js size ${swBuf.length}`,
);
