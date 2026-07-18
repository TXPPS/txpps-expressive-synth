/**
 * Browser-safe AudioContext wrapper.
 * 
 * Handles:
 * - Singleton AudioContext creation (lazy)
 * - Cross-browser compat (webkit prefix, etc)
 * - Autoplay policy (resume on user gesture)
 * - Suspended state recovery
 */

let audioContext: AudioContext | null = null;
let suspendHandlers: Set<() => void> = new Set();

export function getAudioContext(): AudioContext {
  if (!audioContext) {
    const AC = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AC) throw new Error("AudioContext not supported");
    audioContext = new AC();
    setupContextListeners();
  }
  return audioContext;
}

export function isAudioContextRunning(): boolean {
  if (!audioContext) return false;
  return audioContext.state === "running";
}

function setupContextListeners() {
  if (!audioContext) return;
  
  audioContext.addEventListener("statechange", () => {
    if (audioContext?.state === "suspended") {
      notifySuspended();
    }
  });
}

export async function resumeAudioContext(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
}

function notifySuspended() {
  for (const handler of suspendHandlers) {
    handler();
  }
}

export function onSuspended(handler: () => void): () => void {
  suspendHandlers.add(handler);
  return () => {
    suspendHandlers.delete(handler);
  };
}

export function getCurrentTime(): number {
  return getAudioContext().currentTime;
}
