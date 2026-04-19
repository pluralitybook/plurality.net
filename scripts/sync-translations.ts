/**
 * Library entry: exports `main()` for tests and other callers.
 * The CLI thin wrapper lives in scripts/sync-translations-bin.ts.
 */

import { resolve } from "path";
import {
  makeGithubListFiles,
  syncTranslations,
  type ListFiles,
} from "./lib/sync-core";

const ROOT = resolve(import.meta.dir, "..");
export const TRANSLATIONS_PATH = resolve(ROOT, "src/_data/translations.json");
export const CHAPTERS_PATH = resolve(ROOT, "src/_data/chapters.json");

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
  listFiles = makeGithubListFiles(process.env.GITHUB_TOKEN || ""),
  logger = { log: (m) => console.log(m), error: (m) => console.error(`  ${m}`) },
}: MainOptions = {}): Promise<number> {
  const translations = await Bun.file(translationsPath).json();
  const chapters = await Bun.file(chaptersPath).json();

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
      await Bun.write(
        translationsPath,
        JSON.stringify(translations, null, 2) + "\n"
      );
      logger.log(`\nUpdated translations.json with ${total} new chapter(s)`);
    }
  } else {
    logger.log(`\nNo new chapters found — translations.json is up to date`);
  }

  return total;
}
