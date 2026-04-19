import { test, expect, describe } from "bun:test";
import {
  slugify,
  stripInlineMarkdown,
  cleanFrontMatter,
  splitByHeadings,
} from "../../src/_data/lib/markdown.js";

describe("slugify", () => {
  test("lowercases and replaces spaces with dashes", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  test("trims leading/trailing whitespace", () => {
    expect(slugify("  Foo Bar  ")).toBe("foo-bar");
  });

  test("collapses runs of whitespace", () => {
    expect(slugify("Foo   Bar\t Baz")).toBe("foo-bar-baz");
  });

  test("percent-encodes non-ASCII chars", () => {
    const out = slugify("資訊技術與民主");
    expect(out).toMatch(/%[0-9A-F]{2}/);
    expect(out).not.toMatch(/\s/);
  });
});

describe("stripInlineMarkdown", () => {
  test("removes image syntax entirely", () => {
    expect(stripInlineMarkdown("before ![alt](x.png) after")).toBe("before  after");
  });

  test("keeps link text, drops URL", () => {
    expect(stripInlineMarkdown("[click](https://example.com)")).toBe("click");
  });

  test("drops footnote references", () => {
    expect(stripInlineMarkdown("Some text[^1] more.")).toBe("Some text more.");
  });

  test("strips HTML tags", () => {
    expect(stripInlineMarkdown("<em>Hi</em> <span>there</span>")).toBe("Hi there");
  });

  test("removes emphasis markers", () => {
    expect(stripInlineMarkdown("**bold** and *italic* and ___hmm___")).toBe(
      "bold and italic and hmm"
    );
  });

  test("strips fenced code blocks", () => {
    expect(stripInlineMarkdown("Prose\n```\ncode\n```\nMore")).toContain("Prose");
    expect(stripInlineMarkdown("Prose\n```\ncode\n```\nMore")).not.toContain("code");
  });

  test("strips inline code backticks but keeps content", () => {
    expect(stripInlineMarkdown("Use `bun install` now")).toBe("Use bun install now");
  });

  test("removes blockquote markers", () => {
    expect(stripInlineMarkdown("> quoted line\nnormal")).toBe("quoted line\nnormal");
  });

  test("collapses triple+ newlines to double", () => {
    expect(stripInlineMarkdown("a\n\n\n\nb")).toBe("a\n\nb");
  });
});

describe("cleanFrontMatter", () => {
  test("strips leading # Title", () => {
    expect(cleanFrontMatter("# Chapter One\n\nbody")).toBe("body");
  });

  test("strips Chinese translator metadata block", () => {
    const src =
      "# Title\n\n| 原文：Somewhere\n| 作者：Author\n| 譯者：Translator\n---\n\nbody";
    expect(cleanFrontMatter(src)).toBe("body");
  });

  test("leaves content without front matter untouched", () => {
    expect(cleanFrontMatter("Just prose here.")).toBe("Just prose here.");
  });
});

describe("splitByHeadings", () => {
  test("returns empty for empty input", () => {
    expect(splitByHeadings("")).toEqual([]);
  });

  test("groups content under each heading", () => {
    const md = `# Title

Intro paragraph.

## First Section

Para one.

## Second Section

Para two.`;
    const out = splitByHeadings(md);
    expect(out).toHaveLength(3);
    expect(out[0].heading).toBeNull();
    expect(out[0].content).toBe("Intro paragraph.");
    expect(out[1].heading).toBe("First Section");
    expect(out[1].anchor).toBe(slugify("First Section"));
    expect(out[1].content).toBe("Para one.");
    expect(out[2].heading).toBe("Second Section");
    expect(out[2].content).toBe("Para two.");
  });

  test("matches ## ### #### but not # or #####", () => {
    const md = `## A
one
### B
two
#### C
three
##### D
four`;
    const out = splitByHeadings(md);
    const headings = out.map((s) => s.heading).filter(Boolean);
    expect(headings).toEqual(["A", "B", "C"]);
  });
});
