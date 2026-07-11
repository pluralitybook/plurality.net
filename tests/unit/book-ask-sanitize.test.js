import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const bookAskPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../public/assets/js/book-ask.js'
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

  test('defines hideAsk for overlay close', () => {
    expect(source).toMatch(/function hideAsk/);
    expect(source).toMatch(/hideAsk:\s*hideAsk/);
  });

  test('local dev ask only on port 8080 (not CI serve 4321)', () => {
    expect(source).toMatch(/function isLocalDevAskHost/);
    expect(source).toMatch(/port === '8080'/);
  });

  test('initCapacity skips probe unless prod or local :8080', () => {
    expect(source).toMatch(/host !== 'plurality\.net'/);
    expect(source).toMatch(/host !== 'www\.plurality\.net'/);
  });
});
