import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://plurality.net',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  compressHTML: true,
  fetchFile: null,
});
