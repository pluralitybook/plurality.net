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
    ignorePatterns: ['worker/vendor/**', '.astro/**', 'dist/**'],
  },
  staged: {
    '**/*': 'vp fmt',
    '*.{ts,tsx,js,jsx}': 'vp lint --fix',
  },
  server: {
    host: '127.0.0.1',
    port: 4321,
  },
  plugins: [createAstroBuildBridge(), createAstroDevProxy()],
});
