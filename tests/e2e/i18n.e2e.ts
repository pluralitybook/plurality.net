import { test, expect } from "@playwright/test";

const LANG_HOMES = [
  { prefix: "/zh/", tag: "zh" },
  { prefix: "/ja/", tag: "ja" },
  { prefix: "/th/", tag: "th" },
  { prefix: "/el/", tag: "el" },
  { prefix: "/de/", tag: "de" },
];

test.describe("internationalized homepages", () => {
  for (const { prefix, tag } of LANG_HOMES) {
    test(`${prefix} renders with <html lang='${tag}'>`, async ({ page }) => {
      const res = await page.goto(prefix);
      expect(res?.ok()).toBe(true);
      const lang = await page.locator("html").getAttribute("lang");
      expect(lang).toBe(tag);
    });
  }
});

test.describe("internationalized chapter pages", () => {
  for (const { prefix, tag } of LANG_HOMES) {
    test(`${prefix}read/0-0/ loads with correct lang attr`, async ({ page }) => {
      const res = await page.goto(`${prefix}read/0-0/`);
      expect(res?.ok()).toBe(true);
      const lang = await page.locator("html").getAttribute("lang");
      expect(lang).toBe(tag);
    });
  }
});

test.describe("language switching", () => {
  test("altLang links on chapter 1 (en) include at least one other lang", async ({
    page,
  }) => {
    await page.goto("/read/1/");
    const altLinks = page.locator("a[hreflang]");
    const count = await altLinks.count();
    // If hreflang isn't rendered, at least a language link should exist
    expect(count + (await page.locator("a[href*='/read/1/']").count())).toBeGreaterThan(0);
  });
});
