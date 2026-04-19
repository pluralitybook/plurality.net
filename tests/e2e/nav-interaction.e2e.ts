import { test, expect } from "@playwright/test";

test.describe("nav interactions", () => {
  test("hamburger opens the overlay on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const hamburger = page.locator(".nav__hamburger");
    const overlay = page.locator(".nav__overlay");
    if ((await hamburger.count()) === 0) {
      test.skip();
      return;
    }
    await hamburger.click();
    await expect(overlay).toHaveClass(/active/);
    await page.keyboard.press("Escape");
    await expect(overlay).not.toHaveClass(/active/);
  });

  test("theme toggle switches data attribute", async ({ page }) => {
    await page.goto("/");

    // On narrow viewports the in-nav toggle is hidden; open the hamburger
    // menu so the overlay's toggle becomes interactable.
    const hamburger = page.locator(".nav__hamburger");
    if (await hamburger.isVisible().catch(() => false)) {
      await hamburger.click();
      await expect(page.locator(".nav__overlay")).toHaveClass(/active/);
    }

    const toggle = page.locator(".theme-toggle:visible").first();
    if ((await toggle.count()) === 0) {
      test.skip();
      return;
    }

    const before = await page
      .locator("html")
      .evaluate((el) => el.getAttribute("data-theme"));
    await toggle.click();
    await page.waitForTimeout(100);
    const after = await page
      .locator("html")
      .evaluate((el) => el.getAttribute("data-theme"));
    expect(after).not.toBe(before);
  });
});
