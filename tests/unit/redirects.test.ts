import { test, expect, describe, beforeAll } from "bun:test";
import { readFileSync } from "fs";
import { resolve } from "path";
import redirectsFn from "../../src/_data/redirects.js";

const DATA = resolve(import.meta.dir, "../../src/_data");
const chapters = JSON.parse(readFileSync(resolve(DATA, "chapters.json"), "utf-8"));

let redirects: any[];
let totalChapters: number;

beforeAll(() => {
  redirects = redirectsFn();
  totalChapters = chapters.sections.reduce(
    (n: number, s: any) => n + s.chapters.length,
    0
  );
});

describe("redirects", () => {
  test("generates a row for every (legacy-lang × chapter) plus static pages", () => {
    const langMapCount = 7; // eng, zh-tw, jpn, tha, gre, en, de
    const staticPages = 3; // chapters, announcement, contribution
    expect(redirects.length).toBe(totalChapters * langMapCount + staticPages);
  });

  test("every entry has a 'from' starting with / and a 'to' starting with /", () => {
    for (const r of redirects) {
      expect(r.from).toMatch(/^\//);
      expect(r.to).toMatch(/^\//);
    }
  });

  test("no duplicate 'from' paths", () => {
    const froms = redirects.map((r) => r.from);
    expect(new Set(froms).size).toBe(froms.length);
  });

  test("chapter redirects point to /read/{id}/ with correct prefix", () => {
    const chapterRows = redirects.filter((r) =>
      r.from.startsWith("/v/chapters/")
    );
    for (const r of chapterRows) {
      expect(r.to).toMatch(/^(\/(zh|ja|th|el|de))?\/read\/[^/]+\/$/);
    }
  });

  test("static aliases are mapped", () => {
    const map = Object.fromEntries(redirects.map((r) => [r.from, r.to]));
    expect(map["/chapters/"]).toBe("/read/");
    expect(map["/announcement/"]).toBe("/");
    expect(map["/contribution/"]).toBe("/");
  });
});
