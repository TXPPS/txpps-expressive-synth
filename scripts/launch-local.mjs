// One-command production-like local launch.
//
//   bun run start:local
//
// 1. Builds the real production output (vite build + sw precache inject).
// 2. Starts the Cloudflare worker locally via `wrangler dev` (same artifact
//    that deploys — service worker, precache and SSR shell all real).
// 3. Waits until the server answers, then opens the default browser ONCE.
// 4. Ctrl-C stops the worker and exits cleanly.
//
// This does NOT replace the Cloudflare build/deploy architecture — it only
// wraps the existing `build` + `wrangler dev` steps for convenience.
import { spawn } from "node:child_process";
import { platform } from "node:os";

const PORT = Number(process.env.PORT ?? 8788);
const HOST = "127.0.0.1";
const URL = `http://${HOST}:${PORT}/`;
const isWin = platform() === "win32";
const npx = isWin ? "npx.cmd" : "npx";

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", shell: isWin, ...opts });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`)),
    );
    child.on("error", reject);
  });
}

async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status > 0) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function openBrowser(url) {
  if (isWin) spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true });
  else if (platform() === "darwin") spawn("open", [url], { stdio: "ignore", detached: true });
  else spawn("xdg-open", [url], { stdio: "ignore", detached: true });
}

async function main() {
  console.log("[launch] building production output…");
  await run("bun", ["run", "build"]);

  console.log(`[launch] starting wrangler dev on ${URL}`);
  const server = spawn(
    npx,
    ["wrangler", "dev", "-c", ".output/server/wrangler.json", "--port", String(PORT), "--ip", HOST],
    { stdio: "inherit", shell: isWin },
  );

  const stop = () => {
    if (!server.killed) server.kill();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  server.on("exit", (code) => process.exit(code ?? 0));

  const healthy = await waitForServer(URL);
  if (!healthy) {
    console.error("[launch] server did not become healthy in time.");
    stop();
    return;
  }
  console.log("[launch] server is up — opening browser once.");
  openBrowser(URL);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
