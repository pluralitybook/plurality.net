import { test, expect } from "@playwright/test";

test.describe("homepage", () => {
  test("renders with title and hero", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Plurality/);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
  });

  test("nav is present with primary links", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav.nav, .nav").first();
    await expect(nav).toBeVisible();
    await expect(page.getByRole("link", { name: /read/i }).first()).toBeVisible();
  });

  test("skip link appears and targets main", async ({ page }) => {
    await page.goto("/");
    const skipLink = page.locator(".skip-link");
    await expect(skipLink).toHaveAttribute("href", "#main");
    await expect(page.locator("#main")).toBeVisible();
  });

  test("has no console errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Tolerate font network errors in case of offline CI
    const filtered = errors.filter(
      (e) => !/font|googleapis|gstatic|pagefind/i.test(e)
    );
    expect(filtered).toEqual([]);
  });

  test("structured data JSON-LD is valid JSON", async ({ page }) => {
    await page.goto("/");
    const text = await page.locator("script[type='application/ld+json']").textContent();
    expect(text).toBeTruthy();
    const json = JSON.parse(text!);
    expect(json["@type"]).toBe("WebSite");
    expect(json.name).toBe("Plurality");
  });

  test("canonical URL is present", async ({ page }) => {
    await page.goto("/");
    const href = await page.locator("link[rel='canonical']").getAttribute("href");
    expect(href).toMatch(/^https:\/\/plurality\.net/);
  });
});
