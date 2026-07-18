import { test, expect, type Page } from "@playwright/test";

/**
 * Preset / state validation through the real UI + storage path.
 *
 * glideMode is the Gate 2 R1 regression. Unit tests cover serialize /
 * import / storage-reload; this exercises the genuine UI → localStorage
 * round trip in a real browser to confirm the shipped path persists it.
 */

const USER_LIBRARY_KEY = "tx27.userLibrary.v2";
const SETTINGS_KEY = "tx27-settings";
const glideLegato = (page: Page) => page.getByRole("button", { name: "LEGATO" });

async function readUserLibrary(page: Page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, USER_LIBRARY_KEY);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Power on|Power off/ })).toBeVisible();
});

test("glideMode set in UI persists to the user library through Save As", async ({ page }) => {
  await expect(glideLegato(page)).toBeVisible();
  await glideLegato(page).click();
  await expect(glideLegato(page)).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "SAVE AS" }).click();
  const nameField = page.getByLabel("Preset name");
  await expect(nameField).toBeVisible();
  await nameField.fill("GLIDE LEGATO TEST");
  await page.getByRole("button", { name: "SAVE", exact: true }).click();

  const lib = await readUserLibrary(page);
  expect(lib).not.toBeNull();
  const entry = lib.entries.find(
    (e: { meta: { name: string } }) => e.meta.name === "GLIDE LEGATO TEST",
  );
  expect(entry, "saved entry present").toBeTruthy();
  expect(entry.patch.glideMode).toBe("mono");

  // Survives a full reload (storage-backed).
  await page.reload();
  const lib2 = await readUserLibrary(page);
  const entry2 = lib2.entries.find(
    (e: { meta: { name: string } }) => e.meta.name === "GLIDE LEGATO TEST",
  );
  expect(entry2.patch.glideMode).toBe("mono");
});

test("settings (bend range) persist across reload, separate from patch state", async ({ page }) => {
  await page.evaluate((key) => {
    localStorage.setItem(key, JSON.stringify({ bendRangeSemitones: 7, confirmPresetChange: true }));
  }, SETTINGS_KEY);
  await page.reload();
  const stored = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, SETTINGS_KEY);
  expect(stored.bendRangeSemitones).toBe(7);
  // Settings live outside the patch/library payload.
  const lib = await readUserLibrary(page);
  expect(lib === null || Array.isArray(lib.entries)).toBe(true);
});

test("factory presets load and change the active patch (Next preset)", async ({ page }) => {
  const center = page.getByRole("button", { name: "Open preset quick access" });
  const nameOf = async () =>
    (await center.locator("span.font-bold").first().textContent())?.trim() ?? "";

  const before = await nameOf();
  await page.getByRole("button", { name: "Next preset" }).click();
  await expect.poll(async () => nameOf(), { timeout: 5000 }).not.toBe(before);
});

test("quick access opens from the LCD and can be dismissed", async ({ page }) => {
  await page.getByRole("button", { name: "Open preset quick access" }).click();
  const qa = page.getByRole("dialog", { name: "Preset quick access" });
  await expect(qa).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(qa).toHaveCount(0);
});
