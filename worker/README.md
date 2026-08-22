# plurality-ask

Cloudflare Worker for Plurality book AI search (`ask.plurality.net`).

## Dependency

`@au/cf-ai-gateway` is vendored as a tarball (npm publish is currently unavailable):

```bash
# package.json: "@au/cf-ai-gateway": "file:vendor/au-cf-ai-gateway-0.3.0.tgz"
bun install
```

The tarball comes from `npm run pack:gateway` in askit-hono; drop in a new version by replacing `vendor/au-cf-ai-gateway-<version>.tgz` and updating the `file:` spec.

## Dev

```bash
cd worker && bun install && bun run dev && bun test
```

## Production (`ask.plurality.net`)

**Live (interim):** `https://plurality-ask.audreyt.workers.dev` — site `book-ask.js` points here until `ask.plurality.net` is a proxied name in Cloudflare (then uncomment `[[routes]]` in `wrangler.toml` and switch client URL).

1. **Vectorize** (once): `wrangler vectorize create plurality-book --dimensions=1024 --metric=cosine` ✅
2. **Metadata index** (once, before bulk upsert): `wrangler vectorize create-metadata-index plurality-book --propertyName=lang --type=string` ✅ (`bun run vectorize:sync-book` also ensures this)
3. **Index book** (repo root): `bun run vectorize:sync-book` — re-upsert all chunks after `lang` index exists (earlier vectors are not filterable retroactively)
4. **Secrets**: none required for the default `AUDREY_MODEL` — `@cf/deepseek-ai/deepseek-v4-flash-0731` generates on the Workers AI binding (`[ai]` above), with no gateway hop. Switching `AUDREY_MODEL` to `nemotron-ultra` or `fugu` routes through the authenticated AI Gateway instead, which DOES need `wrangler secret put CF_AIG_TOKEN` (every gateway request 401s without it); no Baseten key is needed because it is a stored provider key on the Cloudflare side
5. **Deploy**: `cd worker && bunx wrangler deploy`
6. **Custom domain**: add `ask.plurality.net` DNS (proxied) in CF zone for `plurality.net`, uncomment route in `wrangler.toml`, redeploy.

Publish: `cd askit-hono && npm run publish:gateway`