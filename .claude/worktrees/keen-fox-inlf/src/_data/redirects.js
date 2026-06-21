// Generate redirect mappings from old plurality.net URL structure
// Old pattern: /v/chapters/{id}/{lang}/ → /{newLangPrefix}/read/{id}/
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const chapters = JSON.parse(
  fs.readFileSync(path.join(__dirname, "chapters.json"), "utf-8")
);

// Old site language codes → new site prefixes
const langMap = {
  eng: "",
  "zh-tw": "/zh",
  jpn: "/ja",
  tha: "/th",
  gre: "/el",
  // "en" also appears for chapter 1 on old site
  en: "",
  de: "/de",
};

export default function () {
  const redirects = [];

  // Chapter redirects: /v/chapters/{id}/{lang}/ → /{prefix}/read/{id}/
  for (const section of chapters.sections) {
    for (const ch of section.chapters) {
      for (const [oldLang, newPrefix] of Object.entries(langMap)) {
        redirects.push({
          from: `/v/chapters/${ch.id}/${oldLang}/`,
          to: `${newPrefix}/read/${ch.id}/`,
        });
      }
    }
  }

  // Static page redirects
  redirects.push({ from: "/chapters/", to: "/read/" });
  redirects.push({ from: "/announcement/", to: "/" });
  redirects.push({ from: "/contribution/", to: "/" });

  return redirects;
}
