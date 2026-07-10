import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DIST_ROOT = resolve(process.cwd(), "dist");

test.describe("search findability", () => {
  test("ja exact hit ranks first with badge", async ({ page }) => {
    await page.goto("/ja/");

    const hamburger = page.locator(".nav__hamburger");
    if (await hamburger.isVisible().catch(() => false)) {
      await hamburger.click();
    }
    await page.locator(".search-toggle:visible").first().click();
    await expect(page.locator("#search-overlay.active")).toBeVisible();

    const input = page.locator(".pagefind-ui__search-input");
    await input.fill("トラスク");

    // Wait for Fuse index load + debounced render
    await expect(page.locator(".pagefind-ui__result").first()).toBeVisible({
      timeout: 15_000,
    });

    const firstLink = page
      .locator(".pagefind-ui__result")
      .first()
      .locator(".pagefind-ui__result-link")
      .first();
    await expect(firstLink).toHaveAttribute("href", /\/ja\/read\/5-4\//);

    const badge = page.locator(".plurality-search__badge").first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText("完全一致");

    const message = page.locator(".pagefind-ui__message");
    await expect(message).toContainText("完全一致");

    const mark = page.locator(".pagefind-ui__result mark").first();
    await expect(mark).toContainText("トラスク");
  });

  test("latin query falls back to English edition", async ({ page }) => {
    await page.goto("/ja/");

    const hamburger = page.locator(".nav__hamburger");
    if (await hamburger.isVisible().catch(() => false)) {
      await hamburger.click();
    }
    await page.locator(".search-toggle:visible").first().click();
    await expect(page.locator("#search-overlay.active")).toBeVisible();

    const input = page.locator(".pagefind-ui__search-input");
    await input.fill("Society Library");

    // En fallback fetches /search-index.json (~1.5 MB) — allow generous time
    await expect(page.locator(".plurality-search__en-note")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator(".plurality-search__en-note")).toContainText(
      "英語版での完全一致",
    );

    const enResult = page.locator(
      ".plurality-search__en-note ~ .pagefind-ui__result",
    );
    const link = enResult.first().locator(".pagefind-ui__result-link").first();
    await expect(link).toHaveAttribute("href", /\/read\/5-4\//);
  });
});

test.describe("ask history", () => {
  test("chip restores answer without refetch", async ({ page }) => {
    // Serve dist at the production hostname so initCapacity() host gate passes
    await page.route("http://plurality.net/**", async (route) => {
      const url = new URL(route.request().url());
      let rel = url.pathname;
      if (rel === "/" || rel.endsWith("/")) rel += "index.html";
      const filePath = DIST_ROOT + rel;
      let contentType = "text/html";
      if (rel.endsWith(".js")) contentType = "application/javascript";
      else if (rel.endsWith(".css")) contentType = "text/css";
      else if (rel.endsWith(".json")) contentType = "application/json";
      else if (rel.endsWith(".png")) contentType = "image/png";
      else if (rel.endsWith(".svg")) contentType = "image/svg+xml";
      let body: Buffer;
      try {
        body = readFileSync(filePath);
      } catch {
        body = readFileSync(DIST_ROOT + "/index.html");
      }
      await route.fulfill({ status: 200, contentType, body });
    });

    // Stub the ask worker
    await page.route("**/capacity*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "available" }),
      }),
    );

    let auCalls = 0;
    const canned = "Plurality is about collaborative technology.\n\n";
    await page.route("**/au/*", (route) => {
      auCalls++;
      return route.fulfill({
        status: 200,
        contentType: "text/plain; charset=utf-8",
        body: canned,
      });
    });

    await page.goto("http://plurality.net/");

    const hamburger = page.locator(".nav__hamburger");
    if (await hamburger.isVisible().catch(() => false)) {
      await hamburger.click();
    }
    await page.locator(".search-toggle:visible").first().click();
    await expect(page.locator("#search-overlay.active")).toBeVisible();

    // Wait for askAvailable (hint renders when capacity confirms)
    await expect(page.locator(".plurality-ask-history__hint")).toBeVisible({
      timeout: 10_000,
    });

    // Ask a question via Enter
    const input = page.locator(".pagefind-ui__search-input, #search-container input").first();
    await input.fill("what is plurality");
    await input.press("Enter");

    // Wait for the answer text to render (toBeVisible passes on the empty
    // loading cursor; toContainText waits for the streamed text to arrive)
    await expect(
      page.locator("#plurality-ask-answer .plurality-ask-answer__body"),
    ).toContainText("Plurality", { timeout: 10_000 });

    expect(auCalls).toBe(1);

    // Wait for streaming to finish (cursor disappears) before closing,
    // so saveToHistory has been called before hideAsk aborts
    await expect(
      page.locator("#plurality-ask-answer .plurality-ask-answer__cursor"),
    ).toHaveCount(0, { timeout: 5_000 });

    // Close overlay via Escape
    await page.keyboard.press("Escape");
    await expect(page.locator("#search-overlay")).not.toHaveClass(/active/);

    // Reopen overlay — on mobile, Escape also closes the nav__overlay, so
    // re-open the hamburger first to expose the mobile search toggle
    const hamburger2 = page.locator(".nav__hamburger");
    if (await hamburger2.isVisible().catch(() => false)) {
      await hamburger2.click();
    }
    await page.locator(".search-toggle:visible").first().click();
    await expect(page.locator("#search-overlay.active")).toBeVisible();

    // History chip should be visible
    const chip = page.locator(".plurality-ask-history__chip").first();
    await expect(chip).toBeVisible({ timeout: 5_000 });
    await expect(chip).toContainText("what is plurality");

    // Click chip — answer should restore without a new /au fetch
    await chip.click();
    await expect(
      page.locator("#plurality-ask-answer .plurality-ask-answer__body"),
    ).toContainText("Plurality");

    // No additional /au call — still 1
    expect(auCalls).toBe(1);
  });
});