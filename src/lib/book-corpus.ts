import { execSync } from 'node:child_process';
import bookIndexDe from '../data/bookIndex-de.json';
import bookIndexEl from '../data/bookIndex-el.json';
import bookIndexJa from '../data/bookIndex-ja.json';
import bookIndexTh from '../data/bookIndex-th.json';
import bookIndexZh from '../data/bookIndex-zh.json';
import chaptersData from '../data/chapters.json';
import creditsData from '../data/credits.json';
import endorsementsData from '../data/endorsements.json';
import homeLangsData from '../data/homeLangs.json';
import i18nData from '../data/i18n.json';
import translationsData from '../data/translations.json';
import { parseIndexMarkdown } from './book-index-parser';
import { renderBookMarkdown } from './markdown-renderer';
import { type FetchText, fetchTextCached } from './remote-text-cache';

export type LangCode = 'en' | 'zh' | 'ja' | 'th' | 'el' | 'de';

/** Map internal lang code to BCP 47 HTML lang attribute value. */
export function toBcp47(lang: LangCode): string {
  const map: Record<LangCode, string> = {
    en: 'en',
    zh: 'zh-Hant-TW',
    ja: 'ja-JP',
    th: 'th',
    el: 'el',
    de: 'de',
  };
  return map[lang];
}

/** Map internal lang code to OpenGraph locale string (underscore form). */
export function toOgLocale(lang: LangCode): string {
  const map: Record<LangCode, string> = {
    en: 'en_US',
    zh: 'zh_TW',
    ja: 'ja_JP',
    th: 'th_TH',
    el: 'el_GR',
    de: 'de_DE',
  };
  return map[lang];
}
export type ChapterNav = { url: string; title: string };
export type AltLang = { lang: LangCode; label: string; url: string };
export type ChapterEntry = {
  id: string;
  number: string;
  title: string;
  titleEn: string;
  lang: LangCode;
  langLabel: string;
  file: string;
  sectionId: string;
  sectionTitle: string;
  sectionColor: string;
  url: string;
  githubUrl: string;
  localEndorsements: boolean;
  localCredits: boolean;
  untranslated: boolean;
  altLangs: AltLang[];
  prevChapter: ChapterNav | null;
  nextChapter: ChapterNav | null;
};

type Chapter = { id: string; number: string; title: string; file: string };
type Section = { id: string; title: string; color: string; chapters: Chapter[] };
type ChaptersData = { sections: Section[] };
type TranslationFile = { file: string; title: string };
type Translation = {
  dir: string;
  prefix: string;
  label: string;
  githubBase?: string;
  contributeUrl?: string;
  files: Partial<Record<string, TranslationFile>>;
};
type Translations = Record<LangCode, Translation>;
type I18n = Record<
  LangCode,
  {
    lang_name?: string;
    sections?: Record<string, string>;
    translation_in_progress?: string;
    read_english?: string;
    help_translate?: string;
  }
>;
type Endorsement = { quote: string; author: string; title?: string };
type Credits = {
  i18n: Record<string, { intro: string; categories: Record<string, string> }>;
  categories: Array<{ name: string; contributors: Array<{ name: string; pt: number }> }>;
};

const chapters = chaptersData as ChaptersData;
const translations = translationsData as Translations;
const i18n = i18nData as I18n;
const endorsements = endorsementsData as Partial<Record<LangCode, Endorsement[]>>;
const credits = creditsData as Credits;
const homeLangs = homeLangsData as LangCode[];
const DEFAULT_BASE = 'https://raw.githubusercontent.com/pluralitybook/plurality/main/contents/';
const INDEX_URL =
  'https://raw.githubusercontent.com/pluralitybook/plurality/main/scripts/index/index_for_copyedit.md';
const localBookIndexes: Record<Exclude<LangCode, 'en'>, string[]> = {
  zh: bookIndexZh as string[],
  ja: bookIndexJa as string[],
  th: bookIndexTh as string[],
  el: bookIndexEl as string[],
  de: bookIndexDe as string[],
};

export function getLocalizedPrefix(lang: LangCode): string {
  return translations[lang]?.prefix ?? '';
}

export function getHomeLangs(): LangCode[] {
  return [...homeLangs];
}

export function getNonEnglishLangs(): Exclude<LangCode, 'en'>[] {
  return (Object.keys(translations) as LangCode[]).filter(
    (lang): lang is Exclude<LangCode, 'en'> => lang !== 'en'
  );
}

export function getFlatChapters(): ChapterEntry[] {
  const allEntries: ChapterEntry[] = [];
  for (const lang of Object.keys(translations) as LangCode[]) {
    const langData = translations[lang];
    const flat: ChapterEntry[] = [];
    const base = langData.githubBase || DEFAULT_BASE;
    for (const section of chapters.sections) {
      for (const chapter of section.chapters) {
        const override = lang === 'en' ? undefined : langData.files[chapter.id];
        const untranslated = lang !== 'en' && !override;
        const file = override?.file ?? chapter.file;
        const title = override?.title ?? chapter.title;
        const prefix = langData.prefix || '';
        flat.push({
          id: chapter.id,
          number: chapter.number,
          title,
          titleEn: chapter.title,
          lang,
          langLabel: langData.label,
          file,
          sectionId: section.id,
          sectionTitle: i18n[lang]?.sections?.[section.title] || section.title,
          sectionColor: section.color,
          url: `${prefix}/read/${chapter.id}/`,
          githubUrl: `${base}${langData.dir}/${encodeURIComponent(`${file}.md`)}`,
          localEndorsements:
            chapter.id === '0-0' &&
            lang !== 'en' &&
            Boolean(endorsements[lang]) &&
            file === '0-0-endorsements',
          localCredits: chapter.id === '0-3',
          untranslated,
          altLangs: [],
          prevChapter: null,
          nextChapter: null,
        });
      }
    }
    for (let i = 0; i < flat.length; i += 1) {
      flat[i].prevChapter = i > 0 ? { url: flat[i - 1].url, title: flat[i - 1].title } : null;
      flat[i].nextChapter =
        i < flat.length - 1 ? { url: flat[i + 1].url, title: flat[i + 1].title } : null;
    }
    allEntries.push(...flat);
  }
  const byChapterId = new Map<string, AltLang[]>();
  for (const entry of allEntries) {
    const list = byChapterId.get(entry.id) ?? [];
    list.push({ lang: entry.lang, label: entry.langLabel, url: entry.url });
    byChapterId.set(entry.id, list);
  }
  for (const entry of allEntries) {
    entry.altLangs = byChapterId.get(entry.id)!.filter((alt) => alt.lang !== entry.lang);
  }
  return allEntries;
}

export function getChaptersByLanguage(lang: LangCode): ChapterEntry[] {
  return getFlatChapters().filter((chapter) => chapter.lang === lang);
}

export function getRedirects(): Array<{ from: string; to: string }> {
  const redirects: Array<{ from: string; to: string }> = [];
  const langMap: Record<string, string> = {
    eng: '',
    'zh-tw': '/zh',
    jpn: '/ja',
    tha: '/th',
    gre: '/el',
    en: '',
    de: '/de',
  };
  for (const section of chapters.sections) {
    for (const chapter of section.chapters) {
      for (const [oldLang, newPrefix] of Object.entries(langMap)) {
        redirects.push({
          from: `/v/chapters/${chapter.id}/${oldLang}/`,
          to: `${newPrefix}/read/${chapter.id}/`,
        });
      }
    }
  }
  redirects.push({ from: '/chapters/', to: '/read/' });
  redirects.push({ from: '/announcement/', to: '/' });
  redirects.push({ from: '/contribution/', to: '/' });
  return redirects;
}

export function assetVersion(run: typeof execSync = execSync): string {
  try {
    return run('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'dev';
  }
}

export async function getBookIndex(
  fetcher: FetchText = fetchTextCached
): Promise<Record<LangCode, string[]>> {
  let en: string[] = [];
  try {
    en = parseIndexMarkdown(await fetcher(INDEX_URL));
  } catch {}
  return { en, ...localBookIndexes };
}

export async function renderChapterBody(
  entry: ChapterEntry,
  fetcher: FetchText = fetchTextCached
): Promise<string> {
  if (entry.untranslated) {
    const langI18n = i18n[entry.lang];
    const contributeUrl = translations[entry.lang].contributeUrl;
    const help = contributeUrl
      ? `<p><a href="${contributeUrl}">${langI18n.help_translate || 'Help translate'} &rarr;</a></p>`
      : '';
    return `<div class="book__untranslated"><p>${langI18n.translation_in_progress || 'This chapter is being translated. You can help by contributing to the translation effort.'}</p><p><a href="/read/${entry.id}/">${langI18n.read_english || 'Read in English'} &rarr;</a></p>${help}</div>`;
  }
  if (entry.id === '0-0' && entry.localEndorsements) {
    return (endorsements[entry.lang] ?? [])
      .map(
        (item) =>
          `<blockquote><p>${item.quote}</p><p>— ${item.author}${item.title ? `, ${item.title}` : ''}</p></blockquote>`
      )
      .join('\n');
  }
  if (entry.localCredits) {
    const cl = credits.i18n[entry.lang] || credits.i18n.en;
    const categories = credits.categories
      .map((cat) => {
        const names = cat.contributors
          .map(
            (person) =>
              `<li class="credits__name" style="font-size: ${Number((person.pt / 12).toFixed(3))}rem">${person.name}</li>`
          )
          .join('');
        return `<div class="credits__category"><h3 class="credits__category-name">${cl.categories[cat.name] || cat.name}</h3><ul class="credits__list">${names}</ul></div>`;
      })
      .join('\n');
    return `<p class="credits__intro">${cl.intro}</p>\n${categories}`;
  }
  try {
    return renderBookMarkdown(await fetcher(entry.githubUrl));
  } catch {
    return `<p class="muted"><em>Content is temporarily unavailable. Please revisit this page later.</em></p>`;
  }
}
