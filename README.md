# plurality.net

The website for [Plurality: The Future of Collaborative Technology and Democracy](https://plurality.net), a book by E. Glen Weyl, Audrey Tang and the Plurality Community.

Built with [Astro 7](https://astro.build/), [Bun](https://bun.sh/), and [Vite+](https://viteplus.dev/).

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
bun run check
vp test
```

`bun run check` is the canonical TypeScript gate. `vp test` is the authoritative test entry for the root suite (`tests/unit` + `tests/regression`, 100% line/function coverage enforced). Bun remains the runtime and package manager; the `worker/` package keeps `bun test` (separate lockfile), and Playwright E2E tests run via `bun run test:e2e`.

## Build

Both build commands are supported:

```bash
vp build
bun run build
```

## License

This work is marked with [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).
