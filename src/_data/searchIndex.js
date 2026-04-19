import EleventyFetch from "@11ty/eleventy-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildSearchIndex } from "./lib/search-builder.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), "utf-8"));
}

const defaultFetcher = (url) =>
  EleventyFetch(url, { duration: "1d", type: "text" });

export default async function searchIndex({
  chapters = loadJson("chapters.json"),
  translations = loadJson("translations.json"),
  i18n = loadJson("i18n.json"),
  targetLangs = ["zh", "ja"],
  fetcher = defaultFetcher,
} = {}) {
  return buildSearchIndex({
    targetLangs,
    translations,
    i18n,
    chapters,
    fetcher,
  });
}
