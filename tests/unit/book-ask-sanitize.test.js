import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const bookAskPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../src/_includes/js/book-ask.js',
);
const source = readFileSync(bookAskPath, 'utf8');

describe('book-ask.js XSS hardening', () => {
  test('defines isSafeHttpUrl and sanitizeHtml', () => {
    expect(source).toMatch(/function isSafeHttpUrl/);
    expect(source).toMatch(/function sanitizeHtml/);
  });

  test('link markdown uses isSafeHttpUrl guard', () => {
    expect(source).toMatch(/https\?:/);
    expect(source).toMatch(/isSafeHttpUrl\(href\)/);
  });
});