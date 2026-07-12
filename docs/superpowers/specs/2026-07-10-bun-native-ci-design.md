# Bun-Native CI Design

Date: 2026-07-10

Status: Superseded by `2026-07-12-vp-runtime-boundary.md`. This document's original
"repository-controlled JavaScript runs under Bun" decision and its "steps use `bun
--bun`" regression contract no longer describe this repository and are corrected
below rather than left to mislead future readers. The action-version upgrades,
`astro check` → `tsc --noEmit` replacement, hidden-Pages-artifact fix, and
Dependabot addition this document introduced are still in effect and are not
affected by the correction.

## Problem (historical, as of 2026-07-10)

The repository's CI emitted Node.js 20 action-runtime warnings because several workflows still used older GitHub Action majors (`checkout@v4`, `cache@v4`, and artifact actions). Repository commands also mixed Bun with Node/npm entry points: the root `check` script invoked the TS7-incompatible Astro language server, the worker test script invoked Node directly, and the Lighthouse job installed and ran through npm/Node.

## Decision (superseded — see `2026-07-12-vp-runtime-boundary.md`)

This document originally adopted civic.ai's Bun-native boundary verbatim:

> Repository-controlled JavaScript runs under Bun. Maintained GitHub Actions may use their bundled Node 24 runtime internally.

That held for the literal `bun --bun run <script>` / `bunx --bun <tool>` invocations this document introduced, but it stopped describing the repository once the root lifecycle moved to `vp check` / `vp test` / `vp build` (`6d3c5c2`, `62253be`, `a7787b3`): those `vp` subcommands run Astro, TypeScript, Vitest, and Pagefind under Vite+'s own managed, pinned Node.js runtime, not Bun. Forcing `vp test` under Bun breaks it outright — `@vitest/coverage-v8` needs `node:inspector`, which Bun does not implement — so a literal reapplication of "everything under Bun" to this repository's `vp test` step would either break the 100% four-metric coverage gate or force reverting to Bun's own native test coverage, which this repository's own prior `bunfig.toml` (see `2026-07-12-vp-runtime-boundary.md`'s Evidence section) shows only ever delivered line/function coverage here, not the branch coverage the current setup independently enforces.

The current boundary (`2026-07-12-vp-runtime-boundary.md`):

> `vp` is the root lifecycle entry point, executing under Vite+'s own managed, pinned Node.js runtime (`package.json#devEngines.runtime`, pinned to an exact version, currently `24.18.0`) — not Bun. Bun stays pinned as the package manager (`devEngines.packageManager`, `1.3.14`), as the runtime for intentional utility scripts outside the `vp` lifecycle (`vectorize:sync-book`, `sync-translations`), and as the exclusive runtime for the separate `worker/` package.

The change was, and remains, limited to CI/runtime plumbing. Site output, worker Wrangler deployment, and test semantics remain unchanged.

## Changes (still in effect)

- Upgraded workflow actions to maintained Node 24 generations: `checkout@v7`, `cache@v6`, `upload-artifact@v5`, `download-artifact@v5`, `configure-pages@v6`, `upload-pages-artifact@v5`, and `deploy-pages@v5`.
- Preserved hidden Pages output with `include-hidden-files: true` on `upload-pages-artifact@v5`.
- Replaced `astro check` with `tsc --noEmit`, removed `@astrojs/check`, and updated the lockfile; TS7's compiler API no longer supports Astro's language-server check path. (That check now runs from `tests/global-setup.ts` before `vp test`, per `2026-07-12-vp-runtime-boundary.md`.)
- Added weekly GitHub Actions Dependabot updates.

## Changes (superseded — see `2026-07-12-vp-runtime-boundary.md` for the replacement)

- ~~Prefix repository-controlled workflow commands with `bun --bun`, including installs, scripts, tests, and `bunx` tools.~~ Root lifecycle commands are now plain `vp <command>` / `vp run <script>` / `vp exec <local-bin>` / `vp dlx <remote-pkg>`, bootstrapped via `voidzero-dev/setup-vp@v1`. `bun --bun`/`bunx --bun` remain only inside the `worker` job, which has no `vite-plus` dependency.
- ~~Replace the Lighthouse job's `setup-node` + global `npm install` path with `bunx --bun @lhci/cli@0.14.x autorun`.~~ It now uses `vp dlx @lhci/cli@0.14.x autorun`.
- ~~Make root and worker package scripts use Bun-native command forms where they currently invoke Node directly.~~ Root package scripts route through `vp`; only the worker package and the two intentional utility scripts (`vectorize:sync-book`, `sync-translations`) invoke Bun directly.

The existing `pull_request` trigger and multi-job CI graph remain unchanged; this repository still does not use civic.ai's separate checkout/auto-format security redesign.

## Regression contract (superseded — see current `tests/unit/ci-workflow.test.js`)

This document originally specified a contract requiring "repository command steps use `bun --bun`" throughout. That requirement is corrected: `tests/unit/ci-workflow.test.js` now asserts the opposite for root lifecycle commands — no workflow `run:` step resolves `bun`/`bunx` ambiently outside the `worker` job, every root lifecycle command is a plain `vp` invocation, every workflow that uses `vp` bootstraps it via `voidzero-dev/setup-vp@v1`, `package.json#devEngines.runtime` pins an exact Node.js version, `src/lib/vitePlusAdapter.ts` does not invoke `bunx`/`bun` for Pagefind, the root README has zero Bun mentions, and the worker keeps its own untouched `bun test` runner. The action-major-version and hidden-Pages-artifact assertions from the original contract are unchanged and still enforced by the same test file.

## Verification

Run `vp check`, `vp test` (root suite, 100% four-metric coverage), `vp build`, the focused workflow/config contract test, HTML validation, and the targeted Playwright suite. Inspect the final workflow diff for scope and YAML validity.
