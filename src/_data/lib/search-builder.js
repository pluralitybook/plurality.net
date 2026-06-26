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

const CREDITS_CHAPTER_ID = "0-3";

/**
 * Credits (0-3) on the site come from credits.json, not GitHub markdown.
 * One searchable subsection per language for Fuse + Vectorize sync.
 */
export function buildCreditsChapterEntry(lang, langData, credits, chapters) {
  if (!langData || !credits?.categories?.length) return null;
  const cl = credits.i18n?.[lang] || credits.i18n?.en;
  if (!cl) return null;

  let sectionTitle = "Before You Read";
  let chapterNumber = "0-3";
  let chapterTitle = "Credits";
  for (const section of chapters.sections || []) {
    const ch = section.chapters?.find((c) => c.id === CREDITS_CHAPTER_ID);
    if (ch) {
      sectionTitle = section.title;
      chapterNumber = ch.number;
      if (lang === "en") chapterTitle = ch.title;
      break;
    }
  }
  if (lang !== "en") {
    const override = langData.files?.[CREDITS_CHAPTER_ID];
    if (override?.title) chapterTitle = override.title;
  }

  const prefix = langData.prefix ?? "";
  const pageUrl = `${prefix}/read/${CREDITS_CHAPTER_ID}/`;
  const lines = [cl.intro, ""];
  for (const cat of credits.categories) {
    const catLabel = cl.categories?.[cat.name] || cat.name;
    const names = (cat.contributors || []).map((p) => p.name).join(", ");
    if (names) lines.push(`${catLabel}: ${names}`);
  }
  const content = lines.join("\n").trim();
  if (!content) return null;

  return {
    title: chapterTitle,
    section: `${sectionTitle} · ${chapterNumber}`,
    url: pageUrl,
    subsections: [
      {
        heading: chapterTitle,
        anchor: "credits",
        content,
      },
    ],
  };
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
  let file;
  let title;
  if (lang === "en") {
    file = chapter.file;
    title = chapter.title;
  } else {
    const override = langData.files?.[chapter.id];
    if (!override) return null;
    file = override.file;
    title = override.title;
  }

  const url = chapterFetchUrl(langData, file);
  const pageUrl = chapterPageUrl(langData, chapter.id);

  let raw;
  try {
    raw = await fetcher(url);
  } catch {
    return null;
  }

  return {
    title: title,
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
  credits,
  fetcher,
}) {
  const result = {};
  for (const lang of targetLangs) {
    const entries = await buildLangEntries({
      lang,
      langData: translations[lang],
      langI18n: i18n[lang] || {},
      chapters,
      fetcher,
    });
    const creditsEntry = buildCreditsChapterEntry(
      lang,
      translations[lang],
      credits,
      chapters,
    );
    if (creditsEntry) entries.push(creditsEntry);
    result[lang] = entries;
  }
  return result;
}
