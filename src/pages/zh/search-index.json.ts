import chapters from '../../data/chapters.json';
import credits from '../../data/credits.json';
import i18n from '../../data/i18n.json';
import translations from '../../data/translations.json';
import { fetchTextCached } from '../../lib/remote-text-cache';
import {
  buildSearchIndex,
  type Chapters,
  type Credits,
  type LangData,
  type LangI18n,
} from '../../lib/search-builder';

const typedTranslations = translations as Record<string, LangData>;
const typedI18n = i18n as Record<string, LangI18n>;
const typedChapters = chapters as Chapters;
const typedCredits = credits as Credits;
const lang = 'zh';

export async function GET() {
  const indexByLang = await buildSearchIndex({
    targetLangs: [lang],
    translations: typedTranslations,
    i18n: typedI18n,
    chapters: typedChapters,
    credits: typedCredits,
    fetcher: fetchTextCached,
  });
  return new Response(JSON.stringify(indexByLang[lang]), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
