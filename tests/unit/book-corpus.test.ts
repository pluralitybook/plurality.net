import { describe, expect, test, vi } from 'vite-plus/test';
import {
  assetVersion,
  getBookIndex,
  getChaptersByLanguage,
  getHomeLangs,
  getLocalizedPrefix,
  getNonEnglishLangs,
  getRedirects,
} from '../../src/lib/book-corpus.ts';

describe('book corpus helpers', () => {
  test('returns localized prefixes and home languages', () => {
    expect(getLocalizedPrefix('en')).toBe('');
    expect(getLocalizedPrefix('zh')).toBe('/zh');
    expect(getHomeLangs()).toContain('en');
    expect(getNonEnglishLangs()).toEqual(expect.arrayContaining(['zh', 'ja', 'th', 'el', 'de']));
  });

  test('falls back to an empty prefix for an unregistered language', () => {
    expect(getLocalizedPrefix('xx' as Parameters<typeof getLocalizedPrefix>[0])).toBe('');
  });

  test('filters chapters by language and populates alternate languages', () => {
    const ja = getChaptersByLanguage('ja');
    expect(ja.length).toBeGreaterThan(0);
    expect(ja.every((chapter) => chapter.lang === 'ja')).toBe(true);
    const preface = ja.find((chapter) => chapter.id === '1');
    expect(preface).toBeDefined();
    expect(preface!.altLangs.length).toBeGreaterThan(0);
    expect(preface!.altLangs.some((alt) => alt.lang === 'en')).toBe(true);
    expect(preface!.altLangs.every((alt) => alt.lang !== 'ja')).toBe(true);
  });

  test('assetVersion returns a non-empty string', () => {
    expect(assetVersion().length).toBeGreaterThan(0);
  });

  test('assetVersion falls back when git is unavailable', () => {
    expect(
      assetVersion(() => {
        throw new Error('git missing');
      })
    ).toBe('dev');
  });
});

test('builds legacy redirects for every chapter and language', () => {
  const redirects = getRedirects();
  expect(redirects).toContainEqual({ from: '/chapters/', to: '/read/' });
  expect(redirects).toContainEqual({ from: '/v/chapters/0-0/zh-tw/', to: '/zh/read/0-0/' });
  expect(redirects).toContainEqual({ from: '/v/chapters/0-0/eng/', to: '/read/0-0/' });
  expect(redirects).toContainEqual({ from: '/announcement/', to: '/' });
});

test('loads the remote English index and falls back when it fails', async () => {
  const loaded = await getBookIndex(async () => '```\nheading\tfile\nchapter\tfile\n```');
  expect(loaded.en).toEqual(['heading', 'chapter']);
  expect(loaded.zh.length).toBeGreaterThan(0);

  const failed = await getBookIndex(async () => {
    throw new Error('network unavailable');
  });
  expect(failed.en).toEqual([]);
});

test('covers incomplete corpus data fallbacks and local rendering branches', async () => {
  // Dynamic import is required here so each intentionally incomplete JSON fixture
  // is applied before book-corpus evaluates its module-level data imports.
  vi.resetModules();
  vi.doMock('../../src/data/chapters.json', () => ({
    default: {
      sections: [
        {
          id: 'front',
          title: 'Front',
          color: 'red',
          chapters: [
            { id: '0-0', number: '0-0', title: 'Endorsements', file: 'endorsements' },
            { id: '0-3', number: '0-3', title: 'Credits', file: 'credits' },
            { id: '1', number: '1', title: 'One', file: 'one' },
          ],
        },
      ],
    },
  }));
  vi.doMock('../../src/data/translations.json', () => ({
    default: {
      en: { dir: 'en', prefix: '', label: 'English', files: {} },
      zh: {
        dir: 'zh',
        prefix: '/zh',
        label: '中文',
        contributeUrl: 'https://example.test/contribute',
        files: {},
      },
    },
  }));
  vi.doMock('../../src/data/i18n.json', () => ({
    default: {
      en: { sections: {} },
      zh: { sections: {} },
    },
  }));
  vi.doMock('../../src/data/endorsements.json', () => ({
    default: {
      zh: [
        { quote: 'Q1', author: 'A1', title: 'T1' },
        { quote: 'Q2', author: 'A2' },
      ],
    },
  }));
  vi.doMock('../../src/data/credits.json', () => ({
    default: {
      i18n: { en: { intro: 'Credits intro', categories: {} } },
      categories: [{ name: 'missing-category', contributors: [{ name: 'Ada', pt: 12 }] }],
    },
  }));

  const corpus = await import('../../src/lib/book-corpus.ts');
  const entries = corpus.getFlatChapters();
  expect(entries.find((entry) => entry.lang === 'en')?.githubUrl).toContain(
    'raw.githubusercontent.com'
  );

  const untranslated = entries.find((entry) => entry.lang === 'zh' && entry.id === '1');
  expect(untranslated?.untranslated).toBe(true);
  const translatedBody = await corpus.renderChapterBody(untranslated!, async () => {
    throw new Error('untranslated entries must not fetch');
  });
  expect(translatedBody).toContain('This chapter is being translated');
  expect(translatedBody).toContain('Read in English');
  expect(translatedBody).toContain('https://example.test/contribute');
  expect(
    await corpus.renderChapterBody(
      { ...untranslated!, lang: 'en', untranslated: true },
      async () => {
        throw new Error('untranslated entries must not fetch');
      }
    )
  ).toContain('This chapter is being translated');

  expect(
    await corpus.renderChapterBody({
      ...entries.find((entry) => entry.lang === 'ja')!,
      lang: 'ja',
      id: '0-0',
      localEndorsements: true,
      untranslated: false,
    })
  ).toBe('');
  expect(
    await corpus.renderChapterBody({
      ...entries.find((entry) => entry.lang === 'zh' && entry.id === '0-0')!,
      localEndorsements: true,
      untranslated: false,
    })
  ).toContain(', T1');
  expect(
    await corpus.renderChapterBody({
      ...entries.find((entry) => entry.lang === 'zh' && entry.id === '0-3')!,
      lang: 'ja',
      localCredits: true,
      untranslated: false,
    })
  ).toContain('missing-category');

  vi.doUnmock('../../src/data/chapters.json');
  vi.doUnmock('../../src/data/translations.json');
  vi.doUnmock('../../src/data/i18n.json');
  vi.doUnmock('../../src/data/endorsements.json');
  vi.doUnmock('../../src/data/credits.json');
});
