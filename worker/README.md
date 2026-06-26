# plurality-ask

Cloudflare Worker for Plurality book AI search (`ask.plurality.net`).

## Dependency

```bash
bun add @au/cf-ai-gateway
```

Vendored fallback: `file:vendor/au-cf-ai-gateway-0.1.0.tgz` (from `npm run pack:gateway` in askit-hono).

## Dev

```bash
cd worker && bun install && bun run dev && bun test
```

## Production (`ask.plurality.net`)

**Live (interim):** `https://plurality-ask.audreyt.workers.dev` — site `book-ask.js` points here until `ask.plurality.net` is a proxied name in Cloudflare (then uncomment `[[routes]]` in `wrangler.toml` and switch client URL).

1. **Vectorize** (once): `wrangler vectorize create plurality-book --dimensions=1024 --metric=cosine` ✅
2. **Metadata index** (once, before bulk upsert): `wrangler vectorize create-metadata-index plurality-book --propertyName=lang --type=string` ✅ (`bun run vectorize:sync-book` also ensures this)
3. **Index book** (repo root): `bun run vectorize:sync-book` — re-upsert all chunks after `lang` index exists (earlier vectors are not filterable retroactively)
4. **Secrets**: `wrangler secret put BASETEN_API_KEY` (✅); `CF_AIG_TOKEN` optional for gateway leg
5. **Deploy**: `cd worker && bunx wrangler deploy`
6. **Custom domain**: add `ask.plurality.net` DNS (proxied) in CF zone for `plurality.net`, uncomment route in `wrangler.toml`, redeploy.

Publish: `cd askit-hono && npm run publish:gateway`