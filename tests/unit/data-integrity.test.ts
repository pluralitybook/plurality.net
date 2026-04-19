import { test, expect, describe } from "bun:test";
import { readFileSync } from "fs";
import { resolve } from "path";

const DATA = resolve(import.meta.dir, "../../src/_data");

function load<T = any>(name: string): T {
  return JSON.parse(readFileSync(resolve(DATA, name), "utf-8"));
}

const chapters = load<{ sections: any[] }>("chapters.json");
const translations = load<Record<string, any>>("translations.json");
const i18n = load<Record<string, any>>("i18n.json");
const endorsements = load<Record<string, any>>("endorsements.json");
const downloads = load<Record<string, any>>("downloads.json");
const languages = load<any[]>("languages.json");
const homeLangs = load<any>("homeLangs.json");
const site = load<any>("site.json");
const credits = load<any>("credits.json");

function allChapterIds(): string[] {
  const ids: string[] = [];
  for (const s of chapters.sections) for (const c of s.chapters) ids.push(c.id);
  return ids;
}

describe("chapters.json", () => {
  test("has at least one section", () => {
    expect(chapters.sections.length).toBeGreaterThan(0);
  });

  test("every section has id, title, color and chapters[]", () => {
    for (const s of chapters.sections) {
      expect(typeof s.id).toBe("string");
      expect(typeof s.title).toBe("string");
      expect(typeof s.color).toBe("string");
      expect(Array.isArray(s.chapters)).toBe(true);
      expect(s.chapters.length).toBeGreaterThan(0);
    }
  });

  test("every chapter has id, number, title, file and matching ID format", () => {
    for (const s of chapters.sections) {
      for (const c of s.chapters) {
        expect(typeof c.id).toBe("string");
        expect(c.id).toMatch(/^\d+(-\d+)?$/);
        expect(typeof c.number).toBe("string");
        expect(typeof c.title).toBe("string");
        expect(typeof c.file).toBe("string");
        expect(c.file.length).toBeGreaterThan(0);
      }
    }
  });

  test("chapter IDs are globally unique", () => {
    const ids = allChapterIds();
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("translations.json", () => {
  const ids = new Set(allChapterIds());

  test("en exists and is local-only", () => {
    expect(translations.en).toBeDefined();
    expect(translations.en.dir).toBe("english");
  });

  test("every non-en language has dir, label, and a parseable githubBase", () => {
    for (const [lang, data] of Object.entries(translations)) {
      if (lang === "en") continue;
      expect(typeof (data as any).dir).toBe("string");
      expect(typeof (data as any).label).toBe("string");
      expect((data as any).githubBase).toMatch(
        /^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\//
      );
    }
  });

  test("every file mapping points to a known chapter ID", () => {
    for (const [lang, data] of Object.entries(translations)) {
      for (const id of Object.keys((data as any).files || {})) {
        if (!ids.has(id)) {
          throw new Error(`translations[${lang}].files has unknown chapter id: ${id}`);
        }
      }
    }
  });

  test("every language with a prefix uses leading-slash form", () => {
    for (const [lang, data] of Object.entries(translations)) {
      const prefix = (data as any).prefix ?? "";
      if (prefix) expect(prefix.startsWith("/")).toBe(true);
    }
  });
});

describe("i18n.json", () => {
  const REQUIRED_KEYS = [
    "lang_name",
    "subtitle",
    "authors",
    "nav_read",
    "nav_about",
    "start_reading",
    "cc0_notice",
    "prev_chapter",
    "next_chapter",
  ];

  test("has an entry for every language declared in translations.json", () => {
    for (const lang of Object.keys(translations)) {
      expect(i18n[lang]).toBeDefined();
    }
  });

  test("every language entry has the baseline set of keys", () => {
    for (const [lang, data] of Object.entries(i18n)) {
      for (const key of REQUIRED_KEYS) {
        if (data[key] === undefined) {
          throw new Error(`i18n[${lang}] missing required key: ${key}`);
        }
      }
    }
  });
});

describe("endorsements.json", () => {
  test("every entry is an array of {author, quote}", () => {
    for (const [lang, items] of Object.entries(endorsements)) {
      expect(Array.isArray(items)).toBe(true);
      for (const it of items as any[]) {
        expect(typeof it.author).toBe("string");
        expect(typeof it.quote).toBe("string");
      }
    }
  });
});

describe("downloads.json", () => {
  test("keys are a subset of translations", () => {
    for (const lang of Object.keys(downloads)) {
      expect(translations[lang]).toBeDefined();
    }
  });

  test("every URL is absolute https", () => {
    function walk(node: any) {
      if (!node) return;
      if (typeof node === "string") {
        if (node.startsWith("http")) expect(node).toMatch(/^https:\/\//);
      } else if (Array.isArray(node)) {
        node.forEach(walk);
      } else if (typeof node === "object") {
        for (const v of Object.values(node)) walk(v);
      }
    }
    walk(downloads);
  });
});

describe("languages.json", () => {
  test("is a non-empty array with required fields", () => {
    expect(Array.isArray(languages)).toBe(true);
    expect(languages.length).toBeGreaterThan(0);
    for (const l of languages) {
      expect(typeof l.code).toBe("string");
      expect(typeof l.iso).toBe("string");
      expect(typeof l.name).toBe("string");
      expect(["ltr", "rtl"]).toContain(l.dir);
    }
  });

  test("codes are unique", () => {
    const codes = languages.map((l: any) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  test("every translations.json key is represented", () => {
    const codes = new Set(languages.map((l: any) => l.code));
    for (const lang of Object.keys(translations)) {
      expect(codes.has(lang)).toBe(true);
    }
  });
});

describe("homeLangs.json & site.json", () => {
  test("homeLangs entries are known translation codes", () => {
    const known = new Set(Object.keys(translations));
    const values = Array.isArray(homeLangs) ? homeLangs : Object.keys(homeLangs);
    for (const code of values) {
      expect(known.has(code)).toBe(true);
    }
  });

  test("site.url is https", () => {
    expect(site.url).toMatch(/^https:\/\//);
  });
});

describe("credits.json", () => {
  test("categories present with contributors arrays", () => {
    expect(Array.isArray(credits.categories)).toBe(true);
    for (const cat of credits.categories) {
      expect(typeof cat.name).toBe("string");
      expect(Array.isArray(cat.contributors)).toBe(true);
    }
  });
});
