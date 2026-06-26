/** Phase 2 stub; Phase 3 replaces with Vectorize RAG + gateway generation. */
export function stubBookAnswer(question: string, lang: string): string {
  const q = question.trim()
  return [
    `*(Plurality book search — stub RAG; lang=${lang})*`,
    '',
    `You asked: **${q}**`,
    '',
    'Phase 3 will retrieve same-language chunks from `plurality-book` and answer via Nemotron + CF AI Gateway.',
    '',
    'Example citation: [1](https://plurality.net/' + lang + '/read/introduction/)',
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