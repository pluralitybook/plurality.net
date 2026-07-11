import { afterEach, describe, expect, test } from 'vite-plus/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchTextCached } from '../../src/lib/remote-text-cache.ts';

let dirs: string[] = [];
function tempCache(): string {
  const dir = mkdtempSync(join(tmpdir(), 'plurality-cache-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
});

describe('fetchTextCached', () => {
  test('writes successful fetches and reuses fresh cache', async () => {
    const cacheDir = tempCache();
    let calls = 0;
    const first = await fetchTextCached('https://example.com/a', {
      cacheDir,
      fetcher: async () => {
        calls += 1;
        return 'fresh';
      },
    });
    const second = await fetchTextCached('https://example.com/a', {
      cacheDir,
      fetcher: async () => {
        calls += 1;
        return 'new';
      },
    });
    expect(first).toBe('fresh');
    expect(second).toBe('fresh');
    expect(calls).toBe(1);
  });

  test('returns stale cache when refresh fails', async () => {
    const cacheDir = tempCache();
    await fetchTextCached('https://example.com/b', { cacheDir, fetcher: async () => 'cached' });
    const stale = await fetchTextCached('https://example.com/b', {
      cacheDir,
      ttlMs: -1,
      fetcher: async () => {
        throw new Error('offline');
      },
    });
    expect(stale).toBe('cached');
  });

  test('throws refresh failures when stale fallback is disabled', async () => {
    const cacheDir = tempCache();
    await expect(
      fetchTextCached('https://example.com/c', {
        cacheDir,
        staleOnError: false,
        fetcher: async () => {
          throw new Error('offline');
        },
      })
    ).rejects.toThrow('offline');
  });

  test('throws when refresh fails and no stale cache exists', async () => {
    await expect(
      fetchTextCached('https://example.com/miss', {
        cacheDir: tempCache(),
        fetcher: async () => {
          throw new Error('offline');
        },
      })
    ).rejects.toThrow('offline');
  });

  test('uses the default fetcher', async () => {
    const cacheDir = tempCache();
    const text = await fetchTextCached('data:text/plain,hello', { cacheDir });
    expect(text).toBe('hello');
  });

  test('default fetcher rejects non-OK responses', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response('no', { status: 500 })) as unknown as typeof fetch;
    try {
      await expect(
        fetchTextCached('https://example.com/status', {
          cacheDir: tempCache(),
          staleOnError: false,
        })
      ).rejects.toThrow('500');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
