import { test, expect, describe } from "bun:test";
import searchIndex from "../../src/_data/searchIndex.js";

describe("searchIndex default export", () => {
  test("returns one array per target language", async () => {
    const translations = {
      en: { dir: "english" },
      xx: {
        dir: "xx",
        prefix: "/xx",
        githubBase: "https://raw.githubusercontent.com/a/b/main/contents/",
        files: { "1": { file: "01 Foo", title: "Foo" } },
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
    const i18n = { xx: { sections: {} } };

    const result = await searchIndex({
      targetLangs: ["xx"],
      chapters,
      translations,
      i18n,
      fetcher: async () => "## H\n\npara\n",
    });

    expect(Object.keys(result)).toEqual(["xx"]);
    expect(result.xx).toHaveLength(1);
    expect(result.xx[0].url).toBe("/xx/read/1/");
  });

  test("loads the baked-in defaults when called with no args", async () => {
    // This exercises the loadJson + defaultFetcher wiring. The fetcher will
    // try to hit GitHub for content; we stub via a quick replacement of the
    // default fetcher by passing our own.
    const result = await searchIndex({ fetcher: async () => "" });
    expect(typeof result).toBe("object");
    for (const lang of Object.keys(result)) {
      expect(Array.isArray(result[lang])).toBe(true);
    }
  });

  test("default fetcher executes the EleventyFetch wiring", async () => {
    // No fetcher override — the module's defaultFetcher runs. We point it at
    // a dead localhost so the request fails fast; buildChapterEntry catches
    // the rejection and returns null, yielding an empty list.
    const result = await searchIndex({
      targetLangs: ["xx"],
      translations: {
        xx: {
          dir: "xx",
          prefix: "/xx",
          githubBase: "http://127.0.0.1:1/",
          files: { "1": { file: "x", title: "t" } },
        },
      } as any,
      chapters: {
        sections: [
          {
            id: "x",
            title: "X",
            chapters: [{ id: "1", number: "1", title: "X" }],
          },
        ],
      } as any,
      i18n: {} as any,
    });
    expect(result.xx).toEqual([]);
  });
});
