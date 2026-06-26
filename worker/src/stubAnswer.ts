/** Shown when Vectorize returns no chunks (gateway may still be configured). */
export function stubBookAnswer(question: string, lang: string): string {
  const q = question.trim()
  return [
    `I could not find passages in the Plurality book index that match your question (lang=${lang}).`,
    '',
    `You asked: **${q}**`,
    '',
    'Try a longer phrase, another language, or the keyword search below. Contributor names are listed on [Credits](/read/0-3/).',
    '',
    'If this keeps happening after a recent deploy, the book search index may need a refresh (`bun run vectorize:sync-book`).',
  ].join('\n')
}

export function textStream(body: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body))
      controller.close()
    },
  })
}