import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Resolves to the repo root regardless of the process's current working
// directory (this file lives at `<root>/tests/global-setup.ts`).
const projectRoot = fileURLToPath(new URL('..', import.meta.url));

function run(args: string[]): void {
  execFileSync('vp', args, { cwd: projectRoot, stdio: 'inherit' });
}

/**
 * Vitest `globalSetup`: runs once before the whole `vp test` run. Folds in
 * everything the standalone `bun run check` script used to do — regenerate
 * Astro's ambient types (`astro sync`) and run a full TypeScript compile
 * check (`tsc --noEmit`) — via `vp exec`, which resolves both `astro` and
 * `tsc` from the local `node_modules/.bin`. A non-zero exit throws, which
 * fails the test run before a single test executes.
 */
export default function setup(): void {
  run(['exec', 'astro', 'sync']);
  run(['exec', 'tsc', '--noEmit']);
}
