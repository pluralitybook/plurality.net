import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dir, '../..');
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

describe('Bun-native CI contract', () => {
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

  test('does not invoke Node or npm from workflows', () => {
    const text = allWorkflowText();
    expect(text).not.toMatch(/\b(?:node|npm|npx)\b/);
  });

  test('runs repository commands through Bun shebang resolution', () => {
    const commandLines = allWorkflowText()
      .split('\n')
      .filter((line) => /^\s*(?:-\s+)?run:.*\bbun(?:x)?\b/.test(line));
    expect(commandLines.length).toBeGreaterThan(0);
    expect(commandLines.filter((line) => !line.includes('bun --bun'))).toEqual([]);
  });

  test('keeps hidden files in the Pages artifact', () => {
    expect(workflows['.github/workflows/deploy.yml']).toContain('include-hidden-files: true');
  });

  test('keeps the repository check Bun-native under TypeScript 7', () => {
    const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    const workerPackageJson = JSON.parse(
      readFileSync(path.join(root, 'worker/package.json'), 'utf8')
    );
    const scriptText = Object.values(packageJson.scripts).join('\n');
    const workerScriptText = Object.values(workerPackageJson.scripts).join('\n');
    expect(JSON.stringify(packageJson)).not.toContain('@astrojs/check');
    expect(packageJson.scripts.check).toBe('bunx --bun astro sync && tsc --noEmit');
    expect(scriptText).not.toMatch(/\b(?:node|npm|npx)\b/);
    expect(workerPackageJson.scripts.test).toBe('bun test test/*.test.ts');
    expect(workerScriptText).not.toMatch(/\b(?:node|npm|npx|tsx)\b/);
  });
  test('configures weekly GitHub Actions dependency updates', () => {
    const dependabot = readFileSync(path.join(root, '.github/dependabot.yml'), 'utf8');
    expect(dependabot).toMatch(/package-ecosystem:\s+['"]github-actions['"]/);
    expect(dependabot).toMatch(/interval:\s+['"]weekly['"]/);
  });
});
