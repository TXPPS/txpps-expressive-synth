import { test, expect, type Page } from "@playwright/test";

/**
 * Minimal cross-browser smoke — runs on the installed Chromium-based Edge
 * channel so "every locally available Chromium browser" has real coverage
 * for the critical path (cold launch → gesture → audio running → panic).
 */

const C4 = 60;
const powerBtn = (page: Page) => page.getByRole("button", { name: /Power on|Power off/ });

test("Edge: cold launch, gesture activates audio, panic stays healthy", async ({ page }) => {
  await page.goto("/");
  await expect(powerBtn(page)).toBeVisible();
  await expect(powerBtn(page)).toHaveAttribute("aria-label", "Power on");

  await page.locator(`[data-note="${C4}"]`).first().click();
  await expect(powerBtn(page)).toHaveAttribute("aria-label", "Power off", {
    timeout: 15_000,
  });
  await expect(powerBtn(page)).toContainText("ON");

  await page.getByRole("button", { name: "PANIC" }).click();
  await expect(powerBtn(page)).toContainText("ON");
  await expect(page.getByText("AUDIO START FAILED", { exact: false })).toHaveCount(0);
});
