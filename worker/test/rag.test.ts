import assert from 'node:assert/strict'
import test from 'node:test'
import { streamBookAnswer } from '../src/rag'
import { BOOK_EMBEDDING_MODEL } from '../src/vectorize'

void test('streamBookAnswer without bindings returns stub stream', async () => {
  const res = await streamBookAnswer({}, 'hello', 'en')
  assert.equal(res.status, 200)
  const text = await res.text()
  assert.match(text, /hello/)
})

void test('gateway env without CF_AIG_TOKEN degrades to HTTP 200 retrieval excerpt', async () => {
  const env = {
    AUDREY_MODEL: 'nemotron-ultra',
    CF_AI_GATEWAY_ACCOUNT_ID: 'test-account',
    CF_AI_GATEWAY_ID: 'test-gateway',
    AI: {
      async run() {
        return { data: [[0.1, 0.2, 0.3]] }
      },
    },
    BOOK_VECTORIZE: {
      async query(_vector: number[], _options?: { topK?: number }) {
        return {
          matches: [
            {
              score: 0.42,
              metadata: {
                lang: 'en',
                url: 'https://plurality.net/en/read/1-1/#beyond-the-default',
                heading: 'Beyond the Default',
                chapterTitle: 'Introduction',
                content: 'Plurality is about augmenting democracy with technology.',
              },
            },
          ],
        }
      },
    },
  }
  const res = await streamBookAnswer(env, 'what is plurality', 'en')
  assert.equal(res.status, 200)
  assert.match(res.headers.get('Content-Type') ?? '', /text\/plain/)
  const text = await res.text()
  assert.match(text, /No AI gateway configured; showing retrieved excerpts/)
  assert.match(text, /Plurality is about augmenting democracy with technology\./)
})

function sseStream(deltas: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const events = deltas.map(
    (content) =>
      `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`,
  )
  events.push('data: [DONE]\n\n')
  return new ReadableStream({
    start(controller) {
      for (const event of events) controller.enqueue(encoder.encode(event))
      controller.close()
    },
  })
}

const TEST_VECTORIZE = {
  async query(_vector: number[], _options?: { topK?: number }) {
    return {
      matches: [
        {
          score: 0.42,
          metadata: {
            lang: 'en',
            url: 'https://plurality.net/en/read/1-1/#beyond-the-default',
            heading: 'Beyond the Default',
            chapterTitle: 'Introduction',
            content: 'Plurality is about augmenting democracy with technology.',
          },
        },
      ],
    }
  },
}

function testAi(chatDeltas: string[], chatRuns: string[] = []) {
  return {
    async run(model: string, input: Record<string, unknown>) {
      if (model === BOOK_EMBEDDING_MODEL) {
        return { data: [[0.1, 0.2, 0.3]] }
      }
      chatRuns.push(model)
      return sseStream(chatDeltas)
    },
  }
}

void test('AUDREY_MODEL @cf/... generates on the Workers AI binding instead of the stub', async () => {
  const chatRuns: string[] = []
  const env = {
    AUDREY_MODEL: '@cf/deepseek-ai/deepseek-v4-flash-0731',
    CF_AI_GATEWAY_ACCOUNT_ID: 'test-account',
    CF_AI_GATEWAY_ID: 'test-gateway',
    AI: testAi(['Plurality is about ', 'augmenting democracy [1].'], chatRuns),
    BOOK_VECTORIZE: TEST_VECTORIZE,
  }
  const res = await streamBookAnswer(env, 'what is plurality', 'en')
  assert.equal(res.status, 200)
  assert.match(res.headers.get('Content-Type') ?? '', /text\/plain/)
  assert.equal(res.headers.get('X-Accel-Buffering'), 'no')
  const text = await res.text()
  assert.doesNotMatch(text, /No AI gateway configured/)
  assert.match(text, /Plurality is about augmenting democracy \[\^1\]/)
  assert.match(
    text,
    /\[\^1\]: \[Beyond the Default\]\(https:\/\/plurality\.net\/en\/read\/1-1\/#beyond-the-default\)/,
  )
  assert.deepEqual(chatRuns, ['@cf/deepseek-ai/deepseek-v4-flash-0731'])
})

void test('unset AUDREY_MODEL without gateway token still degrades to HTTP 200 retrieval excerpt', async () => {
  const chatRuns: string[] = []
  const env = {
    CF_AI_GATEWAY_ACCOUNT_ID: 'test-account',
    CF_AI_GATEWAY_ID: 'test-gateway',
    AI: testAi([], chatRuns),
    BOOK_VECTORIZE: TEST_VECTORIZE,
  }
  const res = await streamBookAnswer(env, 'what is broad listening', 'en')
  assert.equal(res.status, 200)
  assert.match(res.headers.get('Content-Type') ?? '', /text\/plain/)
  const text = await res.text()
  assert.match(text, /No AI gateway configured; showing retrieved excerpts/)
  assert.match(text, /Plurality is about augmenting democracy with technology\./)
  assert.deepEqual(chatRuns, [])
})

void test('nemotron-ultra still selects the AI Gateway over the Workers AI binding', async () => {
  const chatRuns: string[] = []
  const originalFetch = globalThis.fetch
  const fetchUrls: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    fetchUrls.push(String(input))
    return new Response(sseStream(['Nemotron via gateway [1].']), {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }) as typeof fetch
  try {
    const env = {
      AUDREY_MODEL: 'nemotron-ultra',
      CF_AIG_TOKEN: 'test-aig-token',
      CF_AI_GATEWAY_ACCOUNT_ID: 'test-account',
      CF_AI_GATEWAY_ID: 'test-gateway',
      AI: testAi([], chatRuns),
      BOOK_VECTORIZE: TEST_VECTORIZE,
    }
    const res = await streamBookAnswer(env, 'what is plurality', 'en')
    assert.equal(res.status, 200)
    const text = await res.text()
    assert.doesNotMatch(text, /No AI gateway configured/)
    assert.match(text, /Nemotron via gateway \[\^1\]/)
    assert.deepEqual(chatRuns, [])
    assert.equal(fetchUrls.length, 1)
    assert.match(fetchUrls[0], /gateway\.ai\.cloudflare\.com/)
  } finally {
    globalThis.fetch = originalFetch
  }
})