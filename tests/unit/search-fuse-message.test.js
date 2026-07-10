import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const searchPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../public/assets/js/search.js',
);
const source = readFileSync(searchPath, 'utf8');

describe('Fuse search copy', () => {
  test('Japanese result count says approximate matches, not literal matches', () => {
    expect(source).toContain('[SEARCH_TERM] に近い検索結果 [COUNT] 件');
  });

  test('Japanese exact-tier copy uses 完全一致 with [EXACT]', () => {
    expect(source).toContain('完全一致 [EXACT] 件');
  });

  test('Chinese exact-tier copy uses 完全符合 with [EXACT]', () => {
    expect(source).toContain('完全符合 [EXACT] 筆');
  });

  test('defines normalizeForExact and scanExact helpers', () => {
    expect(source).toMatch(/function normalizeForExact/);
    expect(source).toMatch(/function scanExact/);
  });

  test('fetches the English edition fallback index', () => {
    expect(source).toContain("fetch('/search-index.json')");
  });
});
