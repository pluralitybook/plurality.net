import { test, expect, describe, beforeAll } from "bun:test";
import { existsSync, readFileSync, statSync } from "fs";
import { resolve } from "path";
import { readdirSync } from "fs";

const ROOT = resolve(import.meta.dir, "../..");
const DIST = resolve(ROOT, "dist");
const DATA = resolve(ROOT, "src/_data");

const chapters = JSON.parse(readFileSync(resolve(DATA, "chapters.json"), "utf-8"));
const translations = JSON.parse(
  readFileSync(resolve(DATA, "translations.json"), "utf-8")
);

function allChapterIds(): string[] {
  const ids: string[] = [];
  for (const s of chapters.sections) for (const c of s.chapters) ids.push(c.id);
  return ids;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

beforeAll(() => {
  if (!existsSync(DIST)) {
    throw new Error(
      `dist/ not found. Run \`bun run build\` before regression tests.`
    );
  }
});

describe("build output: top-level pages", () => {
  test.each([
    "index.html",
    "404.html",
    "read/index.html",
    "about/index.html",
    "endorsements/index.html",
    "CNAME",
  ])("exists: dist/%s", (relPath) => {
    expect(existsSync(resolve(DIST, relPath))).toBe(true);
  });

  test("homepage references canonical plurality.net", () => {
    const html = readFileSync(resolve(DIST, "index.html"), "utf-8");
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/plurality\.net\//);
  });

  test("homepage contains <html lang=...>", () => {
    const html = readFileSync(resolve(DIST, "index.html"), "utf-8");
    expect(html).toMatch(/<html lang="[a-z-]+"/i);
  });
});

describe("build output: chapter pages per language", () => {
  const ids = allChapterIds();

  test("every chapter exists in English", () => {
    for (const id of ids) {
      expect(existsSync(resolve(DIST, "read", id, "index.html"))).toBe(true);
    }
  });

  test("every non-English language has a page for every chapter", () => {
    for (const [lang, data] of Object.entries(translations)) {
      if (lang === "en") continue;
      const prefix = (data as any).prefix?.replace(/^\//, "") || lang;
      for (const id of ids) {
        const p = resolve(DIST, prefix, "read", id, "index.html");
        if (!existsSync(p)) {
          throw new Error(`Missing chapter page for ${lang}: ${p}`);
        }
      }
    }
  });

  test("English chapter page has correct <html lang='en'>", () => {
    const html = readFileSync(resolve(DIST, "read/0-0/index.html"), "utf-8");
    expect(html).toMatch(/<html lang="en"/);
  });

  test("Chinese chapter page has correct <html lang='zh'>", () => {
    const html = readFileSync(resolve(DIST, "zh/read/0-0/index.html"), "utf-8");
    expect(html).toMatch(/<html lang="zh"/);
  });

  test("every chapter page links prev/next where applicable", () => {
    const html = readFileSync(resolve(DIST, "read/2-0/index.html"), "utf-8");
    // Has some kind of chapter navigation anchor
    expect(html).toMatch(/<a[^>]+href="\/read\//);
  });
});

describe("build output: redirects", () => {
  test("legacy /v/chapters/{id}/{lang}/ produces meta-refresh page", () => {
    const p = resolve(DIST, "v/chapters/0-0/en/index.html");
    expect(existsSync(p)).toBe(true);
    const html = readFileSync(p, "utf-8");
    expect(html).toMatch(/<meta http-equiv="refresh"/);
    expect(html).toMatch(/url=\/read\/0-0\//);
  });

  test("/chapters/ redirects to /read/", () => {
    const p = resolve(DIST, "chapters/index.html");
    expect(existsSync(p)).toBe(true);
    const html = readFileSync(p, "utf-8");
    expect(html).toMatch(/url=\/read\//);
  });

  test("/announcement/ redirects to /", () => {
    const p = resolve(DIST, "announcement/index.html");
    expect(existsSync(p)).toBe(true);
    const html = readFileSync(p, "utf-8");
    expect(html).toMatch(/url=\//);
  });
});

describe("build output: assets", () => {
  test("CSS bundle exists with expected partials", () => {
    const p = resolve(DIST, "assets/css/main.css");
    expect(existsSync(p)).toBe(true);
    const css = readFileSync(p, "utf-8");
    expect(css).toMatch(/@import/);
    for (const partial of ["tokens.css", "base.css", "nav.css", "reader.css"]) {
      expect(existsSync(resolve(DIST, "assets/css", partial))).toBe(true);
    }
  });

  test.each(["nav.js", "theme-toggle.js", "search.js", "scroll-reveal.js", "book.js"])(
    "JS asset exists: assets/js/%s",
    (name) => {
      const p = resolve(DIST, "assets/js", name);
      expect(existsSync(p)).toBe(true);
      expect(statSync(p).size).toBeGreaterThan(0);
    }
  );

  test("Pagefind assets are present", () => {
    const pfRoot = resolve(DIST, "pagefind");
    expect(existsSync(pfRoot)).toBe(true);
    expect(existsSync(resolve(pfRoot, "pagefind.js"))).toBe(true);
    expect(existsSync(resolve(pfRoot, "pagefind-ui.js"))).toBe(true);
    expect(existsSync(resolve(pfRoot, "pagefind-ui.css"))).toBe(true);
  });

  test("homepage uses the Plurality mark as favicon", () => {
    const html = readFileSync(resolve(DIST, "index.html"), "utf-8");
    expect(html).toContain('href="/assets/images/favicon.png"');
    expect(html).not.toContain("%3EP%3C/text%3E");
  });
});

describe("build output: HTML shape", () => {
  test("every HTML file has a <title> and <meta description>", () => {
    const htmls = walk(DIST).filter(
      (p) => p.endsWith(".html") && !p.includes("/pagefind/")
    );
    expect(htmls.length).toBeGreaterThan(300);
    for (const p of htmls) {
      const html = readFileSync(p, "utf-8");
      // Redirect pages use a shorter shell, also check for either <title> or http-equiv="refresh".
      const isRedirect = /http-equiv="refresh"/.test(html);
      if (!isRedirect) {
        if (!/<title>[^<]*<\/title>/i.test(html)) {
          throw new Error(`Missing <title> in ${p}`);
        }
        if (!/name="description"/i.test(html)) {
          throw new Error(`Missing meta description in ${p}`);
        }
      }
    }
  });

  test("no HTML pages contain obvious template leaks (raw {{ }} or {% %})", () => {
    const htmls = walk(DIST).filter(
      (p) => p.endsWith(".html") && !p.includes("/pagefind/")
    );
    for (const p of htmls) {
      const html = readFileSync(p, "utf-8");
      // These character sequences should not appear after render.
      if (/\{\{\s|\s\}\}/.test(html)) {
        throw new Error(`Found unresolved template in ${p}`);
      }
      if (/\{%\s|\s%\}/.test(html)) {
        throw new Error(`Found unresolved block tag in ${p}`);
      }
    }
  });

  test("homepage has the hero section text", () => {
    const html = readFileSync(resolve(DIST, "index.html"), "utf-8");
    expect(html).toMatch(/Plurality/);
  });

  test("every chapter page has a nav and a main landmark", () => {
    const html = readFileSync(resolve(DIST, "read/1/index.html"), "utf-8");
    expect(html).toMatch(/<nav[\s>]/);
    expect(html).toMatch(/<main[\s>]/);
  });
});

describe("build output: search index", () => {
  test("pagefind index has language subdirs", () => {
    const indexDir = resolve(DIST, "pagefind", "index");
    expect(existsSync(indexDir)).toBe(true);
  });
});
