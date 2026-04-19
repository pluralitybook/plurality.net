import { test, expect, describe } from "bun:test";
import {
  parseFilename,
  parseGithubBase,
} from "../../scripts/lib/parse-translations";

describe("parseFilename", () => {
  test("parses dashed sub-chapter with title", () => {
    expect(parseFilename("07-01 Schlussfolgerungen.md")).toEqual({
      id: "7-1",
      file: "07-01 Schlussfolgerungen",
      title: "Schlussfolgerungen",
    });
  });

  test("parses major-only chapter", () => {
    expect(parseFilename("01 Vorwort.md")).toEqual({
      id: "1",
      file: "01 Vorwort",
      title: "Vorwort",
    });
  });

  test("handles 00-00 (front matter) IDs", () => {
    expect(parseFilename("00-00 Endorsements.md")).toEqual({
      id: "0-0",
      file: "00-00 Endorsements",
      title: "Endorsements",
    });
  });

  test("supports unicode titles (Chinese)", () => {
    expect(parseFilename("03-01 活在多元世界.md")).toMatchObject({
      id: "3-1",
      title: "活在多元世界",
    });
  });

  test("supports unicode titles (Japanese)", () => {
    expect(parseFilename("05-06 多元投票.md")).toMatchObject({
      id: "5-6",
      title: "多元投票",
    });
  });

  test("supports multi-word titles with punctuation", () => {
    expect(parseFilename("04-00 Rights, Operating Systems & Freedom.md")).toMatchObject({
      id: "4-0",
      title: "Rights, Operating Systems & Freedom",
    });
  });

  test("returns null for non-markdown", () => {
    expect(parseFilename("01 Title.txt")).toBeNull();
    expect(parseFilename("README.md")).toBeNull();
  });

  test("returns null for single digit prefixes", () => {
    expect(parseFilename("1 Title.md")).toBeNull();
  });

  test("returns null for missing space after number", () => {
    expect(parseFilename("01-Title.md")).toBeNull();
  });

  test("returns null for missing title", () => {
    expect(parseFilename("01.md")).toBeNull();
    expect(parseFilename("01 .md")).toBeNull();
  });
});

describe("parseGithubBase", () => {
  test("parses a standard raw.githubusercontent URL", () => {
    expect(
      parseGithubBase(
        "https://raw.githubusercontent.com/GermanPluralityBook/pluralitaet/main/contents/"
      )
    ).toEqual({
      owner: "GermanPluralityBook",
      repo: "pluralitaet",
      branch: "main",
      pathPrefix: "contents",
    });
  });

  test("handles nested path prefixes", () => {
    expect(
      parseGithubBase(
        "https://raw.githubusercontent.com/a/b/main/contents/nested/"
      )
    ).toEqual({
      owner: "a",
      repo: "b",
      branch: "main",
      pathPrefix: "contents/nested",
    });
  });

  test("tolerates missing trailing slash", () => {
    expect(
      parseGithubBase("https://raw.githubusercontent.com/a/b/main/contents")
    ).toEqual({
      owner: "a",
      repo: "b",
      branch: "main",
      pathPrefix: "contents",
    });
  });

  test("supports non-main branches", () => {
    expect(
      parseGithubBase("https://raw.githubusercontent.com/a/b/develop/foo/")
    ).toMatchObject({ branch: "develop", pathPrefix: "foo" });
  });

  test("returns null for unrelated URLs", () => {
    expect(parseGithubBase("https://example.com/a/b/c")).toBeNull();
    expect(parseGithubBase("https://github.com/a/b")).toBeNull();
    expect(parseGithubBase("")).toBeNull();
  });
});
