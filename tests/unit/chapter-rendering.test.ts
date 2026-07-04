import { describe, expect, test } from "bun:test";
import credits from "../../src/data/credits.json";
import i18n from "../../src/data/i18n.json";
import translations from "../../src/data/translations.json";
import { getFlatChapters, renderChapterBody, type ChapterEntry } from "../../src/lib/book-corpus.ts";

describe("renderChapterBody", () => {
  test("renders untranslated chapter placeholder with English and contribution links", async () => {
    const chapter = getFlatChapters().find((entry) => entry.lang === "el" && entry.untranslated);
    expect(chapter).toBeDefined();
    const body = await renderChapterBody(chapter as ChapterEntry);
    expect(body).toContain(i18n.el.translation_in_progress);
    expect(body).toContain(`/read/${chapter?.id}/`);
    expect(body).toContain(translations.el.contributeUrl);
  });

  test("renders remote markdown with anchors and links", async () => {
    const chapter = getFlatChapters().find((entry) => entry.lang === "en" && entry.id === "1");
    expect(chapter).toBeDefined();
    const body = await renderChapterBody(chapter as ChapterEntry, async () => "# Title\n\n## First\n\nBody with [link](https://example.com)");
    expect(body).toContain('id="first"');
    expect(body).toContain('<a href="https://example.com">link</a>');
  });

  test("renders localized endorsements from local data", async () => {
    const chapter = getFlatChapters().find((entry) => entry.localEndorsements);
    expect(chapter).toBeDefined();
    const body = await renderChapterBody(chapter as ChapterEntry);
    expect(body).toContain("<blockquote>");
  });

  test("returns the unavailable paragraph when remote fetch fails without cache", async () => {
    const chapter = getFlatChapters().find((entry) => entry.lang === "en" && entry.id === "1");
    expect(chapter).toBeDefined();
    const body = await renderChapterBody(chapter as ChapterEntry, async () => { throw new Error("offline"); });
    expect(body).toBe('<p class="muted"><em>Content is temporarily unavailable. Please revisit this page later.</em></p>');
  });

  test("renders local credits with contributor names", async () => {
    const chapter = getFlatChapters().find((entry) => entry.lang === "en" && entry.id === "0-3");
    expect(chapter).toBeDefined();
    const body = await renderChapterBody(chapter as ChapterEntry);
    expect(body).toContain("credits__intro");
    expect(body).toContain("credits__category");
    expect(body).toContain(credits.categories[0].contributors[0].name);
  });
});
