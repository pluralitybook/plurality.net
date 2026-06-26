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

Publish: `cd askit-hono && npm run publish:gateway`