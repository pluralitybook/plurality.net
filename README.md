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
bun test
```

`bun run check` is the canonical TypeScript gate and `bun test` is the authoritative full test suite because tests use Bun-only APIs; `vp test` is not a replacement.

## Build

Both build commands are supported:

```bash
vp build
bun run build
```

## License

This work is marked with [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).
