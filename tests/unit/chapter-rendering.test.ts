import { describe, expect, test } from 'vite-plus/test';
import { renderBookMarkdown } from '../../src/lib/markdown-renderer.ts';
import credits from '../../src/data/credits.json';
import i18n from '../../src/data/i18n.json';
import translations from '../../src/data/translations.json';
import {
  getFlatChapters,
  renderChapterBody,
  type ChapterEntry,
} from '../../src/lib/book-corpus.ts';

describe('renderChapterBody', () => {
  test('renders untranslated chapter placeholder with English and contribution links', async () => {
    const chapter = getFlatChapters().find((entry) => entry.lang === 'el' && entry.untranslated);
    expect(chapter).toBeDefined();
    const body = await renderChapterBody(chapter as ChapterEntry);
    expect(body).toContain(i18n.el.translation_in_progress);
    expect(body).toContain(`/read/${chapter?.id}/`);
    expect(body).toContain(translations.el.contributeUrl);
  });

  test('omits the contribution link when the translation has no contributeUrl', async () => {
    const entry: ChapterEntry = {
      id: '1',
      number: '1',
      title: 'Preface',
      titleEn: 'Preface',
      lang: 'zh',
      langLabel: '華文',
      file: '1-preface',
      sectionId: 'preface',
      sectionTitle: 'Preface',
      sectionColor: '#000',
      url: '/zh/read/1/',
      githubUrl: 'https://example.com/1-preface.md',
      localEndorsements: false,
      localCredits: false,
      untranslated: true,
      altLangs: [],
      prevChapter: null,
      nextChapter: null,
    };
    expect('contributeUrl' in translations.zh).toBe(false);
    const body = await renderChapterBody(entry);
    expect(body).toContain(i18n.zh.translation_in_progress);
    expect(body).not.toContain('<a href="undefined"');
    expect(body.match(/<p>/g)?.length).toBe(2);
  });

  test('renders no endorsements when the language has none registered', async () => {
    const entry: ChapterEntry = {
      id: '0-0',
      number: '0-0',
      title: 'Endorsements',
      titleEn: 'Endorsements',
      lang: 'xx' as ChapterEntry['lang'],
      langLabel: 'Fixture',
      file: '0-0-endorsements',
      sectionId: 'preface',
      sectionTitle: 'Preface',
      sectionColor: '#000',
      url: '/xx/read/0-0/',
      githubUrl: 'https://example.com/0-0-endorsements.md',
      localEndorsements: true,
      localCredits: false,
      untranslated: false,
      altLangs: [],
      prevChapter: null,
      nextChapter: null,
    };
    const body = await renderChapterBody(entry);
    expect(body).toBe('');
  });

  test('renders remote markdown with anchors and links', async () => {
    const chapter = getFlatChapters().find((entry) => entry.lang === 'en' && entry.id === '1');
    expect(chapter).toBeDefined();
    const body = await renderChapterBody(
      chapter as ChapterEntry,
      async () => '# Title\n\n## First\n\nBody with [link](https://example.com)'
    );
    expect(body).toContain('id="first"');
    expect(body).toContain('<a href="https://example.com">link</a>');
  });

  test('renders localized endorsements from local data', async () => {
    const chapter = getFlatChapters().find((entry) => entry.localEndorsements);
    expect(chapter).toBeDefined();
    const body = await renderChapterBody(chapter as ChapterEntry);
    expect(body).toContain('<blockquote>');
  });

  test('returns the unavailable paragraph when remote fetch fails without cache', async () => {
    const chapter = getFlatChapters().find((entry) => entry.lang === 'en' && entry.id === '1');
    expect(chapter).toBeDefined();
    const body = await renderChapterBody(chapter as ChapterEntry, async () => {
      throw new Error('offline');
    });
    expect(body).toBe(
      '<p class="muted"><em>Content is temporarily unavailable. Please revisit this page later.</em></p>'
    );
  });

  test('renders local credits with contributor names', async () => {
    const chapter = getFlatChapters().find((entry) => entry.lang === 'en' && entry.id === '0-3');
    expect(chapter).toBeDefined();
    const body = await renderChapterBody(chapter as ChapterEntry);
    expect(body).toContain('credits__intro');
    expect(body).toContain('credits__category');
    expect(body).toContain(credits.categories[0].contributors[0].name);
  });
});

test('renderBookMarkdown returns empty output for empty input', () => {
  expect(renderBookMarkdown('')).toBe('');
});
