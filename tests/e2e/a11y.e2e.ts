import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = [
  { url: "/", name: "home" },
  { url: "/read/", name: "reading index" },
  { url: "/read/1/", name: "chapter 1" },
  { url: "/about/", name: "about" },
  { url: "/endorsements/", name: "endorsements" },
  { url: "/zh/", name: "zh home" },
];

test.describe("accessibility (axe-core)", () => {
  for (const { url, name } of PAGES) {
    test(`${name} has no serious or critical a11y violations`, async ({ page }) => {
      await page.goto(url);
      await page.waitForLoadState("domcontentloaded");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .disableRules([
          "color-contrast", // design-level choice, tested manually
          "region", // pagefind injects content outside our landmarks
        ])
        .analyze();
      const serious = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical"
      );
      if (serious.length) {
        console.log(
          "a11y violations on " + url + ":\n",
          serious.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }))
        );
      }
      expect(serious).toEqual([]);
    });
  }
});
