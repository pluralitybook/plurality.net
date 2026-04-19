import { test, expect, describe } from "bun:test";
import { parseIndexMarkdown } from "../../src/_data/lib/book-index-parser.js";

describe("parseIndexMarkdown", () => {
  test("returns [] for empty input", () => {
    expect(parseIndexMarkdown("")).toEqual([]);
  });

  test("ignores prose outside code fences", () => {
    expect(parseIndexMarkdown("# Index\n\nsome prose")).toEqual([]);
  });

  test("extracts terms from a single code fence", () => {
    const md =
      "# Index\n\n```\nAlice\t12\nBob\t34\n```\n";
    expect(parseIndexMarkdown(md)).toEqual(["Alice", "Bob"]);
  });

  test("extracts terms across multiple code fences", () => {
    const md =
      "Preface\n\n```\nAlice\t1\n```\n\nMore\n\n```\nBob\t9\nCarol\t10\n```\n";
    expect(parseIndexMarkdown(md)).toEqual(["Alice", "Bob", "Carol"]);
  });

  test("skips lines without a tab", () => {
    const md = "```\nno-tab-line\nAlice\t12\n\nBob\t34\n```\n";
    expect(parseIndexMarkdown(md)).toEqual(["Alice", "Bob"]);
  });

  test("skips lines where the term before the tab is empty/whitespace", () => {
    const md = "```\n \t99\nAlice\t1\n```\n";
    expect(parseIndexMarkdown(md)).toEqual(["Alice"]);
  });

  test("accepts non-string input via String()", () => {
    expect(parseIndexMarkdown(undefined as any)).toEqual([]);
  });
});
