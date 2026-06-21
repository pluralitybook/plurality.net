import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const chapters = JSON.parse(
  fs.readFileSync(path.join(__dirname, "chapters.json"), "utf-8")
);
const translations = JSON.parse(
  fs.readFileSync(path.join(__dirname, "translations.json"), "utf-8")
);
const endorsements = JSON.parse(
  fs.readFileSync(path.join(__dirname, "endorsements.json"), "utf-8")
);
const i18n = JSON.parse(
  fs.readFileSync(path.join(__dirname, "i18n.json"), "utf-8")
);

export default function () {
  const allEntries = [];

  for (const [lang, langData] of Object.entries(translations)) {
    const flat = [];
    const base = langData.githubBase ||
      "https://raw.githubusercontent.com/pluralitybook/plurality/main/contents/";

    for (const section of chapters.sections) {
      for (const ch of section.chapters) {
        // For non-English languages, get the translated file and title
        let file, title;
        if (lang === "en") {
          file = ch.file;
          title = ch.title;
        } else {
          const override = langData.files[ch.id];
          if (!override) continue; // skip chapters not available in this language
          file = override.file;
          title = override.title;
        }

        const encodedFile = encodeURIComponent(file + ".md");
        const prefix = langData.prefix || "";

        // For 0-0 chapters, check if we should use local endorsements data
        // (when the language has endorsements but the file is a placeholder)
        const localEndorsements = ch.id === "0-0" && lang !== "en"
          && endorsements[lang]
          && file === "0-0-endorsements";

        // For 0-3 (Credits), use local data for all languages
        const localCredits = ch.id === "0-3";

        flat.push({
          id: ch.id,
          number: ch.number,
          title: title,
          titleEn: ch.title,
          lang: lang,
          langLabel: langData.label,
          file: file,
          sectionId: section.id,
          sectionTitle: (i18n[lang] && i18n[lang].sections && i18n[lang].sections[section.title]) || section.title,
          sectionColor: section.color,
          url: `${prefix}/read/${ch.id}/`,
          githubUrl: `${base}${langData.dir}/${encodedFile}`,
          localEndorsements: localEndorsements,
          localCredits: localCredits,
          altLangs: [],
        });
      }
    }

    // Compute prev/next within the same language
    for (let i = 0; i < flat.length; i++) {
      flat[i].prevChapter =
        i > 0 ? { url: flat[i - 1].url, title: flat[i - 1].title } : null;
      flat[i].nextChapter =
        i < flat.length - 1
          ? { url: flat[i + 1].url, title: flat[i + 1].title }
          : null;
    }

    allEntries.push(...flat);
  }

  // Build altLangs cross-references
  const byChapterId = new Map();
  for (const entry of allEntries) {
    if (!byChapterId.has(entry.id)) byChapterId.set(entry.id, []);
    byChapterId.get(entry.id).push({ lang: entry.lang, label: entry.langLabel, url: entry.url });
  }
  for (const entry of allEntries) {
    entry.altLangs = (byChapterId.get(entry.id) || []).filter(
      (a) => a.lang !== entry.lang
    );
  }

  return allEntries;
}
