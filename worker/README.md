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

1. **Vectorize** (once): `wrangler vectorize create plurality-book --dimensions=1024 --metric=cosine`
2. **Index book** (repo root): `CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… bun run vectorize:sync-book`
3. **Secrets**: `wrangler secret put BASETEN_API_KEY` and `CF_AIG_TOKEN`
4. **Deploy**: `cd worker && wrangler deploy`
5. **DNS** (Cloudflare zone for `plurality.net`): `ask` → Worker route `ask.plurality.net/*` (Workers dashboard: Triggers → Routes, or wrangler `[[routes]]` in `wrangler.toml`).

HTTP **526** on `ask.plurality.net` means the hostname has no healthy Worker origin — complete steps 4–5. Until then, the site loads but `/capacity` fails CORS.

Publish: `cd askit-hono && npm run publish:gateway`