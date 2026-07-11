import { describe, expect, test } from 'vite-plus/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const bookAskPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../public/assets/js/book-ask.js'
);
const source = readFileSync(bookAskPath, 'utf8');

describe('book-ask.js ask history', () => {
  test('uses a versioned sessionStorage key', () => {
    expect(source).toContain('plurality-ask-history-v1');
  });

  test('defines saveToHistory and renderHistory', () => {
    expect(source).toMatch(/function saveToHistory/);
    expect(source).toMatch(/function renderHistory/);
  });

  test('persists to sessionStorage', () => {
    expect(source).toContain('sessionStorage');
  });

  test('chip restore dispatches plurality-search-after-ask', () => {
    // Scoped to the delegated click handler, not the Enter keydown path
    // which also dispatches the same event.
    expect(source).toMatch(/renderAsk\(entry\.raw[\s\S]*plurality-search-after-ask/);
  });
});
