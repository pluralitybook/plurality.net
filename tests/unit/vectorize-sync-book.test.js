import { describe, expect, test } from 'vite-plus/test';

const modulePath = '../../scripts/lib/vectorize-records.mjs';

describe('vectorize sync chunking', () => {
  test('keeps tail terms by splitting long subsections into multiple vector records', async () => {
    const { chunkRecords } = await import(modulePath);
    const content = `${'前文'.repeat(900)} アンドリュー・トラスク ${'後文'.repeat(300)}`;

    const records = chunkRecords({
      ja: [
        {
          title: '拡張熟議',
          url: '/ja/read/5-4/',
          subsections: [
            {
              heading: '拡張熟議の限界',
              anchor: 'limits',
              content,
            },
          ],
        },
      ],
    });

    expect(records.length).toBeGreaterThan(1);
    expect(records.some((record) => record.content.includes('トラスク'))).toBe(true);
    expect(records.every((record) => record.content.length <= 1800)).toBe(true);
    expect(new Set(records.map((record) => record.id)).size).toBe(records.length);
    expect(records[0].replacesId).toBeTruthy();
    expect(records.map((record) => record.id)).not.toContain(records[0].replacesId);
  });

  test('splits long paragraphs and packs shorter paragraphs without overflow', async () => {
    const { chunkRecords } = await import(modulePath);
    const longParagraph = '長'.repeat(1900);
    const records = chunkRecords({
      ja: [
        {
          title: '章',
          url: 'https://plurality.net/ja/read/x/',
          subsections: [
            {
              heading: '',
              anchor: '',
              content: `${'短'.repeat(100)}\n\n${longParagraph}\n\n${'後'.repeat(1700)}\n\n${'末'.repeat(200)}`,
            },
          ],
        },
      ],
    });

    expect(records.map((record) => record.content.length)).toEqual([100, 1800, 220, 1700, 200]);
    expect(records.every((record) => record.content.length <= 1800)).toBe(true);
    expect(records[0].heading).toBe('章');
    expect(records[0].url).toBe('https://plurality.net/ja/read/x/');
  });
});

test('handles empty and missing subsection content without records', async () => {
  const { chunkRecords } = await import(modulePath);
  expect(
    chunkRecords({
      en: [
        { title: 'x', url: '/x', subsections: [{ content: '   ' }, {}] },
        { title: 'y', url: '/y' },
      ],
    })
  ).toEqual([]);
});

test('uses single chunk identity and multi-chunk replacement ids', async () => {
  const { chunkRecords } = await import(modulePath);
  const one = chunkRecords({
    en: [{ title: 'x', url: '/x', subsections: [{ content: 'short' }] }],
  });
  expect(one[0].replacesId).toBe('');

  const many = chunkRecords({
    en: [{ title: 'x', url: '/x', subsections: [{ content: 'a'.repeat(2000) }] }],
  });
  expect(many.map((r) => r.logicalId)).toEqual([
    'en:https://plurality.net/x:intro:1',
    'en:https://plurality.net/x:intro:2',
  ]);
  expect(new Set(many.map((r) => r.id)).size).toBe(many.length);
  expect(new Set(many.map((r) => r.replacesId)).size).toBe(1);
  expect(many[0].replacesId).toBeTruthy();
});

test('chunks a leading oversized paragraph without a current chunk', async () => {
  const { chunkRecords } = await import(modulePath);
  const records = chunkRecords({
    en: [{ title: 'x', url: '/x', subsections: [{ content: 'z'.repeat(2000) }] }],
  });
  expect(records.length).toBeGreaterThan(1);
});
