import { describe, expect, test } from 'vite-plus/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const workflowPaths = [
  '.github/workflows/ci.yml',
  '.github/workflows/deploy.yml',
  '.github/workflows/sync-translations.yml',
];
const workflows = Object.fromEntries(
  workflowPaths.map((relativePath) => [
    relativePath,
    readFileSync(path.join(root, relativePath), 'utf8'),
  ])
);

function allWorkflowText() {
  return Object.values(workflows).join('\n');
}

function runLines(text) {
  return text.split('\n').filter((line) => /^\s*(?:-\s+)?run:/.test(line));
}

describe('vp-first CI contract', () => {
  test('uses maintained Node 24 action generations', () => {
    const text = allWorkflowText();
    expect(text).not.toMatch(
      /actions\/(checkout|cache|upload-artifact|download-artifact)@v[234]\b/
    );
    expect(text).not.toContain('actions/setup-node@');
    expect(text).toContain('actions/checkout@v7');
    expect(text).toContain('actions/cache@v6');
    expect(text).toContain('actions/upload-artifact@v5');
    expect(text).toContain('actions/download-artifact@v5');
    expect(text).toContain('actions/configure-pages@v6');
    expect(text).toContain('actions/upload-pages-artifact@v5');
    expect(text).toContain('actions/deploy-pages@v5');
  });

  test('does not shell out to node/npm/npx as a command anywhere in workflows', () => {
    // Scoped to `run:` command lines, not the whole YAML — `setup-vp`'s own
    // `node-version:`/`node-version-file:` input keys legitimately contain
    // "node" as a config key, not a command invocation.
    const commandLines = runLines(allWorkflowText());
    expect(commandLines.length).toBeGreaterThan(0);
    expect(commandLines.filter((line) => /\b(?:node|npm|npx)\b/.test(line))).toEqual([]);
  });

  test('confines Bun-native shell commands to the separate worker package', () => {
    const commandLines = runLines(allWorkflowText()).filter((line) => /\bbun(?:x)?\b/.test(line));
    expect(commandLines).toEqual([
      '      - run: cd worker && bun --bun install --frozen-lockfile && bun --bun run typecheck && bun --bun test',
    ]);
    expect(commandLines.every((line) => line.includes('bun --bun'))).toBe(true);
  });

  test('routes every root lifecycle command through plain vp, never through bunx or vpx', () => {
    const text = allWorkflowText();
    expect(text).not.toMatch(/\bbunx\b/);
    expect(text).not.toMatch(/\bvpx\b/);
    const rootCommandLines = runLines(text).filter((line) => !line.includes('cd worker &&'));
    expect(rootCommandLines.join('\n')).not.toMatch(/\bbun(?:\s+--bun)?\s+run\b/);

    const vpCommandLines = runLines(text).filter((line) => /\bvp\b/.test(line));
    expect(vpCommandLines.length).toBeGreaterThan(0);
    expect(vpCommandLines.every((line) => !/\bbunx?\b/.test(line) && !/\bvpx\b/.test(line))).toBe(
      true
    );
  });

  test('bootstraps vp via the official setup-vp action, pinned to the exact Node runtime', () => {
    const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    const pinnedNode = packageJson.devEngines?.runtime?.version;
    expect(pinnedNode).toBeTruthy();
    expect(pinnedNode).not.toBe('lts');
    expect(pinnedNode).toMatch(/^\d+\.\d+\.\d+$/);

    for (const relativePath of workflowPaths) {
      const text = workflows[relativePath];
      const usesVp = /^\s*(?:-\s+)?run:.*\bvpx?\b/m.test(text);
      if (!usesVp) continue;
      expect(text).toContain('uses: voidzero-dev/setup-vp@v1');
      // The setup-vp `node-version` input must match `devEngines.runtime`
      // exactly, not a loose major-version range, so the CI bootstrap and
      // the project's own pin cannot drift apart.
      expect(text).toContain(`node-version: '${pinnedNode}'`);
    }

    // No hand-rolled curl-installer bootstrap remains anywhere.
    expect(allWorkflowText()).not.toContain('vite.plus | bash');
    expect(allWorkflowText()).not.toContain('.vite-plus/bin');

    expect(workflows['.github/workflows/ci.yml']).toContain('vp install --frozen-lockfile');
    expect(workflows['.github/workflows/deploy.yml']).toContain('vp install --frozen-lockfile');
    expect(workflows['.github/workflows/sync-translations.yml']).toContain(
      'vp install --frozen-lockfile'
    );
  });

  test('keeps hidden files in the Pages artifact', () => {
    expect(workflows['.github/workflows/deploy.yml']).toContain('include-hidden-files: true');
  });

  test('folds the TypeScript gate into vp test via a global setup, not a separate check script', () => {
    const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    const workerPackageJson = JSON.parse(
      readFileSync(path.join(root, 'worker/package.json'), 'utf8')
    );
    const scriptText = Object.values(packageJson.scripts).join('\n');
    const workerScriptText = Object.values(workerPackageJson.scripts).join('\n');
    expect(JSON.stringify(packageJson)).not.toContain('@astrojs/check');
    expect(packageJson.scripts.check).toBeUndefined();
    expect(scriptText).not.toMatch(/\b(?:node|npm|npx)\b/);
    expect(workerPackageJson.scripts.test).toBe('bun test test/*.test.ts');
    expect(workerScriptText).not.toMatch(/\b(?:node|npm|npx|tsx)\b/);

    const viteConfig = readFileSync(path.join(root, 'vite.config.ts'), 'utf8');
    expect(viteConfig).toContain("globalSetup: ['./tests/global-setup.ts']");

    const globalSetup = readFileSync(path.join(root, 'tests/global-setup.ts'), 'utf8');
    expect(globalSetup).toContain("'astro', 'sync'");
    expect(globalSetup).toContain("'tsc', '--noEmit'");
  });

  test('pins an exact Vite+-managed Node.js runtime alongside the exact Bun package-manager pin', () => {
    const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    expect(packageJson.devEngines?.packageManager).toMatchObject({
      name: 'bun',
      version: '1.3.14',
    });
    expect(packageJson.devEngines?.runtime).toMatchObject({ name: 'node' });
    expect(packageJson.devEngines.runtime.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('never resolves bunx/bun ambiently for Pagefind in the Astro build bridge', () => {
    const adapter = readFileSync(path.join(root, 'src/lib/vitePlusAdapter.ts'), 'utf8');
    expect(adapter).not.toMatch(/execFileSync\(\s*['"]bunx?['"]/);
    expect(adapter).toContain("path.join(cwd, 'node_modules', '.bin', 'pagefind')");
  });

  test('routes root tests and the build through vp, keeping the worker on Bun', () => {
    const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    // No-arg passthroughs for bare `vp test` add nothing over typing the vp
    // command directly, so they are removed rather than kept as aliases.
    expect(packageJson.scripts.test).toBeUndefined();
    expect(packageJson.scripts['test:coverage']).toBeUndefined();
    expect(packageJson.scripts['test:unit']).toBe('vp test tests/unit');
    expect(packageJson.scripts['test:regression']).toBe('vp test tests/regression');

    const ci = workflows['.github/workflows/ci.yml'];
    expect(ci).toContain('vp run test:unit');
    expect(ci).toContain('vp run test:regression');
    expect(ci).toContain('vp build');
    expect(ci).not.toMatch(/bun\s+--bun\s+test\s+tests\b/);

    const deploy = workflows['.github/workflows/deploy.yml'];
    expect(deploy).toContain('vp build');

    const syncTranslations = workflows['.github/workflows/sync-translations.yml'];
    expect(syncTranslations).toContain('vp run sync-translations');

    // The worker package keeps its own typecheck and Bun test runner — root
    // `vp test` must never swallow it.
    expect(ci).toContain(
      'cd worker && bun --bun install --frozen-lockfile && bun --bun run typecheck && bun --bun test'
    );
  });

  test('keeps the root README free of Bun instructions', () => {
    const readme = readFileSync(path.join(root, 'README.md'), 'utf8');
    expect(readme).not.toMatch(/\bbun\b/i);
    expect(readme).toContain('vp check');
    expect(readme).toContain('vp test');
    expect(readme).toContain('vp build');
  });

  test('configures weekly GitHub Actions dependency updates', () => {
    const dependabot = readFileSync(path.join(root, '.github/dependabot.yml'), 'utf8');
    expect(dependabot).toMatch(/package-ecosystem:\s+['"]github-actions['"]/);
    expect(dependabot).toMatch(/interval:\s+['"]weekly['"]/);
  });
});
