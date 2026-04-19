import { test, expect, describe } from "bun:test";
import {
  collectValidChapterIds,
  syncTranslations,
  makeGithubListFiles,
  MIN_FILE_SIZE,
  type Chapters,
  type Translations,
} from "../../scripts/lib/sync-core";

const chapters: Chapters = {
  sections: [
    { chapters: [{ id: "1" }, { id: "2-0" }, { id: "2-1" }] },
    { chapters: [{ id: "3-0" }] },
  ],
};

describe("collectValidChapterIds", () => {
  test("flattens ids across sections", () => {
    const ids = collectValidChapterIds(chapters);
    expect([...ids].sort()).toEqual(["1", "2-0", "2-1", "3-0"]);
  });
});

describe("syncTranslations", () => {
  const baseTrans = (): Translations => ({
    en: { dir: "english" },
    de: {
      dir: "deutsch",
      githubBase: "https://raw.githubusercontent.com/a/b/main/contents/",
      files: {},
    },
    fr: {
      dir: "french",
      githubBase: "not-a-raw-url",
      files: {},
    },
    es: {
      // no githubBase — should be skipped
      dir: "spanish",
      files: {},
    },
  });

  test("skips English", async () => {
    const translations = baseTrans();
    const listFiles = async () => [];
    const res = await syncTranslations({ translations, chapters, listFiles });
    expect(res.added.en).toBeUndefined();
  });

  test("adds new chapters when upstream has matching files", async () => {
    const translations = baseTrans();
    const listFiles = async () => [
      { name: "01 Vorwort.md", size: 200 },
      { name: "02-00 Einleitung.md", size: 400 },
      { name: "README.md", size: 500 },
      { name: "stub.md", size: 2 },
    ];
    const log: string[] = [];
    const res = await syncTranslations({
      translations,
      chapters,
      listFiles,
      logger: { log: (m) => log.push(m), error: () => {} },
    });
    expect(res.total).toBe(2);
    expect(res.added.de).toEqual(["1", "2-0"]);
    expect(translations.de.files?.["1"].title).toBe("Vorwort");
    expect(translations.de.files?.["2-0"].title).toBe("Einleitung");
  });

  test("does not double-add files already mapped", async () => {
    const translations = baseTrans();
    translations.de.files = { "1": { file: "01 Vorwort", title: "Vorwort" } };
    const listFiles = async () => [{ name: "01 Vorwort.md", size: 300 }];
    const res = await syncTranslations({ translations, chapters, listFiles });
    expect(res.total).toBe(0);
  });

  test("ignores chapters not declared in chapters.json", async () => {
    const translations = baseTrans();
    const listFiles = async () => [
      { name: "99 Future.md", size: 500 },
    ];
    const res = await syncTranslations({ translations, chapters, listFiles });
    expect(res.total).toBe(0);
  });

  test("skips stub files smaller than MIN_FILE_SIZE", async () => {
    expect(MIN_FILE_SIZE).toBeGreaterThan(0);
    const translations = baseTrans();
    const listFiles = async () => [{ name: "01 Vorwort.md", size: 1 }];
    const res = await syncTranslations({ translations, chapters, listFiles });
    expect(res.total).toBe(0);
  });

  test("logs an error for malformed githubBase and continues", async () => {
    const translations = baseTrans();
    const errors: string[] = [];
    const listFiles = async () => [{ name: "01 T.md", size: 200 }];
    const res = await syncTranslations({
      translations,
      chapters,
      listFiles,
      logger: { log: () => {}, error: (m) => errors.push(m) },
    });
    expect(errors.find((e) => e.includes("fr"))).toBeDefined();
    expect(res.added.de).toBeDefined();
  });

  test("handles an empty listFiles result with 'no files' log line", async () => {
    const translations = baseTrans();
    const log: string[] = [];
    const res = await syncTranslations({
      translations,
      chapters,
      listFiles: async () => [],
      logger: { log: (m) => log.push(m), error: () => {} },
    });
    expect(res.total).toBe(0);
    expect(log.some((l) => l.includes("No files found"))).toBe(true);
  });

  test("initializes files object when missing", async () => {
    const translations: Translations = {
      de: {
        dir: "deutsch",
        githubBase: "https://raw.githubusercontent.com/a/b/main/contents/",
      } as any,
    };
    const res = await syncTranslations({
      translations,
      chapters,
      listFiles: async () => [{ name: "01 Vorwort.md", size: 200 }],
    });
    expect(res.total).toBe(1);
    expect(translations.de.files?.["1"]).toBeDefined();
  });
});

describe("makeGithubListFiles", () => {
  test("returns [] when the API responds non-ok", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("err", { status: 404 })) as typeof fetch;
    try {
      const list = makeGithubListFiles("");
      const result = await list("a", "b", "c");
      expect(result).toEqual([]);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test("returns [] when the API returns a non-array body", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ message: "nope" }), { status: 200 })) as typeof fetch;
    try {
      const list = makeGithubListFiles("");
      expect(await list("a", "b", "c")).toEqual([]);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test("maps API response to {name,size} for files only", async () => {
    const origFetch = globalThis.fetch;
    const recordedHeaders: Record<string, string>[] = [];
    globalThis.fetch = (async (_url: any, init: any) => {
      recordedHeaders.push(init?.headers ?? {});
      return new Response(
        JSON.stringify([
          { type: "file", name: "01 T.md", size: 200 },
          { type: "dir", name: "nested", size: 0 },
        ]),
        { status: 200 }
      );
    }) as typeof fetch;
    try {
      const list = makeGithubListFiles("SECRET");
      const out = await list("a", "b", "c d");
      expect(out).toEqual([{ name: "01 T.md", size: 200 }]);
      expect(recordedHeaders[0]).toMatchObject({
        Authorization: "Bearer SECRET",
      });
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test("does not include Authorization header when no token", async () => {
    const origFetch = globalThis.fetch;
    let seenHeaders: any = null;
    globalThis.fetch = (async (_url: any, init: any) => {
      seenHeaders = init.headers;
      return new Response(JSON.stringify([]), { status: 200 });
    }) as typeof fetch;
    try {
      const list = makeGithubListFiles("");
      await list("a", "b", "c");
      expect(seenHeaders.Authorization).toBeUndefined();
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
