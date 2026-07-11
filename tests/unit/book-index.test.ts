import { describe, expect, test } from 'bun:test';
import { getBookIndex } from '../../src/lib/book-corpus.ts';

describe('getBookIndex', () => {
  test('parses English from the provided fetcher and merges local indexes', async () => {
    const result = await getBookIndex(async () => '```\nAlpha\t1\nBeta\t2\n```\n');
    expect(result.en).toEqual(['Alpha', 'Beta']);
    expect(Array.isArray(result.zh)).toBe(true);
    expect(Array.isArray(result.ja)).toBe(true);
  });

  test('swallows fetcher errors and yields en=[] while preserving local indexes', async () => {
    const result = await getBookIndex(async () => {
      throw new Error('offline');
    });
    expect(result.en).toEqual([]);
    expect(Array.isArray(result.de)).toBe(true);
  });
});
