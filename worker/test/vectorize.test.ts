import assert from 'node:assert/strict'
import test from 'node:test'
import { retrieveBookChunks } from '../src/vectorize'

test('retrieveBookChunks keeps and prioritizes exact query term matches below semantic threshold', async () => {
  const ai = {
    async run() {
      return { data: [[0.1, 0.2, 0.3]] }
    },
  }
  const vectorize = {
    async query(_vector: number[], options?: { topK?: number }) {
      assert.ok((options?.topK ?? 0) >= 8)
      return {
        matches: [
          {
            score: 0.381,
            metadata: {
              lang: 'ja',
              url: 'https://plurality.net/ja/read/6-1/#trust-fall',
              heading: '社内起業精神の支援',
              chapterTitle: '信頼',
              content: 'トラストフォールというチームビルディング活動。',
            },
          },
          {
            score: 0.349,
            metadata: {
              lang: 'ja',
              url: 'https://plurality.net/ja/read/5-4/#limits',
              heading: '拡張熟議の限界',
              chapterTitle: '拡張熟議',
              content: 'アンドリュー・トラスクは熟議の限界について述べている。',
            },
          },
        ],
      }
    },
  }

  const chunks = await retrieveBookChunks(ai, vectorize, 'トラスク', 'ja')

  assert.equal(chunks[0]?.metadata.heading, '拡張熟議の限界')
  assert.match(chunks[0]?.metadata.content ?? '', /トラスク/)
})
