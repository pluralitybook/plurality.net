import { test, expect, describe } from "bun:test";
import {
  keys,
  where,
  slice,
  first,
  attr,
  cleanMarkdown,
} from "../../src/_includes/lib/filters.js";

describe("keys", () => {
  test("returns Object.keys for an object", () => {
    expect(keys({ a: 1, b: 2 })).toEqual(["a", "b"]);
  });
  test("returns [] for null/undefined", () => {
    expect(keys(null)).toEqual([]);
    expect(keys(undefined)).toEqual([]);
  });
});

describe("where", () => {
  test("filters items by key-value match", () => {
    const arr = [
      { k: "a", v: 1 },
      { k: "b", v: 2 },
      { k: "a", v: 3 },
    ];
    expect(where(arr, "k", "a")).toEqual([
      { k: "a", v: 1 },
      { k: "a", v: 3 },
    ]);
  });
  test("returns [] for nullish input", () => {
    expect(where(null, "k", "a")).toEqual([]);
    expect(where(undefined, "k", "a")).toEqual([]);
  });
});

describe("slice", () => {
  test("slices a range", () => {
    expect(slice([1, 2, 3, 4], 1, 3)).toEqual([2, 3]);
  });
  test("returns [] for nullish input", () => {
    expect(slice(null, 0, 1)).toEqual([]);
    expect(slice(undefined, 0, 1)).toEqual([]);
  });
});

describe("first", () => {
  test("returns first element", () => {
    expect(first([10, 20])).toBe(10);
  });
  test("returns null for empty / nullish", () => {
    expect(first([])).toBeNull();
    expect(first(null)).toBeNull();
    expect(first(undefined)).toBeNull();
  });
});

describe("attr", () => {
  test("reads a key off an object", () => {
    expect(attr({ title: "Hi" }, "title")).toBe("Hi");
  });
  test("falls back to empty string for missing key", () => {
    expect(attr({}, "title")).toBe("");
  });
  test("returns empty string for null obj", () => {
    expect(attr(null, "k")).toBe("");
    expect(attr(undefined, "k")).toBe("");
  });
});

describe("cleanMarkdown", () => {
  test("removes leading # title line", () => {
    expect(cleanMarkdown("# Chapter\n\nBody")).toBe("Body");
  });
  test("removes Chinese translator header and separator", () => {
    const src =
      "# Title\n\n| 原文：Somewhere\n| 譯者：Translator\n---\n\nBody here";
    expect(cleanMarkdown(src)).toBe("Body here");
  });
  test("removes lone leading --- separator", () => {
    expect(cleanMarkdown("---\nbody")).toBe("body");
  });
  test("leaves plain markdown untouched", () => {
    expect(cleanMarkdown("Just a paragraph.")).toBe("Just a paragraph.");
  });
});
