import { test, expect } from "@playwright/test";

test.describe("book-ask client", () => {
  test("script is versioned, defines hideAsk, no hideAsk ReferenceError on search open", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/");
    const src = await page.locator('script[src*="book-ask.js"]').getAttribute("src");
    expect(src).toBeTruthy();
    expect(src).toMatch(/\?v=/);

    const res = await page.request.get(src!);
    expect(res.ok()).toBe(true);
    const body = await res.text();
    expect(body).toMatch(/function hideAsk/);


    const hamburger = page.locator(".nav__hamburger");
    if (await hamburger.isVisible().catch(() => false)) {
      await hamburger.click();
      await expect(page.locator(".nav__overlay")).toHaveClass(/active/);
    }

    await page.locator(".search-toggle:visible").first().click();
    await expect(page.locator("#search-overlay.active")).toBeVisible();

    const hideAskErrors = pageErrors.filter((m) => /hideAsk is not defined/i.test(m));
    expect(hideAskErrors).toEqual([]);
  });

  test("search overlay has tappable magnifier submit, no clear button", async ({
    page,
  }) => {
    await page.goto("/");

    const hamburger = page.locator(".nav__hamburger");
    if (await hamburger.isVisible().catch(() => false)) {
      await hamburger.click();
      await expect(page.locator(".nav__overlay")).toHaveClass(/active/);
    }

    await page.locator(".search-toggle:visible").first().click();
    await expect(page.locator("#search-overlay.active")).toBeVisible();

    const submit = page.locator("#search-overlay .plurality-search__submit");
    await expect(submit).toBeVisible();
    await expect(submit).toHaveAttribute("type", "button");

    const clear = page.locator("#search-overlay .pagefind-ui__search-clear");
    await expect(clear).toHaveCount(0);
  });
});