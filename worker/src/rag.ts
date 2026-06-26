import {
  openAiChatCompletionsEventStreamToText,
  resolveAudreyAiGateway,
  streamViaGatewayChatCompletions,
  type AudreyGatewayEnv,
} from '@au/cf-ai-gateway'
import { stubBookAnswer, textStream } from './stubAnswer'
import {
  retrieveBookChunks,
  type BookChunk,
  type VectorizeBinding,
} from './vectorize'

type AiBinding = {
  run: (model: string, input: Record<string, unknown>) => Promise<unknown>
}

const LANG_INSTRUCTION: Record<string, string> = {
  en: 'Answer in English. Cite book excerpts with markdown footnotes [1], [2] matching the Sources list.',
  zh: '請用繁體中文作答。以 [1]、[2] 標註引註，對應下方來源列表。',
  ja: '日本語で回答してください。[1]、[2] の形式で出典を示してください。',
  de: 'Antworten Sie auf Deutsch. Zitieren Sie mit [1], [2] gemäß der Quellenliste.',
  th: 'ตอบเป็นภาษาไทย อ้างอิงด้วย [1], [2] ตามรายการแหล่งที่มา',
  el: 'Απαντήστε στα ελληνικά. Παραπομπές [1], [2] σύμφωνα με τις πηγές.',
}

function buildMessages(
  question: string,
  chunks: BookChunk[],
  lang: string,
): Array<{ role: string; content: string }> {
  const cite = chunks
    .map((c, i) => {
      const label = c.metadata.heading || c.metadata.chapterTitle || 'Section'
      return `[${i + 1}] ${label}\nURL: ${c.metadata.url}\n${c.metadata.content}`
    })
    .join('\n\n')
  const instruction =
    LANG_INSTRUCTION[lang] ?? LANG_INSTRUCTION.en
  return [
    {
      role: 'system',
      content:
        'You are a helpful assistant for the Plurality book. Answer only from the excerpts. Be concise. If excerpts are insufficient, say so briefly.',
    },
    {
      role: 'user',
      content: `${instruction}\n\nQuestion: ${question}\n\nExcerpts:\n${cite}`,
    },
  ]
}

function retrievalStubMarkdown(
  question: string,
  lang: string,
  chunks: BookChunk[],
): string {
  const lines = [
    `*(No AI gateway configured; showing retrieved excerpts — lang=${lang})*`,
    '',
    `**${question.trim()}**`,
    '',
  ]
  chunks.forEach((c, i) => {
    const label = c.metadata.heading || c.metadata.chapterTitle
    lines.push(`[${i + 1}] [${label}](${c.metadata.url})`)
    lines.push('')
    lines.push(c.metadata.content.slice(0, 400) + (c.metadata.content.length > 400 ? '…' : ''))
    lines.push('')
  })
  return lines.join('\n')
}

export async function streamBookAnswer(
  env: AudreyGatewayEnv & {
    AI?: AiBinding
    BOOK_VECTORIZE?: VectorizeBinding
  } | undefined,
  question: string,
  lang: string,
): Promise<Response> {
  const bindings = env ?? {}
  const ai = bindings.AI
  const vectorize = bindings.BOOK_VECTORIZE
  let chunks: BookChunk[] = []
  if (ai && vectorize) {
    chunks = await retrieveBookChunks(ai, vectorize, question, lang)
  }
  const gateway = resolveAudreyAiGateway(bindings)
  if (!gateway || gateway.kind !== 'chat') {
    const body =
      chunks.length > 0
        ? retrievalStubMarkdown(question, lang, chunks)
        : stubBookAnswer(question, lang)
    return new Response(textStream(body), {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  }

  if (chunks.length === 0) {
    const body = stubBookAnswer(question, lang)
    return new Response(textStream(body), {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  }

  if (!ai) {
    const body = retrievalStubMarkdown(question, lang, chunks)
    return new Response(textStream(body), {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  const messages = buildMessages(question, chunks, lang)
  const byteStream = await streamViaGatewayChatCompletions(
    gateway.config,
    messages,
    2048,
  )
  const textStreamOut = byteStream
    .pipeThrough(openAiChatCompletionsEventStreamToText())
    .pipeThrough(new TextEncoderStream())

  return new Response(textStreamOut, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}