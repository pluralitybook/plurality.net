import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

const localizedAskHints = {
  en: "Press Enter ⏎ to ask the AI about the book",
  zh: "按 Enter ⏎ 由 AI 依書中內容回答",
  ja: "Enter ⏎ で AI が本の内容から回答します",
  th: "กด Enter ⏎ เพื่อถาม AI เกี่ยวกับหนังสือเล่มนี้",
  el: "Πατήστε Enter ⏎ για να ρωτήσετε την ΤΝ σχετικά με το βιβλίο",
  de: "Enter ⏎ drücken, um die KI zum Buch zu befragen",
} as const;

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

  test("renders the book-AI hint in each supported locale", async ({ page }) => {
    await page.route("http://plurality.net/**", async (route) => {
      const url = new URL(route.request().url());
      let rel = url.pathname;
      if (rel === "/" || rel.endsWith("/")) rel += "index.html";
      const filePath = process.cwd() + "/dist" + rel;
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
        body = readFileSync(process.cwd() + "/dist/index.html");
      }
      await route.fulfill({ status: 200, contentType, body });
    });
    await page.route("**/capacity*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "available" }),
      }),
    );

    for (const [lang, expectedHint] of Object.entries(localizedAskHints)) {
      const path = lang === "en" ? "/" : `/${lang}/`;
      await page.goto(`http://plurality.net${path}`);

      const hamburger = page.locator(".nav__hamburger");
      if (await hamburger.isVisible().catch(() => false)) {
        await hamburger.click();
        await expect(page.locator(".nav__overlay")).toHaveClass(/active/);
      }
      await page.locator(".search-toggle:visible").first().click();
      await expect(page.locator("#search-overlay.active")).toBeVisible();

      const hint = page.locator(".plurality-ask-history__hint");
      await expect(hint).toHaveText(expectedHint);
      if (lang !== "en") await expect(hint).not.toHaveText(localizedAskHints.en);
    }
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

  test("ask answer renders footnotes as fully-line clickable numbered sources", async ({ page, baseURL }) => {
    // Serve the built site at the production hostname so book-ask.js's
    // initCapacity() host gate (plurality.net | www.plurality.net) lets it
    // fetch /capacity; on 127.0.0.1:4321 it would early-return and never flip
    // askAvailable, so runAsk() would bail before any fetch.
    const distRoot = process.cwd() + "/dist";
    await page.route("http://plurality.net/**", async (route) => {
      const url = new URL(route.request().url());
      let rel = url.pathname;
      if (rel === "/" || rel.endsWith("/")) rel += "index.html";
      const filePath = distRoot + rel;
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
        body = readFileSync(distRoot + "/index.html");
      }
      await route.fulfill({ status: 200, contentType, body });
    });
    // Stub the ask worker: capacity = available; /au/<q> returns a canned answer with [^n] defs.
    await page.route("**/capacity*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "available" }),
      }),
    );
    const canned =
      "Plurality describes collaborative technology[^1] and plural voting[^2].\n\n" +
      "[^1]: [Chapter 1](https://plurality.net/v/chapters/0-0/en/)\n" +
      "[^2]: [Chapter 2](https://plurality.net/v/chapters/0-1/en/)\n";
    await page.route("**/au/*", (route) =>
      route.fulfill({ status: 200, contentType: "text/plain; charset=utf-8", body: canned }),
    );

    void baseURL;
    await page.goto("http://plurality.net/");

    const hamburger = page.locator(".nav__hamburger");
    if (await hamburger.isVisible().catch(() => false)) {
      await hamburger.click();
      await expect(page.locator(".nav__overlay")).toHaveClass(/active/);
    }

    await page.locator(".search-toggle:visible").first().click();
    await expect(page.locator("#search-overlay.active")).toBeVisible();

    const input = page
      .locator("#search-overlay .pagefind-ui__search-input, #search-container input")
      .first();
    await input.fill("plurality");
    // Drive the ask stream directly via the public API (Enter is intercepted by
    // PluralitySearch.submit; runAsk is the deterministic entry point).
    const apiReady = await page.evaluate(() => {
      const w: unknown = window;
      if (typeof w !== "object" || w === null) return false;
      if (!("PluralityBookAsk" in w) || typeof w.PluralityBookAsk !== "object" || w.PluralityBookAsk === null) return false;
      const api = w.PluralityBookAsk;
      return "runAsk" in api && typeof api.runAsk === "function";
    });
    expect(apiReady).toBe(true);
    await page.evaluate(() => {
      const w: unknown = window;
      if (!(typeof w === "object" && w !== null && "PluralityBookAsk" in w)) return Promise.resolve();
      const api = w.PluralityBookAsk;
      if (!("runAsk" in api) || typeof api.runAsk !== "function") return Promise.resolve();
      return api.runAsk("plurality");
    });
    // The answer panel appears and renders the numbered sources list.
    const sources = page.locator("#plurality-ask-answer .plurality-ask-answer__sources ol > li");
    await expect(sources.nth(0)).toBeAttached({ timeout: 8000 });
    await expect(sources).toHaveCount(2);
    await expect(sources.nth(0)).toHaveAttribute("value", "1");
    await expect(sources.nth(1)).toHaveAttribute("value", "2");
    const link0 = sources.nth(0).locator("a");
    const link1 = sources.nth(1).locator("a");
    await expect(link0).toHaveAttribute("href", "https://plurality.net/v/chapters/0-0/en/");
    await expect(link0).toHaveText("Chapter 1");
    await expect(link1).toHaveAttribute("href", "https://plurality.net/v/chapters/0-1/en/");
    await expect(link1).toHaveText("Chapter 2");

    // The inline [1]/[2] superscripts still anchor to the same hrefs.
    const sups = page.locator("#plurality-ask-answer .plurality-ask-answer__body sup.cite a");
    await expect(sups).toHaveCount(2);
    await expect(sups.nth(0)).toHaveAttribute("href", "https://plurality.net/v/chapters/0-0/en/");
    await expect(sups.nth(1)).toHaveAttribute("href", "https://plurality.net/v/chapters/0-1/en/");
  });
});