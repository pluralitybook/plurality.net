import { splitByBlockquotes, splitByHeadings, type SearchSubsection } from './markdown';

const DEFAULT_BASE = 'https://raw.githubusercontent.com/pluralitybook/plurality/main/contents/';
const CREDITS_CHAPTER_ID = '0-3';

type TranslationFile = { file: string; title: string };
export type LangData = {
  dir?: string;
  prefix?: string;
  githubBase?: string;
  files?: Partial<Record<string, TranslationFile>>;
};
export type Chapter = { id: string; number: string; title: string; file?: string };
export type Section = { id?: string; title: string; chapters?: Chapter[] };
export type Chapters = { sections: Section[] };
export type LangI18n = { sections?: Record<string, string> };
export type Credits = {
  i18n?: Record<string, { intro: string; categories?: Record<string, string> }>;
  categories?: Array<{ name: string; contributors?: Array<{ name: string; pt?: number }> }>;
};
export type SearchChapter = {
  title: string;
  section: string;
  url: string;
  subsections: SearchSubsection[];
};
export type BuildChapterEntryArgs = {
  lang: string;
  langData: LangData | undefined;
  langI18n: LangI18n | undefined;
  section: Section;
  chapter: Chapter;
  fetcher: (url: string) => Promise<string>;
};
export type BuildLangEntriesArgs = {
  lang: string;
  langData: LangData | undefined;
  langI18n: LangI18n | undefined;
  chapters: Chapters;
  fetcher: (url: string) => Promise<string>;
};
export type BuildSearchIndexArgs = {
  targetLangs: string[];
  translations: Record<string, LangData | undefined>;
  i18n: Record<string, LangI18n | undefined>;
  chapters: Chapters;
  credits: Credits;
  fetcher: (url: string) => Promise<string>;
};

export function chapterFetchUrl(langData: LangData, file: string): string {
  const base = langData.githubBase || DEFAULT_BASE;
  return `${base}${langData.dir}/${encodeURIComponent(`${file}.md`)}`;
}

export function chapterPageUrl(langData: Pick<LangData, 'prefix'>, id: string): string {
  return `${langData.prefix ?? ''}/read/${id}/`;
}

export function sectionLabel(
  langI18n: LangI18n | undefined,
  sectionTitle: string,
  number: string
): string {
  const name = langI18n?.sections?.[sectionTitle] || sectionTitle;
  return `${name} · ${number}`;
}

export function buildCreditsChapterEntry(
  lang: string,
  langData: LangData | undefined,
  credits: Credits,
  chapters: Chapters
): SearchChapter | null {
  if (!langData || !credits.categories?.length) return null;
  const cl = credits.i18n?.[lang] || credits.i18n?.en;
  if (!cl) return null;
  let sectionTitle = 'Before You Read';
  let chapterNumber = '0-3';
  let chapterTitle = 'Credits';
  for (const section of chapters.sections || []) {
    const chapter = section.chapters?.find((item) => item.id === CREDITS_CHAPTER_ID);
    if (chapter) {
      sectionTitle = section.title;
      chapterNumber = chapter.number;
      if (lang === 'en') chapterTitle = chapter.title;
      break;
    }
  }
  if (lang !== 'en') {
    const override = langData.files?.[CREDITS_CHAPTER_ID];
    if (override?.title) chapterTitle = override.title;
  }
  const lines = [cl.intro, ''];
  for (const cat of credits.categories) {
    const catLabel = cl.categories?.[cat.name] || cat.name;
    const names = (cat.contributors || []).map((person) => person.name).join(', ');
    if (names) lines.push(`${catLabel}: ${names}`);
  }
  const content = lines.join('\n').trim();
  if (!content) return null;
  return {
    title: chapterTitle,
    section: `${sectionTitle} · ${chapterNumber}`,
    url: `${langData.prefix ?? ''}/read/${CREDITS_CHAPTER_ID}/`,
    subsections: [{ heading: chapterTitle, anchor: 'credits', content }],
  };
}

export async function buildChapterEntry({
  lang,
  langData,
  langI18n,
  section,
  chapter,
  fetcher,
}: BuildChapterEntryArgs): Promise<SearchChapter | null> {
  if (!langData) return null;
  const override = lang === 'en' ? undefined : langData.files?.[chapter.id];
  if (lang !== 'en' && !override) return null;
  const file = override?.file ?? chapter.file;
  if (!file) return null;
  const title = override?.title ?? chapter.title;
  let raw: string;
  try {
    raw = await fetcher(chapterFetchUrl(langData, file));
  } catch {
    return null;
  }
  return {
    title,
    section: sectionLabel(langI18n, section.title, chapter.number),
    url: chapterPageUrl(langData, chapter.id),
    subsections: chapter.id === '0-0' ? splitByBlockquotes(raw) : splitByHeadings(raw),
  };
}

export async function buildLangEntries({
  lang,
  langData,
  langI18n,
  chapters,
  fetcher,
}: BuildLangEntriesArgs): Promise<SearchChapter[]> {
  if (!langData?.files) return [];
  const entries: SearchChapter[] = [];
  for (const section of chapters.sections) {
    for (const chapter of section.chapters || []) {
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
}: BuildSearchIndexArgs): Promise<Record<string, SearchChapter[]>> {
  const result: Record<string, SearchChapter[]> = {};
  for (const lang of targetLangs) {
    const entries = await buildLangEntries({
      lang,
      langData: translations[lang],
      langI18n: i18n[lang] || {},
      chapters,
      fetcher,
    });
    const creditsEntry = buildCreditsChapterEntry(lang, translations[lang], credits, chapters);
    if (creditsEntry) entries.push(creditsEntry);
    result[lang] = entries;
  }
  return result;
}
