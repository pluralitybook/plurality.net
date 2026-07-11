import assert from 'node:assert/strict'
import test from 'node:test'
import { bookCitationFootnotes } from '../src/bookCitationFootnotes'

async function streamToString(stream: ReadableStream<string>): Promise<string> {
  const reader = stream.getReader()
  let out = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    out += value
  }
  return out
}

void test('bookCitationFootnotes rewrites [n] to caret', async () => {
  const input = new ReadableStream<string>({
    start(c) {
      c.enqueue('Answer [1] and [2].')
      c.close()
    },
  })
  const footnotes = [
    '[Seeing Plural](https://plurality.net/read/1/)',
    '[Mobilization](https://plurality.net/read/7-1/)',
  ]
  const out = await streamToString(
    input.pipeThrough(bookCitationFootnotes(footnotes)),
  )
  assert.match(out, /\[\^1\]/)
  assert.match(out, /\[\^2\]: \[Mobilization\]/)
})

void test('bookCitationFootnotes appends all source defs', async () => {
  const input = new ReadableStream<string>({
    start(c) {
      c.enqueue('No numeric cite.')
      c.close()
    },
  })
  const footnotes = ['[A](https://plurality.net/a)']
  const out = await streamToString(
    input.pipeThrough(bookCitationFootnotes(footnotes)),
  )
  assert.match(out, /\[\^1\]: \[A\]\(https:\/\/plurality\.net\/a\)/)
})