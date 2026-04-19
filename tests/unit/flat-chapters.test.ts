import { test, expect, describe, beforeAll } from "bun:test";
import { readFileSync } from "fs";
import { resolve } from "path";
import flatChaptersFn from "../../src/_data/flatChapters.js";

const DATA = resolve(import.meta.dir, "../../src/_data");
const chapters = JSON.parse(readFileSync(resolve(DATA, "chapters.json"), "utf-8"));
const translations = JSON.parse(
  readFileSync(resolve(DATA, "translations.json"), "utf-8")
);

let flat: any[];
let totalChapters: number;

beforeAll(() => {
  flat = flatChaptersFn();
  totalChapters = chapters.sections.reduce(
    (n: number, s: any) => n + s.chapters.length,
    0
  );
});

describe("flatChapters", () => {
  test("returns one entry per (language × chapter)", () => {
    const langCount = Object.keys(translations).length;
    expect(flat.length).toBe(langCount * totalChapters);
  });

  test("every entry has required properties", () => {
    const required = [
      "id",
      "number",
      "title",
      "lang",
      "langLabel",
      "file",
      "sectionId",
      "sectionTitle",
      "url",
      "githubUrl",
      "altLangs",
    ];
    for (const entry of flat) {
      for (const k of required) {
        if (entry[k] === undefined) {
          throw new Error(`Missing ${k} on entry ${entry.lang}/${entry.id}`);
        }
      }
    }
  });

  test("URL pattern matches '{prefix}/read/{id}/'", () => {
    for (const entry of flat) {
      const prefix = translations[entry.lang].prefix || "";
      expect(entry.url).toBe(`${prefix}/read/${entry.id}/`);
    }
  });

  test("untranslated flag is true exactly when non-en chapter lacks a file mapping", () => {
    for (const entry of flat) {
      if (entry.lang === "en") {
        expect(entry.untranslated).toBe(false);
        continue;
      }
      const hasOverride = !!translations[entry.lang].files?.[entry.id];
      expect(entry.untranslated).toBe(!hasOverride);
    }
  });

  test("prev/next chain is correct within each language", () => {
    const byLang = new Map<string, any[]>();
    for (const e of flat) {
      if (!byLang.has(e.lang)) byLang.set(e.lang, []);
      byLang.get(e.lang)!.push(e);
    }
    for (const [lang, entries] of byLang) {
      expect(entries[0].prevChapter).toBeNull();
      expect(entries[entries.length - 1].nextChapter).toBeNull();
      for (let i = 1; i < entries.length; i++) {
        expect(entries[i].prevChapter?.url).toBe(entries[i - 1].url);
        expect(entries[i - 1].nextChapter?.url).toBe(entries[i].url);
      }
    }
  });

  test("altLangs lists every other language for the same chapter", () => {
    const langCount = Object.keys(translations).length;
    for (const entry of flat) {
      expect(entry.altLangs.length).toBe(langCount - 1);
      for (const a of entry.altLangs) {
        expect(a.lang).not.toBe(entry.lang);
        expect(a.url).toMatch(/\/read\/.+\/$/);
      }
    }
  });

  test("githubUrl is an https URL to raw.githubusercontent", () => {
    for (const entry of flat) {
      expect(entry.githubUrl).toMatch(/^https:\/\/raw\.githubusercontent\.com\//);
    }
  });

  test("localCredits is true only for chapter 0-3", () => {
    for (const entry of flat) {
      expect(entry.localCredits).toBe(entry.id === "0-3");
    }
  });
});
