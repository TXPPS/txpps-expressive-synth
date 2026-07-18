import { test, expect, type Page } from "@playwright/test";

/**
 * Audio lifecycle validation against the real production build.
 *
 * Observable signals used (no diagnostic UI is added to the app):
 *  - POWER button aria-label flips "Power on" ↔ "Power off"
 *  - POWER button text: READY → STARTING → "● ON" (or RETRY on failure)
 *  - the AUDIO START FAILED banner
 *  - localStorage "tx27-startup-diag" phase trace (already shipped)
 *  - active-key inset shadow on the on-screen keyboard
 */

const C4 = 60; // octave 4 default → first white key data-note
const E4 = 64;
const G4 = 67;

interface Diag {
  phases: Array<[number, string]>;
  error?: { name: string; message: string };
}

async function readDiag(page: Page): Promise<Diag | null> {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem("tx27-startup-diag");
      return raw ? (JSON.parse(raw) as Diag) : null;
    } catch {
      return null;
    }
  });
}

function phaseLabels(d: Diag | null): string[] {
  return (d?.phases ?? []).map((p) => p[1]);
}

const powerBtn = (page: Page) => page.getByRole("button", { name: /Power on|Power off/ });

async function keyIsActive(page: Page, note: number): Promise<boolean> {
  // Active keys use a positive-offset inset shadow ("… 0px 4px Npx inset");
  // idle white keys use a negative offset ("… 0px -6px 8px inset"). The
  // browser serializes box-shadow offset-first, hence this signature.
  const style = await page.locator(`[data-note="${note}"]`).first().getAttribute("style");
  return !!style && /0px 4px \d+px inset/.test(style);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(powerBtn(page)).toBeVisible();
});

test("cold launch arms without error (READY, no failure banner)", async ({ page }) => {
  await expect(powerBtn(page)).toHaveAttribute("aria-label", "Power on");
  await expect(powerBtn(page)).toContainText(/READY|POWER/);
  await expect(page.getByText("AUDIO START FAILED", { exact: false })).toHaveCount(0);
  const diag = await readDiag(page);
  expect(phaseLabels(diag)).toContain("app_loaded_armed");
});

test("first intentional note during activation is preserved and unlocks audio", async ({
  page,
}) => {
  await page.locator(`[data-note="${C4}"]`).first().click();
  await expect(powerBtn(page)).toHaveAttribute("aria-label", "Power off", {
    timeout: 15_000,
  });
  await expect(powerBtn(page)).toContainText("ON");
  const labels = phaseLabels(await readDiag(page));
  expect(labels).toContain("first-note:queued");
  // Either the queued note was flushed once running, or it was played directly.
  expect(labels.some((l) => l === "first-note:flushed" || l === "first-note:direct")).toBe(true);
  expect(labels).toContain("ctx:running");
});

test("note on/off and multiple notes leave no error", async ({ page }) => {
  await page.locator(`[data-note="${C4}"]`).first().click();
  await expect(powerBtn(page)).toHaveAttribute("aria-label", "Power off", {
    timeout: 15_000,
  });
  await page.locator(`[data-note="${E4}"]`).first().click();
  await page.locator(`[data-note="${G4}"]`).first().click();
  const diag = await readDiag(page);
  expect(diag?.error).toBeUndefined();
  await expect(page.getByText("AUDIO START FAILED", { exact: false })).toHaveCount(0);
});

test("rapid repeated activation does not error or wedge", async ({ page }) => {
  const key = page.locator(`[data-note="${C4}"]`).first();
  for (let i = 0; i < 5; i++) await key.click({ delay: 5 });
  await expect(powerBtn(page)).toHaveAttribute("aria-label", "Power off", {
    timeout: 15_000,
  });
  const diag = await readDiag(page);
  expect(diag?.error).toBeUndefined();
  // Deduplicated: exactly one successful readiness even under gesture spam.
  expect(phaseLabels(diag).filter((l) => l === "ready").length).toBe(1);
});

test("panic after playing clears active keys and keeps audio healthy", async ({ page }) => {
  await page.locator(`[data-note="${C4}"]`).first().click();
  await expect(powerBtn(page)).toHaveAttribute("aria-label", "Power off", {
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "PANIC" }).click();
  expect(await keyIsActive(page, C4)).toBe(false);
  await expect(powerBtn(page)).toContainText("ON");
  const diag = await readDiag(page);
  expect(diag?.error).toBeUndefined();
});

test("power off then re-activate (reconnect) works", async ({ page }) => {
  await page.locator(`[data-note="${C4}"]`).first().click();
  await expect(powerBtn(page)).toHaveAttribute("aria-label", "Power off", {
    timeout: 15_000,
  });
  await powerBtn(page).click(); // power off
  await expect(powerBtn(page)).toHaveAttribute("aria-label", "Power on");
  await page.locator(`[data-note="${E4}"]`).first().click(); // re-activate via note
  await expect(powerBtn(page)).toHaveAttribute("aria-label", "Power off", {
    timeout: 15_000,
  });
  const diag = await readDiag(page);
  expect(diag?.error).toBeUndefined();
});

test("backgrounding releases a held note (no stuck note)", async ({ page }) => {
  const key = page.locator(`[data-note="${C4}"]`).first();
  const box = await key.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await expect(powerBtn(page)).toHaveAttribute("aria-label", "Power off", {
    timeout: 15_000,
  });
  expect(await keyIsActive(page, C4)).toBe(true);
  // Simulate tab backgrounding.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.mouse.up();
  expect(await keyIsActive(page, C4)).toBe(false);
  const labels = phaseLabels(await readDiag(page));
  expect(labels).toContain("hidden");
});
