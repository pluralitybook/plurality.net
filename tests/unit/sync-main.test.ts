import { test, expect, describe } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  main,
  TRANSLATIONS_PATH,
  CHAPTERS_PATH,
} from "../../scripts/sync-translations";

describe("sync-translations main", () => {
  test("constants point into src/_data", () => {
    expect(TRANSLATIONS_PATH).toContain("src/_data/translations.json");
    expect(CHAPTERS_PATH).toContain("src/_data/chapters.json");
  });

  test("runs end-to-end in a tempdir and writes only when changed", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sync-"));
    const translationsPath = join(dir, "translations.json");
    const chaptersPath = join(dir, "chapters.json");

    writeFileSync(
      translationsPath,
      JSON.stringify({
        en: { dir: "english" },
        de: {
          dir: "deutsch",
          githubBase:
            "https://raw.githubusercontent.com/a/b/main/contents/",
          files: {},
        },
      })
    );
    writeFileSync(
      chaptersPath,
      JSON.stringify({ sections: [{ chapters: [{ id: "1" }] }] })
    );

    const log: string[] = [];
    const total = await main({
      translationsPath,
      chaptersPath,
      dryRun: false,
      listFiles: async () => [{ name: "01 Vorwort.md", size: 500 }],
      logger: { log: (m) => log.push(m), error: () => {} },
    });

    expect(total).toBe(1);
    const written = JSON.parse(readFileSync(translationsPath, "utf-8"));
    expect(written.de.files["1"]).toEqual({ file: "01 Vorwort", title: "Vorwort" });
    expect(log.some((l) => l.includes("Updated translations.json"))).toBe(true);
  });

  test("dry-run does not write the file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sync-dry-"));
    const translationsPath = join(dir, "translations.json");
    const chaptersPath = join(dir, "chapters.json");

    writeFileSync(
      translationsPath,
      JSON.stringify({
        de: {
          dir: "deutsch",
          githubBase:
            "https://raw.githubusercontent.com/a/b/main/contents/",
          files: {},
        },
      })
    );
    writeFileSync(
      chaptersPath,
      JSON.stringify({ sections: [{ chapters: [{ id: "1" }] }] })
    );

    const before = readFileSync(translationsPath, "utf-8");
    const log: string[] = [];
    const total = await main({
      translationsPath,
      chaptersPath,
      dryRun: true,
      listFiles: async () => [{ name: "01 Vorwort.md", size: 500 }],
      logger: { log: (m) => log.push(m), error: () => {} },
    });

    expect(total).toBe(1);
    expect(readFileSync(translationsPath, "utf-8")).toBe(before);
    expect(log.some((l) => l.includes("Dry run"))).toBe(true);
  });

  test("uses default logger (console) and default listFiles when omitted", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sync-defaults-"));
    const translationsPath = join(dir, "translations.json");
    const chaptersPath = join(dir, "chapters.json");

    writeFileSync(
      translationsPath,
      JSON.stringify({
        en: { dir: "english" },
        bad: { dir: "x", githubBase: "not-a-raw-url" },
      })
    );
    writeFileSync(
      chaptersPath,
      JSON.stringify({ sections: [{ chapters: [{ id: "1" }] }] })
    );

    const origLog = console.log;
    const origErr = console.error;
    const captured: string[] = [];
    console.log = (...args: any[]) => captured.push(args.join(" "));
    console.error = (...args: any[]) => captured.push(args.join(" "));

    try {
      // English is skipped; 'bad' has an unparseable githubBase, which fires
      // the default error logger, then the summary log runs.
      const total = await main({ translationsPath, chaptersPath });
      expect(total).toBe(0);
      expect(captured.join("\n")).toContain("Could not parse githubBase");
      expect(captured.join("\n")).toContain("up to date");
    } finally {
      console.log = origLog;
      console.error = origErr;
    }
  });

  test("logs 'up to date' when upstream has nothing new", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sync-nochange-"));
    const translationsPath = join(dir, "translations.json");
    const chaptersPath = join(dir, "chapters.json");

    writeFileSync(
      translationsPath,
      JSON.stringify({
        de: {
          dir: "deutsch",
          githubBase: "https://raw.githubusercontent.com/a/b/main/contents/",
          files: { "1": { file: "01 Vorwort", title: "Vorwort" } },
        },
      })
    );
    writeFileSync(
      chaptersPath,
      JSON.stringify({ sections: [{ chapters: [{ id: "1" }] }] })
    );

    const log: string[] = [];
    const total = await main({
      translationsPath,
      chaptersPath,
      listFiles: async () => [{ name: "01 Vorwort.md", size: 500 }],
      logger: { log: (m) => log.push(m), error: () => {} },
    });

    expect(total).toBe(0);
    expect(log.some((l) => l.includes("up to date"))).toBe(true);
  });
});
