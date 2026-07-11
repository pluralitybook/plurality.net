/**
 * Library entry: exports `main()` for tests and other callers.
 * The CLI thin wrapper lives in scripts/sync-translations-bin.ts.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { makeGithubListFiles, syncTranslations, type ListFiles } from './lib/sync-core';

const ROOT = resolve(import.meta.dirname, '..');
export const TRANSLATIONS_PATH = resolve(ROOT, 'src/data/translations.json');
export const CHAPTERS_PATH = resolve(ROOT, 'src/data/chapters.json');

export type MainOptions = {
  translationsPath?: string;
  chaptersPath?: string;
  dryRun?: boolean;
  listFiles?: ListFiles;
  logger?: { log: (m: string) => void; error: (m: string) => void };
};

export async function main({
  translationsPath = TRANSLATIONS_PATH,
  chaptersPath = CHAPTERS_PATH,
  dryRun = false,
  listFiles = makeGithubListFiles(process.env.GITHUB_TOKEN || ''),
  logger = { log: (m) => console.log(m), error: (m) => console.error(`  ${m}`) },
}: MainOptions = {}): Promise<number> {
  const translations = JSON.parse(await readFile(translationsPath, 'utf-8'));
  const chapters = JSON.parse(await readFile(chaptersPath, 'utf-8'));

  const { total } = await syncTranslations({
    translations,
    chapters,
    listFiles,
    logger,
  });

  if (total > 0) {
    if (dryRun) {
      logger.log(`\nDry run: would update ${total} chapter(s) total`);
    } else {
      await writeFile(translationsPath, JSON.stringify(translations, null, 2) + '\n');
      logger.log(`\nUpdated translations.json with ${total} new chapter(s)`);
    }
  } else {
    logger.log(`\nNo new chapters found — translations.json is up to date`);
  }

  return total;
}
