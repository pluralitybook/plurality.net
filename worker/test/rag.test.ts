import assert from 'node:assert/strict'
import test from 'node:test'
import { streamBookAnswer } from '../src/rag'

void test('streamBookAnswer without bindings returns stub stream', async () => {
  const res = await streamBookAnswer({}, 'hello', 'en')
  assert.equal(res.status, 200)
  const text = await res.text()
  assert.match(text, /hello/)
})