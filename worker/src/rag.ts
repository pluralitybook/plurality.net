import {
  DEFAULT_NEMOTRON_MAX_COMPLETION_TOKENS,
  DEFAULT_NEMOTRON_ULTRA_BASETEN_MODEL,
  openAiChatCompletionsEventStreamToText,
  resolveAudreyAiGateway,
  streamViaDirectBasetenChatCompletions,
  streamViaGatewayChatCompletions,
  type AudreyGatewayEnv,
} from '@au/cf-ai-gateway'
import { bookCitationFootnotes } from './bookCitationFootnotes'
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
  en: 'Answer in English. Cite excerpts with markdown footnote references [^1], [^2] (caret form only; do not paste URLs).',
  zh: '請用繁體中文作答。以 [^1]、[^2] 標註引註（僅用此格式，勿貼網址）。',
  ja: '日本語で回答してください。出典は [^1]、[^2] の形式のみ（URLは書かない）。',
  de: 'Antworten Sie auf Deutsch. Zitieren Sie mit [^1], [^2] (nur diese Form, keine URLs).',
  th: 'ตอบเป็นภาษาไทย อ้างอิงด้วย [^1], [^2] เท่านั้น (ไม่ใส่ URL)',
  el: 'Απαντήστε στα ελληνικά. Παραπομπές [^1], [^2] μόνο (χωρίς URLs).',
}


function chunkFootnoteLabel(c: BookChunk): string {
  return c.metadata.heading || c.metadata.chapterTitle || 'Section'
}

function footnoteDefsFromChunks(chunks: BookChunk[]): string {
  return chunks
    .map((c, i) => `[^${i + 1}]: [${chunkFootnoteLabel(c)}](${c.metadata.url})`)
    .join('\n')
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
    const label = chunkFootnoteLabel(c)
    lines.push(`[^${i + 1}] **${label}**`)
    lines.push('')
    lines.push(c.metadata.content.slice(0, 400) + (c.metadata.content.length > 400 ? '…' : ''))
    lines.push('')
  })
  if (chunks.length > 0) {
    lines.push('')
    lines.push(footnoteDefsFromChunks(chunks))
  }
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
  const basetenKey = bindings.BASETEN_API_KEY?.trim()
  const basetenModel =
    bindings.BASETEN_MODEL?.trim() || DEFAULT_NEMOTRON_ULTRA_BASETEN_MODEL

  async function nemotronByteStream(): Promise<ReadableStream<Uint8Array>> {
    if (basetenKey && !gateway.config.gatewayAuthToken) {
      return streamViaDirectBasetenChatCompletions(basetenKey, basetenModel, messages, DEFAULT_NEMOTRON_MAX_COMPLETION_TOKENS)
    }
    if (gateway.config.gatewayAuthToken) {
      return streamViaGatewayChatCompletions(gateway.config, messages, DEFAULT_NEMOTRON_MAX_COMPLETION_TOKENS)
    }
    if (basetenKey) {
      return streamViaDirectBasetenChatCompletions(basetenKey, basetenModel, messages, DEFAULT_NEMOTRON_MAX_COMPLETION_TOKENS)
    }
    return streamViaGatewayChatCompletions(gateway.config, messages, DEFAULT_NEMOTRON_MAX_COMPLETION_TOKENS)
  }

  try {
    const byteStream = await nemotronByteStream()
    const footnotes = chunks.map((c) => {
      const label = c.metadata.heading || c.metadata.chapterTitle || 'Section'
      return `[${label}](${c.metadata.url})`
    })
    const textStreamOut = byteStream
      .pipeThrough(openAiChatCompletionsEventStreamToText())
      .pipeThrough(bookCitationFootnotes(footnotes))
      .pipeThrough(new TextEncoderStream())

    return new Response(textStreamOut, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (e) {
    console.error('nemotron stream failed', e)
    if (basetenKey) {
      try {
        const byteStream = await streamViaDirectBasetenChatCompletions(
          basetenKey,
          basetenModel,
          messages,
          DEFAULT_NEMOTRON_MAX_COMPLETION_TOKENS,
        )
        const footnotes = chunks.map((c) => {
          const label = c.metadata.heading || c.metadata.chapterTitle || 'Section'
          return `[${label}](${c.metadata.url})`
        })
        const textStreamOut = byteStream
          .pipeThrough(openAiChatCompletionsEventStreamToText())
          .pipeThrough(bookCitationFootnotes(footnotes))
          .pipeThrough(new TextEncoderStream())
        return new Response(textStreamOut, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Accel-Buffering': 'no',
          },
        })
      } catch (e2) {
        console.error('direct baseten fallback failed', e2)
      }
    }
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
}