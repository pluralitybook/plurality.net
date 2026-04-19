import { splitByHeadings } from "./markdown.js";

const DEFAULT_BASE =
  "https://raw.githubusercontent.com/pluralitybook/plurality/main/contents/";

export function chapterFetchUrl(langData, file) {
  const base = langData.githubBase || DEFAULT_BASE;
  return `${base}${langData.dir}/${encodeURIComponent(file + ".md")}`;
}

export function chapterPageUrl(langData, id) {
  return `${langData.prefix}/read/${id}/`;
}

export function sectionLabel(langI18n, sectionTitle, number) {
  const name = langI18n?.sections?.[sectionTitle] || sectionTitle;
  return `${name} · ${number}`;
}

/**
 * Pure, fetch-agnostic builder for a per-chapter search entry.
 * Returns null when no entry should be produced (untranslated or fetch failed).
 */
export async function buildChapterEntry({
  lang,
  langData,
  langI18n,
  section,
  chapter,
  fetcher,
}) {
  const override = langData.files?.[chapter.id];
  if (!override) return null;

  const url = chapterFetchUrl(langData, override.file);
  const pageUrl = chapterPageUrl(langData, chapter.id);

  let raw;
  try {
    raw = await fetcher(url);
  } catch {
    return null;
  }

  return {
    title: override.title,
    section: sectionLabel(langI18n, section.title, chapter.number),
    url: pageUrl,
    subsections: splitByHeadings(raw),
  };
}

export async function buildLangEntries({
  lang,
  langData,
  langI18n,
  chapters,
  fetcher,
}) {
  if (!langData?.files) return [];
  const entries = [];
  for (const section of chapters.sections) {
    for (const chapter of section.chapters) {
      const entry = await buildChapterEntry({
        lang,
        langData,
        langI18n,
        section,
        chapter,
        fetcher,
      });
      if (entry) entries.push(entry);
    }
  }
  return entries;
}

export async function buildSearchIndex({
  targetLangs,
  translations,
  i18n,
  chapters,
  fetcher,
}) {
  const result = {};
  for (const lang of targetLangs) {
    result[lang] = await buildLangEntries({
      lang,
      langData: translations[lang],
      langI18n: i18n[lang] || {},
      chapters,
      fetcher,
    });
  }
  return result;
}
