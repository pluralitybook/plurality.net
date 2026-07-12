# plurality.net

The website for [Plurality: The Future of Collaborative Technology and Democracy](https://plurality.net), a book by E. Glen Weyl, Audrey Tang and the Plurality Community.

Built with [Astro 7](https://astro.build/) and [Vite+](https://viteplus.dev/).

## Setup

Install the global Vite+ CLI, then install project dependencies:

```bash
curl -fsSL https://vite.plus | bash
vp install
```

If the current shell has not refreshed its PATH, use the installed binary at `~/.vite-plus/bin/vp`.

## Development

```bash
vp dev
```

## Checks and tests

```bash
vp check
vp test
```

`vp check` runs formatting, linting, and type-aware checks. `vp test` is the authoritative test entry for the root suite (`tests/unit` + `tests/regression`, 100% statement/branch/function/line coverage enforced); its global setup also regenerates Astro's ambient types and runs a full TypeScript compile check before any test executes, so `vp test` alone is the canonical gate. The `worker/` package is a separate Cloudflare Worker project with its own lockfile and test runner — see `worker/README.md`. Playwright E2E tests run via `vp run test:e2e`, outside `vp test`.

## Build

```bash
vp build
```

## License

This work is marked with [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).
