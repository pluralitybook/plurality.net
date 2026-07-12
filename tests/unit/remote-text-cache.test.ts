import { afterEach, describe, expect, test, vi } from 'vite-plus/test';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import type * as NodeFsPromises from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchTextCached } from '../../src/lib/remote-text-cache.ts';

const readFileMock = vi.hoisted(() => vi.fn());

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeFsPromises>();
  readFileMock.mockImplementation(actual.readFile);
  return { ...actual, readFile: readFileMock };
});

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

  test('refetches when a fresh cache entry cannot be read', async () => {
    const cacheDir = tempCache();
    await fetchTextCached('https://example.com/unreadable', {
      cacheDir,
      fetcher: async () => 'primed',
    });
    readFileMock.mockImplementationOnce(() => Promise.reject(new Error('EACCES')));
    const result = await fetchTextCached('https://example.com/unreadable', {
      cacheDir,
      fetcher: async () => 'refreshed',
    });
    expect(result).toBe('refreshed');
  });

  test('uses the default cache directory when none is provided', async () => {
    const url = `https://example.com/default-${Date.now()}`;
    const key = createHash('sha256').update(url).digest('hex');
    const defaultFile = join('.cache', 'remote-text', `${key}.txt`);
    try {
      const text = await fetchTextCached(url, { fetcher: async () => 'default-dir' });
      expect(text).toBe('default-dir');
    } finally {
      rmSync(defaultFile, { force: true });
    }
  });
});
