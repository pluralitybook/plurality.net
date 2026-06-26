export const BOOK_EMBEDDING_MODEL = '@cf/baai/bge-m3'
export const BOOK_EMBEDDING_DIM = 1024
export const VECTORIZE_INDEX_NAME = 'plurality-book'
export const DEFAULT_TOP_K = 4
export const DEFAULT_MIN_SCORE = 0.35
const METADATA_CONTENT_MAX = 1200

export type BookChunkMetadata = {
  lang: string
  url: string
  heading: string
  chapterTitle: string
  content: string
}

export type BookChunk = {
  id: string
  metadata: BookChunkMetadata
}

export type VectorizeBinding = {
  query: (
    vector: number[],
    options?: {
      topK?: number
      returnMetadata?: 'none' | 'indexed' | 'all'
      filter?: Record<string, unknown>
    },
  ) => Promise<{
    matches?: Array<{ score: number; metadata?: Record<string, unknown> }>
  }>
}

type AiBinding = {
  run: (model: string, input: Record<string, unknown>) => Promise<unknown>
}

function extractEmbedding(result: unknown): number[] | null {
  if (!result || typeof result !== 'object') return null
  const obj = result as Record<string, unknown>
  const data = obj.data ?? (obj.result as Record<string, unknown> | undefined)?.data
  if (!Array.isArray(data) || data.length === 0) return null
  const first = data[0]
  if (Array.isArray(first)) return first as number[]
  if (typeof first === 'number') return data as number[]
  return null
}
function metadataToChunk(meta: Record<string, unknown> | undefined): BookChunk | null {
  if (!meta) return null
  const lang = typeof meta.lang === 'string' ? meta.lang : ''
  const url = typeof meta.url === 'string' ? meta.url : ''
  const content = typeof meta.content === 'string' ? meta.content : ''
  const heading = typeof meta.heading === 'string' ? meta.heading : ''
  const chapterTitle =
    typeof meta.chapterTitle === 'string' ? meta.chapterTitle : ''
  if (!lang || !url || !content.trim()) return null
  const id =
    typeof meta.id === 'string'
      ? meta.id
      : `${lang}:${url}:${heading || 'intro'}`
  return {
    id,
    metadata: { lang, url, heading, chapterTitle, content },
  }
}

export async function embedQuery(
  ai: AiBinding,
  question: string,
): Promise<number[] | null> {
  const text = question.trim()
  if (!text) return null
  try {
    const result = await ai.run(BOOK_EMBEDDING_MODEL, { text: [text] })
    return extractEmbedding(result)
  } catch (e) {
    console.error('book embed query failed', e)
    return null
  }
}

export async function retrieveBookChunks(
  ai: AiBinding,
  vectorize: VectorizeBinding,
  question: string,
  lang: string,
  options?: { topK?: number; minScore?: number },
): Promise<BookChunk[]> {
  const topK = Math.min(8, Math.max(1, options?.topK ?? DEFAULT_TOP_K))
  const minScore = options?.minScore ?? DEFAULT_MIN_SCORE
  const embedding = await embedQuery(ai, question)
  if (!embedding?.length) return []

  let matches: Array<{ score: number; metadata?: Record<string, unknown> }> = []
  try {
    const result = await vectorize.query(embedding, {
      topK,
      returnMetadata: 'all',
      filter: { lang: { $eq: lang } },
    })
    matches = result.matches ?? []
  } catch (e) {
    console.error('vectorize query failed', e)
    return []
  }

  const out: BookChunk[] = []
  const seen = new Set<string>()
  for (const m of matches) {
    if (!Number.isFinite(m.score) || m.score < minScore) continue
    const chunk = metadataToChunk(m.metadata)
    if (!chunk || seen.has(chunk.id)) continue
    seen.add(chunk.id)
    out.push(chunk)
  }
  return out
}

export function truncateForMetadata(content: string, max = METADATA_CONTENT_MAX): string {
  const t = content.trim()
  if (t.length <= max) return t
  return t.slice(0, max)
}