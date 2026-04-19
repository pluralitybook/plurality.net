import { test, expect } from "@playwright/test";

const CASES = [
  { from: "/chapters/", to: "/read/" },
  { from: "/v/chapters/0-0/en/", to: "/read/0-0/" },
  { from: "/v/chapters/1/zh-tw/", to: "/zh/read/1/" },
  { from: "/v/chapters/2-1/jpn/", to: "/ja/read/2-1/" },
  { from: "/announcement/", to: "/" },
  { from: "/contribution/", to: "/" },
];

test.describe("legacy URL redirects (meta refresh)", () => {
  for (const { from, to } of CASES) {
    test(`${from} → ${to}`, async ({ request }) => {
      // Fetch the HTML directly instead of using page navigation — meta refresh would
      // cause the browser to follow the redirect before we can inspect the markup.
      const res = await request.get(from);
      expect(res.ok()).toBe(true);
      const body = await res.text();
      expect(body).toMatch(/<meta http-equiv="refresh"/i);
      expect(body).toContain(`url=${to}`);
    });
  }
});
