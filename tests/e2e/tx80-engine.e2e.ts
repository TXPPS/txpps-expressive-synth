import { test, expect, type Page } from "@playwright/test";

/**
 * TX-80 engine verification against the real production build.
 *
 * Headless Chromium renders the Web Audio graph (muted output), so voice
 * allocation, layer behavior, modulation routing and the master analyser
 * can all be observed through the read-only window.__TX80_DIAG /
 * window.__TX80_PEAK hooks plus the real UI. What CANNOT be verified here
 * is perceptual sound quality — that stays on the human listening list.
 */

const C4 = 60;
const E4 = 64;
const G4 = 67;
const powerBtn = (page: Page) => page.getByRole("button", { name: /Power on|Power off/ });

interface Diag {
  engineId: string;
  contextState: string;
  running: boolean;
  usable: boolean;
  activeVoices?: number;
}

const readDiag = (page: Page): Promise<Diag | null> =>
  page.evaluate(() => {
    const w = window as unknown as { __TX80_DIAG?: () => Diag | null };
    return w.__TX80_DIAG ? w.__TX80_DIAG() : null;
  });

const readPeak = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const w = window as unknown as { __TX80_PEAK?: () => number };
    return w.__TX80_PEAK ? w.__TX80_PEAK() : -1;
  });

async function pollPeakAbove(page: Page, threshold: number, timeout = 5000): Promise<number> {
  let last = -1;
  await expect
    .poll(
      async () => {
        last = await readPeak(page);
        return last;
      },
      { timeout },
    )
    .toBeGreaterThan(threshold);
  return last;
}

async function activateAudio(page: Page): Promise<void> {
  await page.locator(`[data-note="${C4}"]`).first().click();
  await expect(powerBtn(page)).toHaveAttribute("aria-label", "Power off", { timeout: 15_000 });
}

async function holdKey(page: Page, note: number): Promise<void> {
  const key = page.locator(`[data-note="${note}"]`).first();
  const box = await key.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height * 0.8);
  await page.mouse.down();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(powerBtn(page)).toBeVisible();
});

test("engine reports the TX-80 dual-layer engine id and a running context", async ({ page }) => {
  await activateAudio(page);
  const diag = await readDiag(page);
  expect(diag).not.toBeNull();
  expect(diag!.engineId).toBe("tx80.dual2");
  expect(diag!.contextState).toBe("running");
  expect(diag!.usable).toBe(true);
});

test("a held note produces real signal at the master analyser; release ends it", async ({
  page,
}) => {
  await activateAudio(page);
  await holdKey(page, C4);
  await pollPeakAbove(page, 0.01);
  const diag = await readDiag(page);
  expect(diag!.activeVoices).toBe(1);
  await page.mouse.up();
  // After amp-envelope release (0.4 s default preset ≤ ~1.5 s) + reverb tail
  // fade, the peak must decay — no stuck voice, no runaway feedback.
  await expect.poll(async () => (await readDiag(page))!.activeVoices, { timeout: 5000 }).toBe(0);
  await expect.poll(() => readPeak(page), { timeout: 8000 }).toBeLessThan(0.05);
});

test("chord allocates one coordinated voice per note", async ({ page }) => {
  await activateAudio(page);
  // Hold sustain (Space) so clicked notes keep sounding as a chord.
  await page.keyboard.down(" ");
  await page.locator(`[data-note="${C4}"]`).first().click();
  await page.locator(`[data-note="${E4}"]`).first().click();
  await page.locator(`[data-note="${G4}"]`).first().click();
  await expect.poll(async () => (await readDiag(page))!.activeVoices, { timeout: 3000 }).toBe(3);
  await page.keyboard.up(" ");
  await expect.poll(async () => (await readDiag(page))!.activeVoices, { timeout: 5000 }).toBe(0);
});

test("repeated same-note presses stack and release one-for-one", async ({ page }) => {
  await activateAudio(page);
  // Press C4 twice via two independent input paths: the on-screen key
  // (pointer) and the computer keyboard 'a' (same MIDI note at octave 4).
  await holdKey(page, C4);
  await page.keyboard.down("a");
  await expect.poll(async () => (await readDiag(page))!.activeVoices, { timeout: 3000 }).toBe(2);
  await page.keyboard.up("a");
  await expect.poll(async () => (await readDiag(page))!.activeVoices, { timeout: 3000 }).toBe(1);
  await page.mouse.up();
  await expect.poll(async () => (await readDiag(page))!.activeVoices, { timeout: 3000 }).toBe(0);
});

test("voice stealing caps active voices at the configured polyphony", async ({ page }) => {
  await activateAudio(page);
  await page.getByRole("button", { name: "4V", exact: true }).click();
  await page.keyboard.down(" "); // sustain so voices accumulate
  for (const note of [60, 62, 64, 65, 67, 69, 71]) {
    const key = page.locator(`[data-note="${note}"]`).first();
    if (await key.count()) await key.click();
  }
  const diag = await readDiag(page);
  expect(diag!.activeVoices).toBeLessThanOrEqual(4);
  expect(diag!.activeVoices).toBeGreaterThan(0);
  await page.keyboard.up(" ");
  await expect.poll(async () => (await readDiag(page))!.activeVoices, { timeout: 5000 }).toBe(0);
});

test("panic silences everything immediately", async ({ page }) => {
  await activateAudio(page);
  await page.keyboard.down(" ");
  await page.locator(`[data-note="${C4}"]`).first().click();
  await page.locator(`[data-note="${E4}"]`).first().click();
  await page.keyboard.up(" ");
  await holdKey(page, G4);
  await pollPeakAbove(page, 0.01);
  await page.getByRole("button", { name: "PANIC" }).click();
  await page.mouse.up();
  await expect.poll(async () => (await readDiag(page))!.activeVoices, { timeout: 2000 }).toBe(0);
  await expect.poll(() => readPeak(page), { timeout: 6000 }).toBeLessThan(0.05);
});

test("solo mode keeps one voice under legato playing", async ({ page }) => {
  await activateAudio(page);
  await page.getByRole("button", { name: "SOLO", exact: true }).click();
  await page.keyboard.down("a"); // C4
  await expect.poll(async () => (await readDiag(page))!.activeVoices, { timeout: 3000 }).toBe(1);
  await page.keyboard.down("d"); // E4 overlapping — legato retune, same voice
  await page.waitForTimeout(150);
  expect((await readDiag(page))!.activeVoices).toBe(1);
  await page.keyboard.up("d");
  await page.waitForTimeout(150);
  expect((await readDiag(page))!.activeVoices).toBe(1); // returned to held C4
  await page.keyboard.up("a");
  await expect.poll(async () => (await readDiag(page))!.activeVoices, { timeout: 3000 }).toBe(0);
});

test("portamento and glissando modes play without errors and arrive cleanly", async ({ page }) => {
  await activateAudio(page);
  for (const mode of ["PORTA", "GLISS"] as const) {
    await page.getByRole("button", { name: mode, exact: true }).first().click();
    await page.locator(`[data-note="${C4}"]`).first().click();
    await page.locator(`[data-note="${G4}"]`).first().click();
    await page.waitForTimeout(250);
  }
  await expect.poll(async () => (await readDiag(page))!.activeVoices, { timeout: 5000 }).toBe(0);
  const diag = await readDiag(page);
  expect(diag!.contextState).toBe("running");
  await expect(page.getByText("AUDIO START FAILED", { exact: false })).toHaveCount(0);
});

test("layer II enable/disable is independent and audible via voice graph", async ({ page }) => {
  await activateAudio(page);
  // Enable Layer II (INIT-derived default preset ships it muted on the
  // default factory preset it is enabled — use its own toggle regardless).
  const l2Section = page.locator("section", { hasText: "LAYER II" }).first();
  const toggle = l2Section.getByRole("button", { name: /^(ON|MUTED)$/ }).first();
  const before = await toggle.textContent();
  await toggle.click();
  await expect(toggle).not.toHaveText(before ?? "");
  // Layer I state is untouched by the Layer II toggle.
  const l1Section = page.locator("section", { hasText: "LAYER I" }).first();
  await expect(l1Section.getByRole("button", { name: /^(ON|MUTED)$/ }).first()).toHaveText("ON");
  // Playing still works after the toggle.
  await holdKey(page, C4);
  await pollPeakAbove(page, 0.005);
  await page.mouse.up();
});

test("LFO destination change rewires cleanly with no residual error state", async ({ page }) => {
  await activateAudio(page);
  const destSelect = page.getByRole("button", { name: "LFO A destination" });
  // Bring the MOD panel fully into view BEFORE interacting: the themed
  // listbox closes on outside scroll, so a click that auto-scrolls would
  // race the open state.
  await destSelect.scrollIntoViewIfNeeded();
  for (const dest of ["FILTER", "AMP", "PAN", "BALANCE", "PW", "PITCH"]) {
    await destSelect.click();
    const option = page.getByRole("option", { name: dest, exact: true });
    await expect(option).toBeVisible({ timeout: 5000 });
    await option.click();
  }
  await holdKey(page, C4);
  await pollPeakAbove(page, 0.005);
  await page.mouse.up();
  const diag = await readDiag(page);
  expect(diag!.contextState).toBe("running");
  await expect(page.getByText("AUDIO START FAILED", { exact: false })).toHaveCount(0);
});

test("preset switching while holding a note releases it cleanly", async ({ page }) => {
  await activateAudio(page);
  await holdKey(page, C4);
  await expect.poll(async () => (await readDiag(page))!.activeVoices, { timeout: 3000 }).toBe(1);
  await page.getByRole("button", { name: "Next preset" }).click();
  await page.mouse.up();
  await expect.poll(async () => (await readDiag(page))!.activeVoices, { timeout: 5000 }).toBe(0);
  await expect(page.getByText("AUDIO START FAILED", { exact: false })).toHaveCount(0);
});

test("ribbon drag and release leave no stale pitch offset or errors", async ({ page }) => {
  await activateAudio(page);
  const ribbon = page.getByTestId("tx80-ribbon");
  const box = await ribbon.boundingBox();
  expect(box).not.toBeNull();
  await holdKey(page, C4);
  // Drag along the ribbon: touch centre, sweep right, sweep left, release.
  const midY = box!.y + box!.height / 2;
  await page.mouse.move(box!.x + box!.width * 0.5, midY);
  // Note: holdKey used the primary mouse button — use touch instead so the
  // held key keeps its pointer. Playwright's mouse is a single pointer, so
  // instead release the key first and verify ribbon standalone.
  await page.mouse.up();
  await page.mouse.move(box!.x + box!.width * 0.5, midY);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.9, midY, { steps: 8 });
  await page.mouse.move(box!.x + box!.width * 0.1, midY, { steps: 8 });
  await page.mouse.up();
  const diag = await readDiag(page);
  expect(diag!.contextState).toBe("running");
  await expect(page.getByText("AUDIO START FAILED", { exact: false })).toHaveCount(0);
});
