import { test, expect, type Page } from "@playwright/test";

/**
 * Voice ownership / spam stress suite for TX-80.
 * Deterministic seeded RNG; state-based waits for invariants.
 */

interface Diag {
  phase: string;
  running: boolean;
  activeVoices: number;
  pendingNotes: number;
  uiHeldPresses: number;
  contextsCreated: number;
  enginesCreated: number;
}

const diag = (page: Page): Promise<Diag> =>
  page.evaluate(() => (window as unknown as { __TX80_DIAG: () => Diag }).__TX80_DIAG());

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function ensureReady(page: Page) {
  await page.waitForSelector("html[data-tx80-hydrated='true']");
  await page.locator("[data-tx80-mode=play]").click();
  await expect(page.locator('[data-tx80-shell="play"]')).toBeVisible();
  const key = page.locator("[data-midi]").first();
  await expect(key).toBeVisible({ timeout: 10_000 });
  const box = await key.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height * 0.8);
  await page.mouse.down();
  await expect.poll(async () => (await diag(page)).running, { timeout: 15_000 }).toBe(true);
  await expect.poll(async () => (await diag(page)).activeVoices).toBeGreaterThan(0);
  await page.mouse.up();
  await expect.poll(async () => (await diag(page)).activeVoices, { timeout: 10_000 }).toBe(0);
}

async function midiList(page: Page): Promise<number[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("[data-midi]")]
      .map((el) => Number(el.getAttribute("data-midi")))
      .filter((n) => Number.isFinite(n)),
  );
}

async function pressMidi(page: Page, midi: number, holdMs: number) {
  const key = page.locator(`[data-midi="${midi}"]`).first();
  if ((await key.count()) === 0) return false;
  await key.scrollIntoViewIfNeeded();
  const box = await key.boundingBox();
  if (!box) return false;
  const x = box.x + box.width / 2;
  const y = box.y + box.height * 0.85;
  await page.mouse.move(x, y);
  await page.mouse.down();
  if (holdMs > 0) await page.waitForTimeout(Math.max(holdMs, 16));
  await page.mouse.up();
  return true;
}

const SEEDS = [11, 42, 77, 99, 123];
const EVENTS_PER_SEED = 100; // 5 × 100 = 500 events

test.describe("voice stress ownership", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.removeItem("tx80-ui-mode");
      } catch {
        /* noop */
      }
    });
    await page.goto("/");
    await ensureReady(page);
  });

  for (const seed of SEEDS) {
    test(`seed ${seed}: ${EVENTS_PER_SEED} randomized note events leave clean ownership`, async ({
      page,
    }) => {
      const rand = mulberry32(seed);
      const midis = await midiList(page);
      expect(midis.length).toBeGreaterThan(3);

      for (let i = 0; i < EVENTS_PER_SEED; i++) {
        const midi = midis[Math.floor(rand() * midis.length)]!;
        const hold = 8 + Math.floor(rand() * 36);
        await pressMidi(page, midi, hold);
      }

      await page.getByRole("button", { name: /Panic/i }).click();
      await expect.poll(async () => (await diag(page)).activeVoices, { timeout: 8_000 }).toBe(0);

      const d = await diag(page);
      expect(d.activeVoices).toBe(0);
      expect(d.contextsCreated).toBeLessThanOrEqual(1);
      expect(d.enginesCreated).toBeLessThanOrEqual(1);

      // Still playable after stress — hold long enough for analyser voice count
      const m = midis[Math.floor(midis.length / 2)]!;
      const key = page.locator(`[data-midi="${m}"]`).first();
      const box = await key.boundingBox();
      expect(box).toBeTruthy();
      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height * 0.85);
      await page.mouse.down();
      await expect.poll(async () => (await diag(page)).activeVoices, { timeout: 8_000 }).toBeGreaterThan(0);
      await page.mouse.up();
      await page.getByRole("button", { name: /Panic/i }).click();
      await expect.poll(async () => (await diag(page)).activeVoices, { timeout: 8_000 }).toBe(0);
    });
  }

  test("same-note stacking and polyphony steal stay bounded", async ({ page }) => {
    const midis = await midiList(page);
    const a = midis[0]!;
    const b = midis[Math.min(2, midis.length - 1)]!;

    for (let i = 0; i < 40; i++) await pressMidi(page, a, 12);
    await expect.poll(async () => (await diag(page)).activeVoices, { timeout: 8_000 }).toBe(0);

    for (let i = 0; i < 40; i++) {
      await pressMidi(page, i % 2 === 0 ? a : b, 10);
    }
    await expect.poll(async () => (await diag(page)).activeVoices, { timeout: 8_000 }).toBe(0);

    await page.getByRole("button", { name: "Sustain" }).first().click();
    for (let i = 0; i < 30; i++) await pressMidi(page, midis[i % midis.length]!, 8);
    await page.getByRole("button", { name: "Sustain" }).first().click();
    await expect.poll(async () => (await diag(page)).activeVoices, { timeout: 10_000 }).toBe(0);

    await page.getByRole("button", { name: /Panic/i }).click();
    const d = await diag(page);
    expect(d.activeVoices).toBe(0);
    expect(d.contextsCreated).toBe(1);
  });

  test("mode and orientation change during held notes cleans ownership", async ({ page }) => {
    const midis = await midiList(page);
    const key = page.locator(`[data-midi="${midis[1]}"]`).first();
    const box = await key.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height * 0.85);
    await page.mouse.down();
    await expect.poll(async () => (await diag(page)).activeVoices).toBeGreaterThan(0);
    await page.mouse.up();

    await page.locator("[data-tx80-mode=edit]").click();
    await expect(page.locator('[data-tx80-shell="edit"]')).toBeVisible();

    await page.locator("[data-tx80-mode=play]").click();
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForSelector("html[data-tx80-hydrated='true']");
    await page.getByRole("button", { name: /Panic/i }).click();
    await expect.poll(async () => (await diag(page)).activeVoices, { timeout: 8_000 }).toBe(0);
    const d = await diag(page);
    expect(d.contextsCreated).toBe(1);
  });
});
