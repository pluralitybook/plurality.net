# VP-Managed Runtime Boundary

Date: 2026-07-12

Status: Approved and implemented. Supersedes `2026-07-10-bun-native-ci-design.md`'s
"repository-controlled JavaScript runs under Bun" decision with the boundary below.

## Problem

`2026-07-10-bun-native-ci-design.md` adopted civic.ai's boundary verbatim:
"Repository-controlled JavaScript runs under Bun." That was true for the literal
`bun --bun run <script>` / `bunx --bun <tool>` invocations it introduced, but the
repository's own subsequent migration to `vp check` / `vp test` / `vp build` as the
root lifecycle entry point (`6d3c5c2`, `62253be`, `a7787b3`) made the premise stop
holding: those `vp` subcommands do not run Astro, TypeScript, Vitest, or Pagefind
under Bun at all. They run under Vite+'s own managed Node.js runtime.

## Evidence

Runtime probes injected into the actual pipeline (`vp env doctor`, a `process.execPath`
probe inside a `vp test`-run test file, and a probe script run via `vp exec node`) all
resolve to `~/.vite-plus/js_runtime/node/<version>/bin/node` — a real, standalone,
Vite+-downloaded Node.js binary (`isBun: false`), independent of both the ambient
system Node and Bun's Node-compatibility layer. `vp install` separately provisions a
matching pinned Bun binary at `~/.vite-plus/package_manager/bun/<version>/bun/bin/bun.native`
for the package-manager role, entirely independent of whatever Bun a global
`oven-sh/setup-bun` install or the ambient shell provides.

Forcing `vp test` under Bun breaks it outright:

```
$ bun --bun vp test tests/unit/<file>.test.ts
⎯⎯⎯⎯⎯⎯⎯ Test Run Error ⎯⎯⎯⎯⎯⎯⎯
Error: Coverage APIs are not supported
 ❯ post node:inspector:45:35
 ❯ startCoverage node_modules/@vitest/coverage-v8/dist/index.js:17:16
```

`@vitest/coverage-v8` drives V8's coverage instrumentation through `node:inspector`,
which Bun does not implement. `bunx --bun vp test` reproduces the identical failure.
`bunx --bun vp check` and `bunx --bun vp build` do not fail this way — neither touches
`node:inspector` — so the incompatibility is specific to the coverage-collecting test
run, not a blanket "vp under Bun" problem. This means a literal, uniform reapplication
of the prior ADR's "all repository JavaScript under Bun" rule to this repository's
`vp test` step would either break the 100% four-metric coverage gate outright, or
require reverting the test runner to Bun's own native `bun test --coverage` — which
this repository's own history (`bunfig.toml`, deleted in `6d3c5c2`) already used, and
whose recorded comment ("100% line + function coverage") shows it only ever delivered
line/function coverage here, not the independently-enforced branch coverage the
current vitest-coverage-v8 setup added. Reverting would be a real regression, not a
style change.

civic.ai's own Bun-native CI design (`.github/bun-native-ci-design.md` there) is
otherwise sound and independently arrived at the same worker boundary this repository
already has (Wrangler does not officially support Bun as its runtime). That design
was written before civic.ai had a four-metric Vitest/v8 coverage gate to run through
its CI, so it never had to reconcile "everything under Bun" with the coverage-v8/
`node:inspector` incompatibility this document is about — not because the boundary is
unsound, but because the specific gate that exposes the incompatibility didn't exist
yet at the time that decision was made. This document does not assert anything about
civic.ai's current or future state.

## Decision

Replace "all repository-controlled JavaScript runs under Bun" with the boundary this
repository actually runs today:

> `vp` is the root lifecycle entry point (check/test/build/run/exec), executing under
> Vite+'s own managed, pinned Node.js runtime — not Bun, not the ambient system Node.
> Bun is pinned as the package manager (`devEngines.packageManager`), as the runtime
> for intentional utility scripts that are not part of the `vp` lifecycle
> (`vectorize:sync-book`, `sync-translations`), and as the exclusive runtime for the
> separate `worker/` package. Root build and static-check gates never resolve `bun` or
> `bunx` ambiently from `PATH`; where a tool needs to be invoked outside `vp exec`'s
> own resolution (e.g. Pagefind from inside the Astro build bridge), it is executed by
> its fully-qualified `node_modules/.bin/` path, not a bare `bunx`/`bun` command.

## Changes

- `package.json#devEngines.runtime` pins the Vite+-managed Node.js version explicitly
  (`{ "name": "node", "version": "24.18.0", "onFail": "download" }`), via `vp env pin
24.18.0 --target dev-engines`. This closes the reproducibility gap the prior "lts"
  auto-resolution left open — Node version drift is no longer possible on a fresh
  install, matching the same explicitness `devEngines.packageManager` already had for
  Bun.
- `src/lib/vitePlusAdapter.ts`'s `execPagefind` no longer shells out to `bunx --bun
pagefind`. It executes `node_modules/.bin/pagefind` by its resolved local path
  directly, so the tool's `#!/usr/bin/env node` shebang always resolves through
  whichever `node` Vite+ has already put first on `PATH` for the running process,
  instead of depending on ambient `bunx` resolution (which can silently diverge from
  the pinned Bun version — observed in this same audit: an ambient shell `bunx` at
  1.4.0 against the project's pinned `1.3.14`).
- CI/deploy/sync-translations workflows bootstrap via the officially documented
  `voidzero-dev/setup-vp@v1` GitHub Action (`node-version: '24.18.0'`, `cache: true`)
  — matching `devEngines.runtime` exactly rather than a loose `'24'` major-version
  hint, so the workflow bootstrap and the project's own pin cannot drift apart —
  instead of a hand-rolled `curl https://vite.plus | bash` + manual `$GITHUB_PATH`
  step. `setup-vp` installs Vite+, resolves the Node.js version, and caches
  package-manager data (auto-detecting `bun.lock`) in one maintained step, and
  provisions its own pinned Bun automatically when `vp install` runs — so
  `oven-sh/setup-bun` is no longer needed in any job that only runs `vp` commands.
  `oven-sh/setup-bun` remains only in the `worker` job, which has no `vite-plus`
  dependency and manages its own separate lockfile and `bun test` run.
- `vp install --frozen-lockfile` stays an explicit, separate step after `setup-vp`
  (matching the action's own documented basic usage), not folded into the action's
  `run-install` input, so the exact install command stays visible in the workflow.
- The Lighthouse job's ad-hoc `@lhci/cli` invocation uses `vp dlx` (Vite+'s
  `npx`/`bunx` equivalent for on-demand remote packages) instead of `bunx --bun`,
  keeping the "every root lifecycle command starts with `vp`" invariant intact even
  for a tool that is never a local dependency.
- `astro check` remains replaced by `tsc --noEmit` (unchanged from the prior ADR;
  TS7's compiler API still does not support Astro's language-server check path). That
  check now runs from `tests/global-setup.ts`, executed once before the whole `vp
test` run via `vp exec astro sync` / `vp exec tsc --noEmit` — both under the same
  Vite+-managed Node the rest of the pipeline uses, so plain `vp test` alone
  reproduces what the old standalone `bun run check` script used to do.
- The 100% four-metric coverage gate (`vite.config.ts`'s `coverage.thresholds`:
  statements/branches/functions/lines all 100) is preserved unchanged. It depends on
  `vp test` staying off Bun, which this boundary makes an explicit, documented
  invariant rather than an accidental side effect of invocation style.

## What did not change

- Site output, `worker/` Wrangler deployment, and test semantics are unchanged, same
  as the prior ADR's stated scope.
- The `worker/` package keeps its own lockfile, `bun.lock`, `bun test`, and
  `oven-sh/setup-bun` bootstrap — this repository's version of the same boundary
  civic.ai's design doc independently reached, for the same reason (Wrangler has no
  official Bun-runtime support).
- `vectorize:sync-book` and `sync-translations` remain intentional Bun utility
  scripts (`bun scripts/*.mjs`/`*.ts`). Where applicable, they are entered through
  `vp run`; their script bodies intentionally use the configured Bun runtime, and
  they remain outside the root `check`/`test`/`build` gates.
- The root README documents `vp` commands exclusively; it does not reintroduce Bun
  as a user-facing instruction. Bun stays explicit only in `package.json`
  (`devEngines.packageManager`) and `CLAUDE.md`'s scoped utility-script guidance.

## Regression contract

`tests/unit/ci-workflow.test.js` (root suite) asserts:

1. Maintained GitHub Action generations remain in use (unchanged from the prior ADR).
2. No workflow `run:` step resolves `bun`/`bunx` ambiently outside the `worker` job
   and its `oven-sh/setup-bun` bootstrap — every root lifecycle command is a plain
   `vp <command>` / `vp run <script>` / `vp exec <local-bin>` / `vp dlx <remote-pkg>`.
3. Every workflow that invokes `vp` bootstraps it via `voidzero-dev/setup-vp@v1`.
4. `package.json#scripts.check` stays absent (its logic lives in
   `tests/global-setup.ts`, wired through `vite.config.ts#test.globalSetup`).
5. `package.json#devEngines.runtime` pins an exact Node.js version (not a moving
   `lts`/range) alongside the existing exact `devEngines.packageManager` pin.
6. `src/lib/vitePlusAdapter.ts` does not invoke `bunx`/`bun` for Pagefind.
7. The root README contains no case-insensitive `bun` mentions.
8. The worker keeps its own `bun test` runner, untouched.

## Verification

`vp check`, `vp test` (full root suite, 100% statements/branches/functions/lines),
`vp build` (Astro + Pagefind), the focused workflow/config contract tests, and YAML
validity of all three rewritten workflow files.
