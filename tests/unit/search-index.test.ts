import { describe, expect, test } from 'bun:test';
import { buildSearchIndex, type Chapters, type LangData } from '../../src/lib/search-builder.ts';

describe('buildSearchIndex endpoint data', () => {
  const translations: Record<string, LangData> = {
    en: { dir: 'english' },
    xx: {
      dir: 'xx',
      prefix: '/xx',
      githubBase: 'https://raw.githubusercontent.com/a/b/main/contents/',
      files: { '1': { file: '01 Foo', title: 'Foo' } },
    },
  };
  const chapters: Chapters = {
    sections: [
      { id: 'preface', title: 'Preface', chapters: [{ id: '1', number: '1', title: 'Preface' }] },
    ],
  };

  test('returns one array per target language', async () => {
    const result = await buildSearchIndex({
      targetLangs: ['xx'],
      chapters,
      translations,
      i18n: { xx: { sections: {} } },
      credits: { i18n: {}, categories: [] },
      fetcher: async () => '## H\n\npara\n',
    });
    expect(Object.keys(result)).toEqual(['xx']);
    expect(result.xx).toHaveLength(1);
    expect(result.xx[0].url).toBe('/xx/read/1/');
  });

  test('fetch failures produce empty language arrays', async () => {
    const result = await buildSearchIndex({
      targetLangs: ['xx'],
      translations: { xx: { ...translations.xx, githubBase: 'http://127.0.0.1:1/' } },
      chapters,
      i18n: {},
      credits: { i18n: {}, categories: [] },
      fetcher: async () => {
        throw new Error('offline');
      },
    });
    expect(result.xx).toEqual([]);
  });
});
