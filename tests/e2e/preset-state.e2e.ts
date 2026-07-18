import { test, expect, type Page } from "@playwright/test";

/**
 * TX-80 preset / state validation through the real UI + storage path.
 *
 * Exercises the genuine UI → localStorage round trip in a real browser:
 * patch parameter → SAVE AS → tx80-user-presets payload → reload survival,
 * plus settings separation and factory preset navigation.
 */

const USER_PRESETS_KEY = "tx80-user-presets";
const SETTINGS_KEY = "tx80-settings";

const travelGliss = (page: Page) =>
  page.getByRole("button", { name: "GLISS", exact: true }).first();

async function readUserPresets(page: Page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, USER_PRESETS_KEY);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Power on|Power off/ })).toBeVisible();
});

test("pitch travel mode set in UI persists through Save As and reload", async ({ page }) => {
  await expect(travelGliss(page)).toBeVisible();
  await travelGliss(page).click();
  await expect(travelGliss(page)).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "SAVE AS" }).click();
  const nameField = page.getByLabel("PRESET NAME");
  await expect(nameField).toBeVisible();
  await nameField.fill("GLISS TRAVEL TEST");
  await page.getByRole("button", { name: "SAVE", exact: true }).click();

  const lib = await readUserPresets(page);
  expect(lib).not.toBeNull();
  const entry = lib.entries.find((e: { name: string }) => e.name === "GLISS TRAVEL TEST");
  expect(entry, "saved entry present").toBeTruthy();
  expect(entry.patch.pitchTravel.mode).toBe("gliss");

  // Survives a full reload (storage-backed).
  await page.reload();
  const lib2 = await readUserPresets(page);
  const entry2 = lib2.entries.find((e: { name: string }) => e.name === "GLISS TRAVEL TEST");
  expect(entry2.patch.pitchTravel.mode).toBe("gliss");
});

test("saved user preset is restored as the active patch after reload", async ({ page }) => {
  await page.getByRole("button", { name: "SAVE AS" }).click();
  const nameField = page.getByLabel("PRESET NAME");
  await nameField.fill("RELOAD RESTORE TEST");
  await page.getByRole("button", { name: "SAVE", exact: true }).click();
  await expect(page.getByTestId("tx80-patch-name")).toContainText("RELOAD RESTORE TEST");
  await page.reload();
  await expect(page.getByTestId("tx80-patch-name")).toContainText("RELOAD RESTORE TEST", {
    timeout: 10_000,
  });
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
  const lib = await readUserPresets(page);
  expect(lib === null || Array.isArray(lib.entries)).toBe(true);
});

test("factory presets load and change the active patch (Next preset)", async ({ page }) => {
  const lcd = page.getByTestId("tx80-patch-name");
  const before = (await lcd.textContent())?.trim() ?? "";
  await page.getByRole("button", { name: "Next preset" }).click();
  await expect
    .poll(async () => ((await lcd.textContent()) ?? "").trim(), { timeout: 5000 })
    .not.toBe(before);
});

test("preset delete removes the entry and keeps the instrument playable", async ({ page }) => {
  await page.getByRole("button", { name: "SAVE AS" }).click();
  await page.getByLabel("PRESET NAME").fill("DELETE ME");
  await page.getByRole("button", { name: "SAVE", exact: true }).click();
  await expect(page.getByTestId("tx80-patch-name")).toContainText("DELETE ME");

  await page.getByRole("button", { name: "DEL", exact: true }).click();
  await page.getByRole("button", { name: "DELETE", exact: true }).click();
  const lib = await readUserPresets(page);
  const entry = (lib?.entries ?? []).find((e: { name: string }) => e.name === "DELETE ME");
  expect(entry).toBeFalsy();
  await expect(page.getByRole("button", { name: /Power on|Power off/ })).toBeVisible();
});
