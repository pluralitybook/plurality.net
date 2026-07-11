import { describe, expect, test } from 'bun:test';
import {
  assetVersion,
  getChaptersByLanguage,
  getHomeLangs,
  getLocalizedPrefix,
  getNonEnglishLangs,
} from '../../src/lib/book-corpus.ts';

describe('book corpus helpers', () => {
  test('returns localized prefixes and home languages', () => {
    expect(getLocalizedPrefix('en')).toBe('');
    expect(getLocalizedPrefix('zh')).toBe('/zh');
    expect(getHomeLangs()).toContain('en');
    expect(getNonEnglishLangs()).toEqual(expect.arrayContaining(['zh', 'ja', 'th', 'el', 'de']));
  });

  test('filters chapters by language', () => {
    const ja = getChaptersByLanguage('ja');
    expect(ja.length).toBeGreaterThan(0);
    expect(ja.every((chapter) => chapter.lang === 'ja')).toBe(true);
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
