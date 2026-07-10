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

test('falls back to the English corpus when primary-language retrieval is sparse', async () => {
  const ai = {
    async run() {
      return { data: [[0.1, 0.2, 0.3]] }
    },
  }
  const calls: string[] = []
  const vectorize = {
    async query(_vector: number[], options?: { filter?: Record<string, unknown> }) {
      const filterLang = (options?.filter as { lang?: { $eq?: string } } | undefined)?.lang?.$eq
      calls.push(filterLang ?? '')
      if (filterLang === 'ja') {
        return {
          matches: [
            {
              score: 0.2,
              metadata: {
                lang: 'ja',
                url: 'https://plurality.net/ja/read/6-1/',
                heading: 'ソーシャルメディア',
                content: 'The transparent society: will technology change us.',
              },
            },
          ],
        }
      }
      return {
        matches: [
          {
            score: 0.5,
            metadata: {
              lang: 'en',
              url: 'https://plurality.net/read/5-4/#tomorrow',
              heading: 'Conversations of Tomorrow',
              chapterTitle: 'Augmented Deliberation',
              content: 'Organizations like the Society Library collect available material…',
            },
          },
        ],
      }
    },
  }

  const chunks = await retrieveBookChunks(ai, vectorize, 'Society Library', 'ja')

  assert.deepEqual(calls, ['ja', 'en'])
  // En full-phrase exact outranks ja split-term exact despite primary flag
  assert.equal(chunks[0]?.metadata.lang, 'en')
  assert.match(chunks[0]?.metadata.content ?? '', /Society Library/)
})

test('sparse CJK retrieval falls back to English', async () => {
  const ai = {
    async run() {
      return { data: [[0.1, 0.2, 0.3]] }
    },
  }
  const calls: string[] = []
  const vectorize = {
    async query(_vector: number[], options?: { filter?: Record<string, unknown> }) {
      const filterLang = (options?.filter as { lang?: { $eq?: string } } | undefined)?.lang?.$eq
      calls.push(filterLang ?? '')
      if (filterLang === 'en') {
        return {
          matches: [
            {
              score: 0.6,
              metadata: {
                lang: 'en',
                url: 'https://plurality.net/read/6-1/',
                heading: 'Democracy',
                chapterTitle: 'Foundations',
                content: 'Democracy is rule by the people.',
              },
            },
          ],
        }
      }
      return {
        matches: [
          {
            score: 0.8,
            metadata: {
              lang: 'ja',
              url: 'https://plurality.net/ja/read/6-1/',
              heading: '民主主義の基礎',
              chapterTitle: '基礎',
              content: '民主主義に関する記述。',
            },
          },
        ],
      }
    },
  }

  const chunks = await retrieveBookChunks(ai, vectorize, '民主主義', 'ja')

  // Sparse (1 < 8) triggers en fallback even for CJK queries
  assert.deepEqual(calls, ['ja', 'en'])
  // Ja full-phrase exact outranks en fuzzy
  assert.equal(chunks.length, 2)
  assert.equal(chunks[0]?.metadata.lang, 'ja')
  assert.equal(chunks[1]?.metadata.lang, 'en')
})

test('does not query English when the primary language fills the cap', async () => {
  const ai = {
    async run() {
      return { data: [[0.1, 0.2, 0.3]] }
    },
  }
  let queryCalls = 0
  const vectorize = {
    async query(_vector: number[], options?: { topK?: number }) {
      queryCalls++
      assert.ok((options?.topK ?? 0) >= 8)
      const matches = []
      for (let i = 0; i < 9; i++) {
        matches.push({
          score: 0.8,
          metadata: {
            lang: 'ja',
            url: `https://plurality.net/ja/read/6-${i + 1}/`,
            heading: `見出し${i}`,
            chapterTitle: `章${i}`,
            content: `トラストに関する記述${i}。`,
          },
        })
      }
      return { matches }
    },
  }

  const chunks = await retrieveBookChunks(ai, vectorize, 'トラスト', 'ja')

  assert.equal(queryCalls, 1)
  assert.equal(chunks.length, 8)
})
