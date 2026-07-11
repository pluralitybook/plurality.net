import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type FetchText = (url: string) => Promise<string>;
export type FetchTextCachedOptions = {
  fetcher?: FetchText;
  ttlMs?: number;
  cacheDir?: string;
  staleOnError?: boolean;
};

const DAY_MS = 86_400_000;

async function defaultFetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return await res.text();
}

function cachePath(url: string, cacheDir: string): string {
  const key = createHash('sha256').update(url).digest('hex');
  return path.join(cacheDir, `${key}.txt`);
}

async function readCached(file: string): Promise<string | null> {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return null;
  }
}

export async function fetchTextCached(
  url: string,
  options: FetchTextCachedOptions = {}
): Promise<string> {
  const ttlMs = options.ttlMs ?? DAY_MS;
  const cacheDir = options.cacheDir ?? path.join('.cache', 'remote-text');
  const staleOnError = options.staleOnError !== false;
  const fetcher = options.fetcher ?? defaultFetchText;
  const file = cachePath(url, cacheDir);

  try {
    const info = await stat(file);
    if (Date.now() - info.mtimeMs <= ttlMs) {
      const cached = await readCached(file);
      if (cached !== null) return cached;
    }
  } catch {}

  try {
    const text = await fetcher(url);
    await mkdir(cacheDir, { recursive: true });
    await writeFile(file, text, 'utf8');
    return text;
  } catch (error) {
    if (staleOnError) {
      const cached = await readCached(file);
      if (cached !== null) return cached;
    }
    throw error;
  }
}
