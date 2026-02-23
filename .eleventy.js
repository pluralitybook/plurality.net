import markdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import markdownItFootnote from "markdown-it-footnote";
import EleventyFetch from "@11ty/eleventy-fetch";

export default function (eleventyConfig) {
  const md = markdownIt({ html: true, typographer: true, linkify: true })
    .use(markdownItAnchor, {
      permalink: false,
      level: [2, 3, 4],
    })
    .use(markdownItFootnote);

  eleventyConfig.setLibrary("md", md);

  // Passthrough copy
  eleventyConfig.addPassthroughCopy({ "src/_includes/css": "assets/css" });
  eleventyConfig.addPassthroughCopy({ "src/_includes/js": "assets/js" });
  eleventyConfig.addPassthroughCopy({ "src/assets/images": "assets/images" });
  eleventyConfig.addPassthroughCopy("src/CNAME");

  // Filters
  eleventyConfig.addFilter("keys", (obj) => Object.keys(obj || {}));

  eleventyConfig.addFilter("where", (arr, key, val) => {
    if (!arr) return [];
    return arr.filter((item) => item[key] === val);
  });

  eleventyConfig.addFilter("slice", (arr, start, end) => {
    if (!arr) return [];
    return arr.slice(start, end);
  });

  eleventyConfig.addFilter("first", (arr) => {
    if (!arr || !arr.length) return null;
    return arr[0];
  });

  eleventyConfig.addFilter("attr", (obj, key) => {
    if (!obj) return "";
    return obj[key] || "";
  });

  eleventyConfig.addFilter("renderMarkdown", (content) => {
    if (!content) return "";
    return md.render(content);
  });

  // Clean fetched markdown: strip leading # title and translation front matter
  function cleanMarkdown(raw) {
    let s = String(raw);
    // Remove leading # Title line (already rendered by template)
    s = s.replace(/^\s*#\s+.+\n+/, "");
    // Remove 原文/作者/譯者 block (Chinese translation metadata up to ---)
    s = s.replace(/^原文[：:][\s\S]*?(?=\n---)/m, "");
    // Remove any leading --- separator left behind
    s = s.replace(/^\s*---\s*\n/, "");
    return s;
  }

  // Shortcode: Fetch remote markdown content from GitHub
  // Usage: {% fetchcontent "https://raw.githubusercontent.com/..." %}
  eleventyConfig.addAsyncShortcode("fetchcontent", async function (url, fallbackUrl) {
    try {
      let content = await EleventyFetch(url, {
        duration: "1d",
        type: "text",
      });
      return md.render(cleanMarkdown(content));
    } catch (e) {
      if (fallbackUrl) {
        try {
          let content = await EleventyFetch(fallbackUrl, {
            duration: "1d",
            type: "text",
          });
          return md.render(cleanMarkdown(content));
        } catch (e2) {
          return `<p class="muted"><em>Content is temporarily unavailable. Please revisit this page later.</em></p>`;
        }
      }
      return `<p class="muted"><em>Content is temporarily unavailable. Please revisit this page later.</em></p>`;
    }
  });

  // Shortcode: Fetch remote raw text (no rendering)
  eleventyConfig.addAsyncShortcode("fetchraw", async function (url) {
    try {
      return await EleventyFetch(url, {
        duration: "1d",
        type: "text",
      });
    } catch (e) {
      return "";
    }
  });

  return {
    dir: {
      input: "src",
      output: "dist",
      includes: "_includes",
      layouts: "_includes/layouts",
      data: "_data",
    },
    templateFormats: ["njk", "md", "html"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
}
