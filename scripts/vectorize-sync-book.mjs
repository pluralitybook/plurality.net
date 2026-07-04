#!/usr/bin/env node
/**
 * Upsert Plurality book subsections into Vectorize `plurality-book` (bge-m3, 1024-dim).
 *   bun scripts/vectorize-sync-book.mjs   # uses wrangler login + wrangler auth token when unset
 *   CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… bun scripts/vectorize-sync-book.mjs
 *   LIMIT=50 DRY_RUN=1 bun scripts/vectorize-sync-book.mjs
 *
 * Prerequisite: wrangler vectorize create plurality-book --dimensions=1024 --metric=cosine
 * Metadata index lang BEFORE bulk upsert (not retroactive):
 *   wrangler vectorize create-metadata-index plurality-book --propertyName=lang --type=string
 * Script calls ensureLangMetadataIndex() before upsert.
 */
import { execSync } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextCached } from '../src/lib/remote-text-cache.ts'
import { buildSearchIndex } from '../src/lib/search-builder.ts'
import { chunkRecords } from './lib/vectorize-records.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const EMBED_MODEL = '@cf/baai/bge-m3'
const EMBED_DIM = 1024
const INDEX = process.env.VECTORIZE_INDEX ?? 'plurality-book'
const WRANGLER_CWD = path.join(ROOT, 'worker')
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity
const DRY_RUN = process.env.DRY_RUN === '1'
const BATCH = Math.min(32, Math.max(1, Number(process.env.EMBED_BATCH ?? '16')))

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data', name), 'utf8'))
}

function shellQuote(v) {
  return `'${String(v).replace(/'/g, `'\\''`)}'`
}


function resolveAccountId() {
  if (process.env.CLOUDFLARE_ACCOUNT_ID) return process.env.CLOUDFLARE_ACCOUNT_ID
  const json = execSync('npx wrangler whoami --json', {
    encoding: 'utf8',
    cwd: WRANGLER_CWD,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const payload = JSON.parse(json)
  const accountId = payload.accounts?.[0]?.id
  if (!accountId) {
    throw new Error('Could not resolve Cloudflare account id. Set CLOUDFLARE_ACCOUNT_ID.')
  }
  return accountId
}

function resolveApiToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN
  const output = execSync('npx wrangler auth token 2>/dev/null', {
    encoding: 'utf8',
    cwd: WRANGLER_CWD,
  })
  const candidates = output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length >= 20 && /^[\x21-\x7E]+$/.test(line))
  const token = candidates.at(-1)
  if (!token) {
    throw new Error('No Cloudflare API token. Run `wrangler login` or set CLOUDFLARE_API_TOKEN.')
  }
  return token
}

/** wrangler vectorize upsert: OAuth locally; token when CI or WRANGLER_USE_API_TOKEN=1 */
function buildWranglerEnvForUpsert() {
  const env = { ...process.env }
  const useApiToken =
    process.env.WRANGLER_USE_API_TOKEN === '1' ||
    process.env.GITHUB_ACTIONS === 'true' ||
    process.env.CI === 'true'
  if (!useApiToken) delete env.CLOUDFLARE_API_TOKEN
  return env
}

async function embedTexts(accountId, apiToken, texts) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${EMBED_MODEL}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
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
  execSync(cmd, { cwd: WRANGLER_CWD, env: buildWranglerEnvForUpsert(), stdio: 'inherit' })
}

function deleteVectors(ids) {
  if (ids.length === 0) return
  if (DRY_RUN) {
    console.log(`[dry-run] would delete ${ids.length} stale vector ids`)
    return
  }
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100)
    const quotedIds = batch.map(shellQuote).join(' ')
    const cmd = `npx wrangler vectorize delete-vectors ${shellQuote(INDEX)} --ids ${quotedIds}`
    execSync(cmd, { cwd: WRANGLER_CWD, env: buildWranglerEnvForUpsert(), stdio: 'inherit' })
  }
}

async function ensureLangMetadataIndex() {
  if (DRY_RUN) {
    console.log('[dry-run] would ensure metadata index on lang')
    return
  }
  const listCmd = `npx wrangler vectorize list-metadata-index ${shellQuote(INDEX)}`
  const createCmd =
    `npx wrangler vectorize create-metadata-index ${shellQuote(INDEX)} --propertyName=lang --type=string`
  const wranglerOpts = { cwd: WRANGLER_CWD, env: buildWranglerEnvForUpsert() }
  const langIndexListed = (out) => /\blang\b/.test(out) && /String/i.test(out)
  try {
    const list = execSync(listCmd, { ...wranglerOpts, encoding: 'utf8' })
    if (langIndexListed(list)) {
      console.log('metadata index lang: ready')
      return
    }
  } catch {
    /* try create */
  }
  console.log('creating metadata index lang (required for worker lang filter)…')
  execSync(createCmd, { ...wranglerOpts, stdio: 'inherit' })
  console.log('waiting for metadata index lang to become queryable…')
  for (let attempt = 0; attempt < 24; attempt++) {
    try {
      const list = execSync(listCmd, { ...wranglerOpts, encoding: 'utf8' })
      if (langIndexListed(list)) {
        console.log('metadata index lang: ready')
        return
      }
    } catch {
      /* retry */
    }
    await sleep(5000)
  }
  throw new Error('metadata index lang not ready after wait; retry sync later')
}


async function main() {
  const accountId = resolveAccountId()
  const apiToken = resolveApiToken()

  await ensureLangMetadataIndex()

  const chapters = loadJson('chapters.json')
  const translations = loadJson('translations.json')
  const i18n = loadJson('i18n.json')
  const credits = loadJson('credits.json')
  const targetLangs = Object.keys(translations)

  const fetcher = (url) => fetchTextCached(url)
  const indexByLang = await buildSearchIndex({
    targetLangs,
    translations,
    i18n,
    chapters,
    credits,
    fetcher,
  })

  let records = chunkRecords(indexByLang)
  if (Number.isFinite(LIMIT)) records = records.slice(0, LIMIT)
  console.log(`chunks to sync: ${records.length}`)
  const staleIds = Array.from(new Set(records.map((r) => r.replacesId).filter(Boolean)))
  deleteVectors(staleIds)
  if (records.length === 0) return

  const tmpDir = fs.mkdtempSync(path.join(ROOT, '.vectorize-sync-'))
  let done = 0
  for (let i = 0; i < records.length; i += BATCH) {
    const slice = records.slice(i, i + BATCH)
    const vectors = await embedTexts(accountId, apiToken, slice.map((r) => r.embedText))
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}