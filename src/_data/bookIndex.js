import EleventyFetch from "@11ty/eleventy-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseIndexMarkdown } from "./lib/book-index-parser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const INDEX_URL =
  "https://raw.githubusercontent.com/pluralitybook/plurality/main/scripts/index/index_for_copyedit.md";

function loadLocalIndex(lang) {
  try {
    const filePath = path.join(__dirname, `bookIndex-${lang}.json`);
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return [];
  }
}

const defaultFetcher = (url) =>
  EleventyFetch(url, { duration: "1d", type: "text" });

export default async function bookIndex({
  fetcher = defaultFetcher,
  indexUrl = INDEX_URL,
  localLangs = ["zh", "ja", "th", "el", "de"],
  loader = loadLocalIndex,
} = {}) {
  let en = [];
  try {
    const raw = await fetcher(indexUrl);
    en = parseIndexMarkdown(raw);
  } catch {}

  const out = { en };
  for (const lang of localLangs) out[lang] = loader(lang);
  return out;
}
