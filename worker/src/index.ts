import { Hono } from 'hono'
import { createAskCors } from '@au/cf-ai-gateway'
import { resolveQueryLang } from './lang'
import { stubBookAnswer, textStream } from './stubAnswer'

export type Env = {
  AUDREY_MODEL?: string
  BASETEN_API_KEY?: string
  CF_AIG_TOKEN?: string
  CF_AI_GATEWAY_ACCOUNT_ID?: string
  CF_AI_GATEWAY_ID?: string
  BASETEN_MODEL?: string
}

const MAX_QUESTION_CHARS = 100

const askCors = createAskCors({
  allowedOrigins: [
    'https://plurality.net',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
  ],
})

function decodeRouteParam(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function isQuestionTooLong(question: string): boolean {
  return [...question.trim()].length > MAX_QUESTION_CHARS
}

const app = new Hono<{ Bindings: Env }>()

app.options('/au/:question', (c) => askCors.preflight(c.req.raw))
app.options('/capacity', (c) => askCors.preflight(c.req.raw))

app.get('/capacity', (c) => {
  const res = c.json({ status: 'available' as const }, 200, {
    'Cache-Control': 'public, max-age=5, s-maxage=5',
  })
  return askCors.apply(c.req.raw, res)
})

app.get('/au/:question', (c) => {
  const lang = resolveQueryLang(c.req.query('lang'))
  const question = decodeRouteParam(c.req.param('question')).trim()
  if (!question) {
    return askCors.apply(c.req.raw, c.text('Missing question.', 400))
  }
  if (isQuestionTooLong(question)) {
    return askCors.apply(
      c.req.raw,
      c.text('Question too long (max 100 characters).', 400),
    )
  }

  const body = stubBookAnswer(question, lang)
  const res = new Response(textStream(body), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
  return askCors.apply(c.req.raw, res)
})

app.get('/', (c) => c.text('plurality-ask worker'))

export default app