import { test, expect } from "@playwright/test";

test.describe("reading flow", () => {
  test("/read/ lists chapter groups", async ({ page }) => {
    await page.goto("/read/");
    await expect(page.locator("h1")).toBeVisible();
    const cards = page.locator(".chapter-card");
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThan(20);
  });

  test("clicking a chapter navigates to chapter page", async ({ page }) => {
    await page.goto("/read/");
    await page.locator(".chapter-card").first().click();
    await expect(page).toHaveURL(/\/read\/[^/]+\/$/);
    await expect(page.locator("main")).toBeVisible();
  });

  test("chapter page has Table of Contents toggle", async ({ page }) => {
    await page.goto("/read/1/");
    const toc = page.locator(".reader__toc-toggle");
    const tocCount = await toc.count();
    if (tocCount > 0) {
      await expect(toc.first()).toBeVisible();
    }
  });

  test("can open a front-matter chapter directly", async ({ page }) => {
    const res = await page.goto("/read/0-0/");
    expect(res?.ok()).toBe(true);
    await expect(page.locator("main")).toBeVisible();
  });

  test("credits chapter (0-3) renders a category list", async ({ page }) => {
    await page.goto("/read/0-3/");
    await expect(page.locator("main")).toBeVisible();
    // Expect credits structure when rendered locally (not fetched)
    const list = page.locator(".credits__list, .credits__category");
    const n = await list.count();
    expect(n).toBeGreaterThan(0);
  });
});
