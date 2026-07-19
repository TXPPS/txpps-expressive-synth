import { test, expect, type CDPSession, type Page } from "@playwright/test";

/**
 * Gate 2 — runtime switchover and voice-ownership regression suite.
 *
 * Observability: the shipped read-only window.__TX80_DIAG / __TX80_PEAK
 * hooks (runtime phase, active voice count, pending notes, context/engine
 * counters, analyser peak) plus an injected oscillator start/stop counter.
 * DOM key-state classes are never the only signal.
 *
 * Multi-pointer scenarios use trusted CDP touch events next to the mouse
 * pointer, so two presses of the same key are two genuine pointers.
 */

interface Diag {
  phase: string;
  contextState: string;
  running: boolean;
  activeVoices: number;
  pendingNotes: number;
  uiHeldPresses: number;
  contextsCreated: number;
  enginesCreated: number;
  engineId: string | null;
}

const diag = (page: Page): Promise<Diag> =>
  page.evaluate(() => (window as unknown as { __TX80_DIAG: () => Diag }).__TX80_DIAG());

const peak = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __TX80_PEAK: () => number }).__TX80_PEAK());

const oscCounts = (page: Page): Promise<{ started: number; stopped: number }> =>
  page.evaluate(
    () => (window as unknown as { __oscCounts: { started: number; stopped: number } }).__oscCounts,
  );

async function keyCenter(page: Page, midi: number): Promise<{ x: number; y: number }> {
  const key = page.locator(`[data-midi="${midi}"]`).first();
  await key.scrollIntoViewIfNeeded();
  const box = await key.boundingBox();
  expect(box, `key ${midi} visible`).not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height * 0.85 };
}

async function mouseHold(page: Page, midi: number): Promise<void> {
  const { x, y } = await keyCenter(page, midi);
  await page.mouse.move(x, y);
  await page.mouse.down();
}

async function mousePress(page: Page, midi: number, ms: number): Promise<void> {
  await mouseHold(page, midi);
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

/** Activate audio with a held first note, wait for running, release. */
async function warmUp(page: Page): Promise<void> {
  await mouseHold(page, 60);
  await expect.poll(async () => (await diag(page)).running, { timeout: 15_000 }).toBe(true);
  await expect.poll(async () => (await diag(page)).activeVoices).toBeGreaterThan(0);
  await page.mouse.up();
  await expect.poll(async () => (await diag(page)).activeVoices, { timeout: 8000 }).toBe(0);
}

const expectSilence = async (page: Page, timeout = 8000) => {
  await expect.poll(async () => (await diag(page)).activeVoices, { timeout }).toBe(0);
  await expect.poll(() => peak(page), { timeout }).toBeLessThan(0.05);
};

/** started−stopped oscillator delta once the reaper has settled (two equal
 *  consecutive samples 600 ms apart). The floor equals the persistent
 *  modulation LFOs, which legitimately never stop while running. */
async function settledOscDiff(page: Page): Promise<number> {
  let prev = -1;
  await expect
    .poll(
      async () => {
        const c = await oscCounts(page);
        const diff = c.started - c.stopped;
        const stable = diff === prev;
        prev = diff;
        return stable;
      },
      { timeout: 15_000, intervals: [600] },
    )
    .toBe(true);
  return prev;
}

let pageErrors: string[] = [];
let consoleErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  pageErrors = [];
  consoleErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("console", (m) => {
    const text = m.text();
    // Network-resource noise from dev tooling is not an app error.
    if (m.type() === "error" && !text.includes("Failed to load resource")) {
      consoleErrors.push(text);
    }
  });
  await page.addInitScript(() => {
    (window as unknown as { __oscCounts: { started: number; stopped: number } }).__oscCounts = {
      started: 0,
      stopped: 0,
    };
    const counts = (window as unknown as { __oscCounts: { started: number; stopped: number } })
      .__oscCounts;
    const orig = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (...args: []) {
      const osc = orig.apply(this, args);
      const start = osc.start.bind(osc);
      const stop = osc.stop.bind(osc);
      osc.start = (...a: [number?]) => {
        counts.started++;
        return start(...a);
      };
      osc.stop = (...a: [number?]) => {
        counts.stopped++;
        return stop(...a);
      };
      return osc;
    };
  });
  await page.goto("/");
  await expect(page.locator('[data-midi="60"]').first()).toBeVisible();
  // SSR paints the keyboard before React hydrates; wait until the client
  // runtime hook is live so presses and diagnostics hit the real app.
  await page.waitForFunction(
    () => typeof (window as unknown as { __TX80_DIAG?: unknown }).__TX80_DIAG === "function",
    undefined,
    { timeout: 15_000 },
  );
});

test.afterEach(async () => {
  expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
});

// ── 1 · Cold first press produces a voice ──────────────────────────────────
test("cold first press creates a sounding voice (first-note preservation)", async ({ page }) => {
  await mouseHold(page, 60);
  await expect.poll(async () => (await diag(page)).running, { timeout: 15_000 }).toBe(true);
  await expect.poll(async () => (await diag(page)).activeVoices, { timeout: 5000 }).toBe(1);
  await expect.poll(() => peak(page), { timeout: 5000 }).toBeGreaterThan(0.01);
  const d = await diag(page);
  expect(d.engineId).toBe("tx80.dual2");
  await page.mouse.up();
  await expectSilence(page);
});

// ── 2 · Cold fast tap: no ghost, no stuck note ─────────────────────────────
test("cold fast tap during startup neither sticks nor ghosts", async ({ page }) => {
  await mousePress(page, 60, 25); // released long before the context runs
  await expect.poll(async () => (await diag(page)).running, { timeout: 15_000 }).toBe(true);
  await page.waitForTimeout(1200);
  const d = await diag(page);
  expect(d.activeVoices).toBe(0);
  expect(d.pendingNotes).toBe(0);
  expect(await peak(page)).toBeLessThan(0.02);
});

// ── 3 · Basic noteOn/noteOff ───────────────────────────────────────────────
test("basic noteOn/noteOff with real analyser signal", async ({ page }) => {
  await warmUp(page);
  await mouseHold(page, 64);
  await expect.poll(async () => (await diag(page)).activeVoices).toBe(1);
  await expect.poll(() => peak(page), { timeout: 5000 }).toBeGreaterThan(0.01);
  await page.mouse.up();
  await expectSilence(page);
});

// ── 4 · Rapid alternating-key spam ─────────────────────────────────────────
test("rapid alternating-key spam leaves zero stuck voices", async ({ page }) => {
  await warmUp(page);
  // Post-warm-up settled baseline: persistent modulation LFOs keep running;
  // only VOICE oscillators must all be stopped again after spam.
  const baseDiff = await settledOscDiff(page);
  for (let i = 0; i < 6; i++) {
    await mousePress(page, 62, 15);
    await mousePress(page, 65, 15);
  }
  await expectSilence(page);
  // The reaper must also stop every voice oscillator it started.
  await expect
    .poll(
      async () => {
        const c = await oscCounts(page);
        return c.started - c.stopped;
      },
      { timeout: 10_000 },
    )
    .toBe(baseDiff);
});

// ── 5 · Rapid same-key spam (the original blocker) ─────────────────────────
test("rapid same-key spam leaves zero stuck voices", async ({ page }) => {
  await warmUp(page);
  const baseDiff = await settledOscDiff(page);
  for (let i = 0; i < 10; i++) await mousePress(page, 64, 15);
  await expectSilence(page);
  await expect
    .poll(
      async () => {
        const c = await oscCounts(page);
        return c.started - c.stopped;
      },
      { timeout: 10_000 },
    )
    .toBe(baseDiff);
});

// ── 6+7 · Two simultaneous presses of one note; release ordering ───────────
test("two pointers on one note stack and release one-for-one", async ({ page }) => {
  await warmUp(page);
  const { x, y } = await keyCenter(page, 60);
  await page.mouse.move(x, y);
  await page.mouse.down(); // press #1 (mouse pointer)
  await expect.poll(async () => (await diag(page)).activeVoices).toBe(1);

  const cdp: CDPSession = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: x - 4, y, id: 11 }],
  }); // press #2 (touch pointer, same key)
  await expect.poll(async () => (await diag(page)).activeVoices).toBe(2);

  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(async () => (await diag(page)).activeVoices).toBe(1);

  await page.mouse.up();
  await expectSilence(page);
});

// ── 8 · Pointer slide across notes ─────────────────────────────────────────
test("sliding across keys keeps exactly one owned note and ends clean", async ({ page }) => {
  await warmUp(page);
  const a = await keyCenter(page, 60);
  const b = await keyCenter(page, 67);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(a.x + ((b.x - a.x) * i) / 10, a.y, { steps: 2 });
    const d = await diag(page);
    expect(d.uiHeldPresses, "one owned press while sliding").toBeLessThanOrEqual(1);
  }
  await page.mouse.up();
  await expectSilence(page);
});

// ── 9 · pointercancel releases ownership ───────────────────────────────────
test("pointercancel releases the owned note", async ({ page }) => {
  await warmUp(page);
  const { x, y } = await keyCenter(page, 62);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, id: 21 }],
  });
  await expect.poll(async () => (await diag(page)).activeVoices).toBe(1);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await expectSilence(page);
});

// ── 10 · lostpointercapture releases ownership ─────────────────────────────
test("lostpointercapture releases the owned note", async ({ page }) => {
  await warmUp(page);
  await mouseHold(page, 65);
  await expect.poll(async () => (await diag(page)).activeVoices).toBe(1);
  // Deliver lostpointercapture for the owning pointer to the keyboard
  // container (the browser fires this when capture is revoked by a system
  // gesture/overlay). The handler must release the owned note.
  await page.evaluate(() => {
    const el = document.querySelector('[data-midi="65"]')?.closest(".touch-none") as HTMLElement;
    el.dispatchEvent(new PointerEvent("lostpointercapture", { pointerId: 1, bubbles: true }));
  });
  await expectSilence(page);
  await page.mouse.up(); // stale release for an already-released press
  await page.waitForTimeout(300);
  expect((await diag(page)).activeVoices).toBe(0);
});

// ── 11 · Window blur releases held notes ───────────────────────────────────
test("window blur releases held notes", async ({ page }) => {
  await warmUp(page);
  await mouseHold(page, 60);
  await expect.poll(async () => (await diag(page)).activeVoices).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expectSilence(page);
  await page.mouse.up();
  await page.waitForTimeout(200);
  expect((await diag(page)).activeVoices).toBe(0);
});

// ── 12 · Visibility change releases held notes ─────────────────────────────
test("hidden visibility releases held notes", async ({ page }) => {
  await warmUp(page);
  await mouseHold(page, 64);
  await expect.poll(async () => (await diag(page)).activeVoices).toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expectSilence(page);
  await page.mouse.up();
});

// ── 13+14 · Voice stealing; releasing a stolen press is generation-safe ────
test("polyphony cap steals oldest; releasing the stolen press harms nothing", async ({ page }) => {
  await warmUp(page);
  // Oldest press = mouse on C4. Then 8 sustained touch presses exceed the
  // default 8-voice polyphony, stealing the mouse voice.
  await mouseHold(page, 60);
  const cdp = await page.context().newCDPSession(page);
  const whiteMidis = [62, 64, 65, 67, 69, 71, 72, 74];
  const points = [];
  for (const [i, midi] of whiteMidis.entries()) {
    const { x, y } = await keyCenter(page, midi);
    points.push({ x, y, id: 30 + i });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: points });
  }
  await expect
    .poll(async () => (await diag(page)).activeVoices, { timeout: 5000 })
    .toBeLessThanOrEqual(8);
  const before = (await diag(page)).activeVoices;
  expect(before).toBeGreaterThanOrEqual(7);
  // Release the STOLEN press (the mouse). Its voice is already inactive, so
  // the release must be a no-op — no replacement voice may die.
  await page.mouse.up();
  await page.waitForTimeout(300);
  const after = (await diag(page)).activeVoices;
  expect(after, "stolen-press release must not kill a replacement voice").toBe(before);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expectSilence(page, 12_000);
});

// ── 15 · Sustain with repeated notes ───────────────────────────────────────
test("sustain holds repeated releases; pedal-up silences", async ({ page }) => {
  await warmUp(page);
  const sus = page.getByRole("button", { name: /sustain/i });
  await sus.click();
  await expect(sus).toHaveAttribute("aria-pressed", "true");
  await mousePress(page, 60, 60);
  await mousePress(page, 60, 60);
  await mousePress(page, 64, 60);
  const held = (await diag(page)).activeVoices;
  expect(held, "sustained voices keep sounding after key release").toBeGreaterThanOrEqual(3);
  await sus.click();
  await expectSilence(page, 12_000);
});

// ── 16 · Panic clears voices, counters, handles, pending ───────────────────
test("panic clears all voices, ownership and pending state", async ({ page }) => {
  await warmUp(page);
  // Hold BOTH notes via touch so the mouse stays free to press PANIC (a
  // captured, held mouse cannot click other UI — that is correct behavior).
  const cdp = await page.context().newCDPSession(page);
  const p60 = await keyCenter(page, 60);
  const p67 = await keyCenter(page, 67);
  const touches = [
    { x: p60.x, y: p60.y, id: 41 },
    { x: p67.x, y: p67.y, id: 42 },
  ];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: touches });
  await expect.poll(async () => (await diag(page)).activeVoices).toBe(2);
  await page.getByRole("button", { name: /panic/i }).click();
  await expect.poll(async () => (await diag(page)).activeVoices, { timeout: 3000 }).toBe(0);
  const d = await diag(page);
  expect(d.pendingNotes).toBe(0);
  expect(d.uiHeldPresses).toBe(0);
  await expect.poll(() => peak(page), { timeout: 6000 }).toBeLessThan(0.05);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  // The instrument must remain playable after panic.
  await mouseHold(page, 62);
  await expect.poll(async () => (await diag(page)).activeVoices, { timeout: 5000 }).toBe(1);
  await page.mouse.up();
  await expectSilence(page);
});

// ── 17 · Dual layers share one coordinated note lifecycle ──────────────────
test("both layers ride one coordinated voice per press", async ({ page }) => {
  await warmUp(page);
  const baseline = await oscCounts(page);
  await mouseHold(page, 60);
  await expect.poll(async () => (await diag(page)).activeVoices).toBe(1);
  const during = await oscCounts(page);
  // Default patch: Layer I and Layer II both enabled → one voice carries
  // main+sub oscillators for BOTH layers (4 oscillators), one lifecycle.
  expect(during.started - baseline.started).toBe(4);
  await page.mouse.up();
  await expectSilence(page);
});

// ── 18 · Stale releases cannot touch a fresh held voice ────────────────────
test("spam tails never affect a subsequently held voice", async ({ page }) => {
  await warmUp(page);
  for (let i = 0; i < 6; i++) await mousePress(page, 64, 15);
  await mouseHold(page, 64); // fresh press of the SAME note while tails decay
  await page.waitForTimeout(1500); // all earlier releases/tails elapse
  const d = await diag(page);
  expect(d.activeVoices, "held voice survives stale releases").toBe(1);
  expect(await peak(page)).toBeGreaterThan(0.01);
  await page.mouse.up();
  await expectSilence(page);
});

// ── 19 · Range change while holding releases safely ────────────────────────
test("octave change while holding leaves no stuck note", async ({ page }) => {
  await warmUp(page);
  const cdp = await page.context().newCDPSession(page);
  const { x, y } = await keyCenter(page, 62);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, id: 51 }],
  });
  await expect.poll(async () => (await diag(page)).activeVoices).toBe(1);
  await page.getByRole("button", { name: "Octave up" }).click();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expectSilence(page);
});

// ── 20 · Duplicate pointerdown for an active pointer does not duplicate ────
test("duplicate press events for one pointer never duplicate ownership", async ({ page }) => {
  await warmUp(page);
  await mouseHold(page, 60);
  await expect.poll(async () => (await diag(page)).activeVoices).toBe(1);
  // Auto-repeat analogue: a second pointerdown for the SAME pointer id and
  // key (the UI has no computer-keyboard input; the keyboard's per-pointer
  // map must ignore a repeat of an already-owned note).
  await page.evaluate(() => {
    const el = document.querySelector('[data-midi="60"]') as HTMLElement;
    el.dispatchEvent(
      new PointerEvent("pointerdown", { pointerId: 1, bubbles: true, isPrimary: true }),
    );
  });
  await page.waitForTimeout(200);
  const d = await diag(page);
  expect(d.activeVoices).toBe(1);
  expect(d.uiHeldPresses).toBe(1);
  await page.mouse.up();
  await expectSilence(page);
});

// ── Quarantine + singleton proof ───────────────────────────────────────────
test("only synth-core is in the live audio module graph; one context, one engine", async ({
  page,
}) => {
  await warmUp(page);
  const modules = await page.evaluate(() =>
    performance.getEntriesByType("resource").map((r) => r.name),
  );
  expect(
    modules.some((m) => m.includes("/src/synth-core/")),
    "synth-core modules loaded",
  ).toBe(true);
  expect(
    modules.filter((m) => m.includes("/src/audio/")),
    "no quarantined src/audio module may load",
  ).toEqual([]);
  const d = await diag(page);
  expect(d.contextsCreated, "exactly one AudioContext").toBe(1);
  expect(d.enginesCreated, "exactly one engine").toBe(1);
});

// ── UI unchanged: no horizontal overflow regression ────────────────────────
test("no horizontal page overflow", async ({ page }) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
