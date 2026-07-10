# Bun-Native CI Design

Date: 2026-07-10
Status: Approved by the implementation request

## Problem

The repository's CI emits Node.js 20 action-runtime warnings because several workflows still use older GitHub Action majors (`checkout@v4`, `cache@v4`, and artifact actions). Repository commands also mix Bun with Node/npm entry points: the root `check` script invokes the TS7-incompatible Astro language server, the worker test script invokes Node directly, and the Lighthouse job installs and runs through npm/Node.

## Decision

Adopt civic.ai's Bun-native boundary:

> Repository-controlled JavaScript runs under Bun. Maintained GitHub Actions may use their bundled Node 24 runtime internally.

The change is limited to CI/runtime plumbing. Site output, worker Wrangler deployment, and test semantics remain unchanged.

## Changes

- Upgrade workflow actions to maintained Node 24 generations: `checkout@v7`, `cache@v6`, `upload-artifact@v5`, `download-artifact@v5`, `configure-pages@v6`, `upload-pages-artifact@v5`, and `deploy-pages@v5`.
- Prefix repository-controlled workflow commands with `bun --bun`, including installs, scripts, tests, and `bunx` tools.
- Replace the Lighthouse job's `setup-node` + global `npm install` path with `bunx --bun @lhci/cli@0.14.x autorun`.
- Preserve hidden Pages output with `include-hidden-files: true` on `upload-pages-artifact@v5`.
- Replace `astro check` with `tsc --noEmit`, remove `@astrojs/check`, and update the lockfile; TS7's compiler API no longer supports Astro's language-server check path.
- Make root and worker package scripts use Bun-native command forms where they currently invoke Node directly.
- Add weekly GitHub Actions Dependabot updates.

The existing `pull_request` trigger and multi-job CI graph remain unchanged; this task does not introduce civic.ai's separate checkout/auto-format security redesign.

## Regression contract

A focused Bun test reads all workflows and asserts:

1. No obsolete action major or direct `node`/`npm` command remains in CI/Pages/sync workflows.
2. Repository command steps use `bun --bun`.
3. Pages upload preserves hidden files.
4. The TS7-incompatible Astro check dependency/script is absent.

## Verification

Run the focused workflow contract test, root typecheck, worker tests, root unit/regression tests, build, HTML validation, and the targeted Playwright book-AI suite. Run `actionlint` when available; inspect the final workflow diff for scope and YAML validity.
