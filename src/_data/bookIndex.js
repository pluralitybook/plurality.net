import EleventyFetch from "@11ty/eleventy-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

export default async function () {
  // English: fetch from GitHub
  let enTerms = [];
  try {
    const raw = await EleventyFetch(INDEX_URL, { duration: "1d", type: "text" });
    const codeBlockRe = /```\n([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockRe.exec(raw)) !== null) {
      for (const line of match[1].split("\n")) {
        const tab = line.indexOf("\t");
        if (tab === -1) continue;
        const term = line.slice(0, tab).trim();
        if (term) enTerms.push(term);
      }
    }
  } catch {}

  return {
    en: enTerms,
    zh: loadLocalIndex("zh"),
    ja: loadLocalIndex("ja"),
    th: loadLocalIndex("th"),
    el: loadLocalIndex("el"),
    de: loadLocalIndex("de"),
  };
}
