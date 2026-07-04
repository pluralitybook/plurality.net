import { test, expect, describe } from "bun:test";
import {
  chapterFetchUrl,
  chapterPageUrl,
  sectionLabel,
  buildChapterEntry,
  buildLangEntries,
  buildSearchIndex,
  buildCreditsChapterEntry,
} from "../../src/lib/search-builder.ts";
import { splitByBlockquotes } from "../../src/lib/markdown.ts";

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
  test("builds English from chapter.file when translations.en.files is empty", async () => {
    const enData = {
      dir: "english",
      prefix: "",
      githubBase: "https://example.com/contents/",
      files: {},
    };
    const entry = await buildChapterEntry({
      lang: "en",
      langData: enData,
      langI18n: {},
      section: { title: "Preface", chapters: [] },
      chapter: { id: "1", number: "1", title: "Seeing Plural", file: "1-preface" },
      fetcher: async () => "## Intro\n\nbody",
    });
    expect(entry).not.toBeNull();
    expect(entry!.url).toBe("/read/1/");
    expect(entry!.subsections.length).toBeGreaterThan(0);
  });


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

describe("buildChapterEntry (0-0 endorsements)", () => {
  test("routes 0-0 chapters through splitByBlockquotes", async () => {
    const en00 = {
      dir: "english",
      prefix: "",
      githubBase: "https://example.com/contents/",
      files: {},
    };
    const raw = `# Endorsements\n\n> quote one<br></br>\n> — Richard Garfield, creator of Magic`;
    const entry = await buildChapterEntry({
      lang: "en",
      langData: en00,
      langI18n: {},
      section: { title: "Before You Read", chapters: [] },
      chapter: { id: "0-0", number: "0-0", title: "Endorsements", file: "0-0-endorsements" },
      fetcher: async () => raw,
    });
    expect(entry).not.toBeNull();
    expect(entry!.url).toBe("/read/0-0/");
    expect(entry!.subsections.some((s) => s.content.includes("Richard Garfield"))).toBe(true);
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
      credits: { i18n: {}, categories: [] },
      fetcher: async () => "# t\n\n## H\n\nbody",
    });
    expect(Object.keys(result)).toEqual(["th"]);
    expect(result.th).toHaveLength(1);
  });
});

describe("buildCreditsChapterEntry", () => {
  test("includes contributor names for /read/0-3/", () => {
    const credits = {
      i18n: { en: { intro: "Intro.", categories: { Writing: "Writing" } } },
      categories: [
        { name: "Writing", contributors: [{ name: "Tenzin Yangtso", pt: 1 }] },
      ],
    };
    const chapters = {
      sections: [
        { title: "Preface", chapters: [{ id: "1", number: "1", title: "Preface", file: "y" }] },
        {
          title: "Before You Read",
          chapters: [{ id: "0-3", number: "0-3", title: "Credits", file: "x" }],
        },
      ],
    };
    const entry = buildCreditsChapterEntry("en", { prefix: "" }, credits, chapters);
    expect(entry?.url).toBe("/read/0-3/");
    expect(entry?.subsections[0].content).toContain("Tenzin Yangtso");
  });

  test("uses localized credits title override", () => {
    const credits = {
      i18n: { ja: { intro: "Intro.", categories: { Writing: "Writing" } } },
      categories: [
        { name: "Writing", contributors: [{ name: "Contributor", pt: 1 }] },
      ],
    };
    const chapters = {
      sections: [
        {
          title: "Before You Read",
          chapters: [{ id: "0-3", number: "0-3", title: "Credits", file: "x" }],
        },
      ],
    };
    const entry = buildCreditsChapterEntry("ja", { prefix: "/ja", files: { "0-3": { file: "credits", title: "クレジット" } } }, credits, chapters);
    expect(entry?.title).toBe("クレジット");
  });
});

describe("splitByBlockquotes", () => {
  test("splits endorsement quotes including Garfield", () => {
    const raw = `> quote one<br></br>\n> — Richard Garfield, creator of Magic`;
    const subs = splitByBlockquotes(raw);
    expect(subs.some((s) => s.content.includes("Richard Garfield"))).toBe(true);
  });
});
