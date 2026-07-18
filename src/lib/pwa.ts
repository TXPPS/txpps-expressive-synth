import { recordStartupPhase } from "./startup-diagnostics";

// Production-only service worker registration. Never runs in development, so
// Vite HMR and the Replit preview are untouched. Updates install in the
// background and activate on the next launch (the worker does not call
// skipWaiting), so a live performance is never interrupted.
export function registerTx27ServiceWorker() {
  if (typeof window === "undefined") return;
  if (!import.meta.env.PROD) return;
  if (!("serviceWorker" in navigator)) return;
  const register = () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
      console.error("TX27 service worker registration failed:", err);
    });
    verifyBuildConsistency();
  };
  // The "load" event has usually already fired by the time the React effect
  // calling this runs, so register immediately in that case.
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

const RELOAD_GUARD_KEY = "tx27-build-mismatch-reload";

/** Startup build-consistency handshake with the CONTROLLING service worker.
 *
 *  Both the app bundle (vite define) and sw.js (inject script) carry the same
 *  git build id. If the worker controlling this page answers with a DIFFERENT
 *  id, this session is a stale mixed-version client (typically an installed
 *  PWA that stayed open across a deployment). Recovery: at most ONE controlled
 *  reload, guarded by sessionStorage so a persistent mismatch can never loop,
 *  recorded in the startup diagnostics. Runs only at startup — before audio
 *  can exist — so it can never interrupt playing notes. If either side has no
 *  id ("unknown") or the worker predates the handshake, nothing happens. */
function verifyBuildConsistency() {
  try {
    const ctrl = navigator.serviceWorker.controller;
    if (!ctrl) return; // first visit/install — page not SW-controlled yet
    let appBuild = "unknown";
    try {
      appBuild = __TX27_BUILD_ID__;
    } catch {
      /* define unavailable */
    }
    if (appBuild === "unknown") return;
    const timer = window.setTimeout(() => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
    }, 3000); // old worker without the handshake — stay inert
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; buildId?: string } | null;
      if (!data || data.type !== "TX27_VERSION") return;
      window.clearTimeout(timer);
      navigator.serviceWorker.removeEventListener("message", onMessage);
      if (!data.buildId || data.buildId === "unknown" || data.buildId === appBuild) {
        try {
          sessionStorage.removeItem(RELOAD_GUARD_KEY);
        } catch {
          /* noop */
        }
        return;
      }
      recordStartupPhase(`build-mismatch:app=${appBuild} sw=${data.buildId}`);
      try {
        if (sessionStorage.getItem(RELOAD_GUARD_KEY)) {
          // Already reloaded once this session — record and continue; the
          // app still works, it just spans two builds until next launch.
          recordStartupPhase("build-mismatch:persists");
          return;
        }
        sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
      } catch {
        // sessionStorage unavailable — never reload without the loop guard.
        return;
      }
      recordStartupPhase("build-mismatch:reload");
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    ctrl.postMessage({ type: "TX27_GET_VERSION" });
  } catch {
    /* handshake is best-effort — never let it break startup */
  }
}
