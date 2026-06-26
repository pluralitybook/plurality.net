#!/usr/bin/env node
/**
 * Upsert Plurality book subsections into Vectorize `plurality-book` (bge-m3, 1024-dim).
 *
 *   CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… node scripts/vectorize-sync-book.mjs
 *   LIMIT=50 DRY_RUN=1 node scripts/vectorize-sync-book.mjs
 *
 * Prerequisite: wrangler vectorize create plurality-book --dimensions=1024 --metric=cosine
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import EleventyFetch from '@11ty/eleventy-fetch'
import { buildSearchIndex } from '../src/_data/lib/search-builder.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const EMBED_MODEL = '@cf/baai/bge-m3'
const EMBED_DIM = 1024
const INDEX = process.env.VECTORIZE_INDEX ?? 'plurality-book'
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID ?? ''
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN ?? ''
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity
const DRY_RUN = process.env.DRY_RUN === '1'
const BATCH = Math.min(32, Math.max(1, Number(process.env.EMBED_BATCH ?? '16')))
const CONTENT_MAX = 1800

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'src/_data', name), 'utf8'))
}

function truncate(s, max) {
  const t = String(s).trim()
  return t.length <= max ? t : t.slice(0, max)
}

function shellQuote(v) {
  return `'${String(v).replace(/'/g, `'\\''`)}'`
}

async function embedTexts(texts) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${EMBED_MODEL}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: texts }),
  })
  if (!res.ok) throw new Error(`embed HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const json = await res.json()
  const data = json.result?.data ?? json.data
  if (!Array.isArray(data) || data.length !== texts.length) {
    throw new Error('embed count mismatch')
  }
  return data
}

function upsertNdjson(filePath) {
  const cmd =
    `npx wrangler vectorize upsert ${shellQuote(INDEX)} ` +
    `--file ${shellQuote(filePath)} --batch-size 100`
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' })
}

function chunkRecords(indexByLang) {
  const records = []
  for (const [lang, chapters] of Object.entries(indexByLang)) {
    for (const ch of chapters) {
      const baseUrl = ch.url.startsWith('http')
        ? ch.url
        : `https://plurality.net${ch.url}`
      for (const sub of ch.subsections || []) {
        const anchor = sub.anchor ? `#${sub.anchor}` : ''
        const heading = sub.heading || ch.title
        const id = `${lang}:${baseUrl}${anchor}:${sub.anchor || 'intro'}`
        const content = truncate(sub.content || '', CONTENT_MAX)
        if (!content) continue
        records.push({
          id,
          lang,
          url: `${baseUrl}${anchor}`,
          heading,
          chapterTitle: ch.title,
          content,
          embedText: `${heading}\n${content}`,
        })
      }
    }
  }
  return records
}

async function main() {
  if (!ACCOUNT_ID || !API_TOKEN) {
    console.error('Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN')
    process.exit(1)
  }

  const chapters = loadJson('chapters.json')
  const translations = loadJson('translations.json')
  const i18n = loadJson('i18n.json')
  const targetLangs = Object.keys(translations)

  const fetcher = (url) => EleventyFetch(url, { duration: '1d', type: 'text' })
  const indexByLang = await buildSearchIndex({
    targetLangs,
    translations,
    i18n,
    chapters,
    fetcher,
  })

  let records = chunkRecords(indexByLang)
  if (Number.isFinite(LIMIT)) records = records.slice(0, LIMIT)
  console.log(`chunks to sync: ${records.length}`)
  if (records.length === 0) return

  const tmpDir = fs.mkdtempSync(path.join(ROOT, '.vectorize-sync-'))
  let done = 0
  for (let i = 0; i < records.length; i += BATCH) {
    const slice = records.slice(i, i + BATCH)
    const vectors = await embedTexts(slice.map((r) => r.embedText))
    const lines = []
    for (let j = 0; j < slice.length; j++) {
      const r = slice[j]
      const values = vectors[j]
      if (!Array.isArray(values) || values.length !== EMBED_DIM) {
        throw new Error(`bad vector dim for ${r.id}`)
      }
      lines.push(
        JSON.stringify({
          id: r.id,
          values,
          metadata: {
            lang: r.lang,
            url: r.url,
            heading: r.heading,
            chapterTitle: r.chapterTitle,
            content: r.content,
          },
        }),
      )
    }
    const ndjson = path.join(tmpDir, `batch-${i}.ndjson`)
    fs.writeFileSync(ndjson, lines.join('\n'))
    if (DRY_RUN) {
      console.log(`[dry-run] would upsert ${slice.length} → ${ndjson}`)
    } else {
      upsertNdjson(ndjson)
      console.log(`upserted ${(done += slice.length)} / ${records.length}`)
    }
  }
  fs.rmSync(tmpDir, { recursive: true, force: true })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})