import { test, expect, describe } from "bun:test";
import eleventyConfigFn from "../../.eleventy.js";

type Recorder = {
  filters: Record<string, (...args: any[]) => any>;
  passthroughs: any[];
  libraries: Record<string, any>;
  shortcodes: Record<string, (...args: any[]) => any>;
};

function makeRecorder(): { cfg: any; rec: Recorder } {
  const rec: Recorder = {
    filters: {},
    passthroughs: [],
    libraries: {},
    shortcodes: {},
  };
  const cfg = {
    addFilter: (name: string, fn: any) => {
      rec.filters[name] = fn;
    },
    addPassthroughCopy: (spec: any) => {
      rec.passthroughs.push(spec);
    },
    addAsyncShortcode: (name: string, fn: any) => {
      rec.shortcodes[name] = fn;
    },
    setLibrary: (name: string, lib: any) => {
      rec.libraries[name] = lib;
    },
  };
  return { cfg, rec };
}

describe("eleventy config", () => {
  test("returns the expected directory + template format config", () => {
    const { cfg } = makeRecorder();
    const result = eleventyConfigFn(cfg);
    expect(result.dir).toEqual({
      input: "src",
      output: "dist",
      includes: "_includes",
      layouts: "_includes/layouts",
      data: "_data",
    });
    expect(result.templateFormats).toEqual(["njk", "md", "html"]);
    expect(result.htmlTemplateEngine).toBe("njk");
    expect(result.markdownTemplateEngine).toBe("njk");
  });

  test("registers the core filters", () => {
    const { cfg, rec } = makeRecorder();
    eleventyConfigFn(cfg);
    for (const name of [
      "keys",
      "where",
      "slice",
      "first",
      "attr",
      "renderMarkdown",
    ]) {
      expect(typeof rec.filters[name]).toBe("function");
    }
  });

  test("renderMarkdown returns '' for empty input and rendered HTML otherwise", () => {
    const { cfg, rec } = makeRecorder();
    eleventyConfigFn(cfg);
    const render = rec.filters.renderMarkdown;
    expect(render("")).toBe("");
    expect(render(null)).toBe("");
    expect(render("# Title")).toContain("<h1");
  });

  test("registers passthrough copies for CSS, JS, images, and CNAME", () => {
    const { cfg, rec } = makeRecorder();
    eleventyConfigFn(cfg);
    const asStrings = rec.passthroughs
      .map((s) => (typeof s === "string" ? s : JSON.stringify(s)))
      .join(" ");
    expect(asStrings).toContain("_includes/css");
    expect(asStrings).toContain("_includes/js");
    expect(asStrings).toContain("assets/images");
    expect(asStrings).toContain("src/CNAME");
  });

  test("registers a markdown library and the fetchcontent / fetchraw shortcodes", () => {
    const { cfg, rec } = makeRecorder();
    eleventyConfigFn(cfg);
    expect(rec.libraries.md).toBeDefined();
    expect(typeof rec.shortcodes.fetchcontent).toBe("function");
    expect(typeof rec.shortcodes.fetchraw).toBe("function");
  });

  test("fetchcontent falls back when the primary URL throws and no fallback provided", async () => {
    const { cfg, rec } = makeRecorder();
    eleventyConfigFn(cfg);
    // Invoke with an obviously unreachable URL — the shortcode's catch returns
    // the "temporarily unavailable" HTML.
    const html = await rec.shortcodes.fetchcontent(
      "https://127.0.0.1:1/does-not-exist.md"
    );
    expect(html).toContain("temporarily unavailable");
  });

  test("fetchraw returns '' on fetch failure", async () => {
    const { cfg, rec } = makeRecorder();
    eleventyConfigFn(cfg);
    const raw = await rec.shortcodes.fetchraw(
      "https://127.0.0.1:1/does-not-exist.md"
    );
    expect(raw).toBe("");
  });

  test("fetchcontent uses the fallback URL when primary fails and both fail to the 'unavailable' message", async () => {
    const { cfg, rec } = makeRecorder();
    eleventyConfigFn(cfg);
    const html = await rec.shortcodes.fetchcontent(
      "https://127.0.0.1:1/does-not-exist.md",
      "https://127.0.0.1:1/also-missing.md"
    );
    expect(html).toContain("temporarily unavailable");
  });
});
