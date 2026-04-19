import { test, expect, describe } from "bun:test";
import bookIndex from "../../src/_data/bookIndex.js";

describe("bookIndex default export", () => {
  test("parses English from the provided fetcher and merges local loaders", async () => {
    const result = await bookIndex({
      fetcher: async () => "```\nAlpha\t1\nBeta\t2\n```\n",
      indexUrl: "stub://ignored",
      localLangs: ["zh", "ja"],
      loader: (lang) => [`${lang}-term`],
    });
    expect(result.en).toEqual(["Alpha", "Beta"]);
    expect(result.zh).toEqual(["zh-term"]);
    expect(result.ja).toEqual(["ja-term"]);
  });

  test("swallows fetcher errors and yields en=[]", async () => {
    const result = await bookIndex({
      fetcher: async () => {
        throw new Error("offline");
      },
      localLangs: ["zh"],
      loader: () => ["x"],
    });
    expect(result.en).toEqual([]);
    expect(result.zh).toEqual(["x"]);
  });

  test("real loadLocalIndex reads bookIndex-*.json files from src/_data", async () => {
    const result = await bookIndex({
      fetcher: async () => "",
      localLangs: ["de"],
    });
    expect(Array.isArray(result.de)).toBe(true);
  });

  test("real loadLocalIndex returns [] for unknown languages", async () => {
    const result = await bookIndex({
      fetcher: async () => "",
      localLangs: ["no-such-lang"],
    });
    expect(result["no-such-lang"]).toEqual([]);
  });

  test("default fetcher executes the EleventyFetch wiring", async () => {
    // Point defaultFetcher at a dead URL so EleventyFetch is actually called;
    // the catch inside bookIndex swallows the error and returns en=[].
    const result = await bookIndex({
      indexUrl: "http://127.0.0.1:1/index.md",
      localLangs: [],
    });
    expect(result.en).toEqual([]);
  });
});
