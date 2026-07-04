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
});
