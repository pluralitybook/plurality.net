import { describe, expect, test } from 'vite-plus/test';
import config from '../../astro.config.mjs';

type AstroConfig = {
  site?: string;
  output?: string;
  trailingSlash?: string;
  build?: { format?: string };
  compressHTML?: boolean;
  fetchFile?: string | null;
};

const astroConfig = config as AstroConfig;

describe('astro.config', () => {
  test('keeps the static GitHub Pages publishing contract', () => {
    expect(astroConfig.site).toBe('https://plurality.net');
    expect(astroConfig.output).toBe('static');
    expect(astroConfig.trailingSlash).toBe('always');
    expect(astroConfig.build?.format).toBe('directory');
    expect(astroConfig.compressHTML).toBe(true);
    expect(astroConfig.fetchFile).toBeNull();
  });
});
