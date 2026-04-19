import { parseFilename, parseGithubBase } from "./parse-translations";

export type ApiFile = { name: string; size: number };
export type ListFiles = (
  owner: string,
  repo: string,
  path: string
) => Promise<ApiFile[]>;
export type Logger = {
  log: (msg: string) => void;
  error: (msg: string) => void;
};

export const MIN_FILE_SIZE = 10;

export type Translations = Record<
  string,
  {
    dir: string;
    label?: string;
    prefix?: string;
    githubBase?: string;
    files?: Record<string, { file: string; title: string }>;
  }
>;
export type Chapters = { sections: { chapters: { id: string }[] }[] };

export function collectValidChapterIds(chapters: Chapters): Set<string> {
  const ids = new Set<string>();
  for (const section of chapters.sections) {
    for (const ch of section.chapters) ids.add(ch.id);
  }
  return ids;
}

export type SyncOptions = {
  translations: Translations;
  chapters: Chapters;
  listFiles: ListFiles;
  logger?: Logger;
};

export type SyncResult = { added: Record<string, string[]>; total: number };

/**
 * Pure sync core — no file IO. Mutates `translations` in place and returns
 * a summary of what was added, grouped by language.
 */
export async function syncTranslations({
  translations,
  chapters,
  listFiles,
  logger = { log: () => {}, error: () => {} },
}: SyncOptions): Promise<SyncResult> {
  const valid = collectValidChapterIds(chapters);
  const added: Record<string, string[]> = {};
  let total = 0;

  for (const [lang, langData] of Object.entries(translations)) {
    if (lang === "en") continue;
    if (!langData.githubBase) continue;

    const parsed = parseGithubBase(langData.githubBase);
    if (!parsed) {
      logger.error(`Could not parse githubBase for ${lang}: ${langData.githubBase}`);
      continue;
    }

    const dirPath = `${parsed.pathPrefix}/${langData.dir}`;
    logger.log(`[${lang}] Checking ${parsed.owner}/${parsed.repo}/${dirPath} ...`);

    const files = await listFiles(parsed.owner, parsed.repo, dirPath);
    if (files.length === 0) {
      logger.log(`  No files found (or API error)`);
      continue;
    }

    langData.files ??= {};
    const addedIds: string[] = [];

    for (const { name, size } of files) {
      if (size < MIN_FILE_SIZE) continue;

      const info = parseFilename(name);
      if (!info) continue;
      if (!valid.has(info.id)) continue;
      if (langData.files[info.id]) continue;

      logger.log(`  + ${info.id}: "${info.file}" (${info.title}) [${size} bytes]`);
      langData.files[info.id] = { file: info.file, title: info.title };
      addedIds.push(info.id);
    }

    if (addedIds.length) {
      logger.log(`  Added ${addedIds.length} new chapter(s) for ${lang}`);
      added[lang] = addedIds;
      total += addedIds.length;
    } else {
      logger.log(`  Up to date`);
    }
  }

  return { added, total };
}

export function makeGithubListFiles(token: string): ListFiles {
  return async (owner, repo, path) => {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURI(path)}`;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .filter((f: any) => f.type === "file")
      .map((f: any) => ({ name: f.name, size: f.size }));
  };
}
