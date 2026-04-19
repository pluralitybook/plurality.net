import { test, expect, describe } from "bun:test";
import {
  chapterFetchUrl,
  chapterPageUrl,
  sectionLabel,
  buildChapterEntry,
  buildLangEntries,
  buildSearchIndex,
} from "../../src/_data/lib/search-builder.js";

const langData = {
  dir: "thai",
  prefix: "/th",
  githubBase: "https://raw.githubusercontent.com/chusanap/plurality-thai/main/contents/",
  files: {
    "1": { file: "01 Foreword", title: "คำนำ" },
  },
};

const chapters = {
  sections: [
    {
      id: "preface",
      title: "Preface",
      chapters: [{ id: "1", number: "1", title: "Preface" }],
    },
  ],
};

describe("chapterFetchUrl", () => {
  test("uses langData.githubBase when present", () => {
    expect(chapterFetchUrl(langData, "01 Foreword")).toBe(
      "https://raw.githubusercontent.com/chusanap/plurality-thai/main/contents/thai/01%20Foreword.md"
    );
  });

  test("falls back to the default English base when no githubBase is provided", () => {
    const no: any = { dir: "english" };
    expect(chapterFetchUrl(no, "1-preface")).toMatch(
      /^https:\/\/raw\.githubusercontent\.com\/pluralitybook\/plurality\/main\/contents\/english\//
    );
  });
});

describe("chapterPageUrl", () => {
  test("prepends prefix and /read/{id}/", () => {
    expect(chapterPageUrl(langData, "2-1")).toBe("/th/read/2-1/");
  });
});

describe("sectionLabel", () => {
  test("uses i18n translation when available", () => {
    const i18n = { sections: { Preface: "คำนำ" } };
    expect(sectionLabel(i18n, "Preface", "1")).toBe("คำนำ · 1");
  });
  test("falls back to English name when no i18n", () => {
    expect(sectionLabel({}, "Preface", "1")).toBe("Preface · 1");
    expect(sectionLabel(undefined as any, "Preface", "1")).toBe("Preface · 1");
  });
});

describe("buildChapterEntry", () => {
  const section = { id: "preface", title: "Preface" };
  const chapter = { id: "1", number: "1", title: "Preface" };

  test("returns null for chapters without a translation", async () => {
    const noFile = { ...langData, files: {} };
    const entry = await buildChapterEntry({
      lang: "th",
      langData: noFile,
      langI18n: {},
      section,
      chapter,
      fetcher: async () => "# t\n\nbody",
    });
    expect(entry).toBeNull();
  });

  test("returns null when the fetcher throws", async () => {
    const entry = await buildChapterEntry({
      lang: "th",
      langData,
      langI18n: {},
      section,
      chapter,
      fetcher: async () => {
        throw new Error("offline");
      },
    });
    expect(entry).toBeNull();
  });

  test("builds an entry with subsections from headings", async () => {
    const markdown = `# Title

## First

para one

## Second

para two`;
    const entry = await buildChapterEntry({
      lang: "th",
      langData,
      langI18n: { sections: { Preface: "คำนำ" } },
      section,
      chapter,
      fetcher: async () => markdown,
    });
    expect(entry).toMatchObject({
      title: "คำนำ",
      section: "คำนำ · 1",
      url: "/th/read/1/",
    });
    expect(entry?.subsections.length).toBeGreaterThanOrEqual(2);
  });
});

describe("buildLangEntries", () => {
  test("returns [] when langData has no files", async () => {
    const out = await buildLangEntries({
      lang: "xx",
      langData: { dir: "xx" } as any,
      langI18n: {},
      chapters,
      fetcher: async () => "",
    });
    expect(out).toEqual([]);
  });

  test("returns [] for undefined langData", async () => {
    const out = await buildLangEntries({
      lang: "xx",
      langData: undefined as any,
      langI18n: {},
      chapters,
      fetcher: async () => "",
    });
    expect(out).toEqual([]);
  });

  test("produces one entry per translatable chapter", async () => {
    const out = await buildLangEntries({
      lang: "th",
      langData,
      langI18n: {},
      chapters,
      fetcher: async () => "# t\n\n## Head\n\nbody",
    });
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe("/th/read/1/");
  });
});

describe("buildSearchIndex", () => {
  test("aggregates results across target languages", async () => {
    const result = await buildSearchIndex({
      targetLangs: ["th"],
      translations: { th: langData } as any,
      i18n: {},
      chapters,
      fetcher: async () => "# t\n\n## H\n\nbody",
    });
    expect(Object.keys(result)).toEqual(["th"]);
    expect(result.th).toHaveLength(1);
  });
});
