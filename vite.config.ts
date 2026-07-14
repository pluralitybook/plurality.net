import { defineConfig } from 'vite-plus';
import { createAstroBuildBridge, createAstroDevProxy } from './src/lib/vitePlusAdapter';

export default defineConfig({
  fmt: {
    semi: true,
    singleQuote: true,
    tabWidth: 2,
    trailingComma: 'es5',
    ignorePatterns: [
      'node_modules/**',
      'worker/**',
      'vendor/**',
      '.astro/**',
      'dist/**',
      'public/**',
      'src/data/**',
    ],
  },
  lint: {
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: { 'vite-plus/prefer-vite-plus-imports': 'error' },
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: ['worker/**', '.astro/**', 'dist/**'],
  },
  staged: {
    '**/*': 'vp fmt',
    '*.{ts,tsx,js,jsx}': 'vp lint --fix',
  },
  server: {
    host: '127.0.0.1',
    port: 4321,
  },
  test: {
    include: ['tests/unit/**/*.test.{ts,js}', 'tests/regression/**/*.test.{ts,js}'],
    exclude: ['tests/e2e/**', 'worker/**', 'node_modules/**'],
    environment: 'node',
    globalSetup: ['./tests/global-setup.ts'],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      exclude: [
        'node_modules/**',
        'tests/**',
        'dist/**',
        'scripts/sync-translations-bin.ts',
        'worker/**',
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
  plugins: [createAstroBuildBridge(), createAstroDevProxy()],
});
