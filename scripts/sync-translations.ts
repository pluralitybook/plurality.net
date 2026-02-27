/**
 * Auto-sync translations.json by discovering chapters from upstream GitHub repos.
 *
 * For each language in translations.json, this script:
 * 1. Lists .md files in the upstream repo's content directory via GitHub API
 * 2. Parses filenames to extract chapter IDs and titles
 * 3. Adds any new chapters not yet in translations.json
 *
 * Usage: bun scripts/sync-translations.ts [--dry-run]
 */

import { resolve } from "path";

const ROOT = resolve(import.meta.dir, "..");
const TRANSLATIONS_PATH = resolve(ROOT, "src/_data/translations.json");
const CHAPTERS_PATH = resolve(ROOT, "src/_data/chapters.json");

const dryRun = process.argv.includes("--dry-run");
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

const translations = await Bun.file(TRANSLATIONS_PATH).json();
const chapters = await Bun.file(CHAPTERS_PATH).json();

// Build set of valid chapter IDs from chapters.json
const validChapterIds = new Set<string>();
for (const section of chapters.sections) {
  for (const ch of section.chapters) {
    validChapterIds.add(ch.id);
  }
}

// Parse a filename like "07-01 Schlussfolgerungen.md" → { id: "7-1", file: "07-01 Schlussfolgerungen", title: "Schlussfolgerungen" }
// or "01 Vorwort.md" → { id: "1", file: "01 Vorwort", title: "Vorwort" }
function parseFilename(name: string): { id: string; file: string; title: string } | null {
  if (!name.endsWith(".md")) return null;

  const base = name.slice(0, -3); // strip .md

  // Match patterns like "07-01 Title" or "01 Title" or "00-00 Title"
  const match = base.match(/^(\d{2})(?:-(\d{2}))?\s+(.+)$/);
  if (!match) return null;

  const major = parseInt(match[1], 10);
  const minor = match[2] !== undefined ? parseInt(match[2], 10) : undefined;
  const title = match[3];

  const id = minor !== undefined ? `${major}-${minor}` : `${major}`;

  return { id, file: base, title };
}

// Parse githubBase URL to get owner/repo and path prefix
// e.g. "https://raw.githubusercontent.com/GermanPluralityBook/pluralitaet/main/contents/"
// → { owner: "GermanPluralityBook", repo: "pluralitaet", branch: "main", pathPrefix: "contents" }
function parseGithubBase(url: string) {
  const match = url.match(
    /raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+?)\/?$/
  );
  if (!match) return null;
  return { owner: match[1], repo: match[2], branch: match[3], pathPrefix: match[4] };
}

// Minimum file size in bytes to consider a chapter as having real content (not a stub)
const MIN_FILE_SIZE = 10;

async function listRepoFiles(owner: string, repo: string, path: string): Promise<{ name: string; size: number }[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURI(path)}`;
  const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.error(`  Failed to list ${owner}/${repo}/${path}: ${res.status} ${res.statusText}`);
    return [];
  }
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.filter((f: any) => f.type === "file").map((f: any) => ({ name: f.name, size: f.size }));
}

let totalAdded = 0;

for (const [lang, langData] of Object.entries(translations) as [string, any][]) {
  if (lang === "en") continue; // English uses local files
  if (!langData.githubBase) continue;

  const parsed = parseGithubBase(langData.githubBase);
  if (!parsed) {
    console.error(`  Could not parse githubBase for ${lang}: ${langData.githubBase}`);
    continue;
  }

  const dirPath = `${parsed.pathPrefix}/${langData.dir}`;
  console.log(`[${lang}] Checking ${parsed.owner}/${parsed.repo}/${dirPath} ...`);

  const files = await listRepoFiles(parsed.owner, parsed.repo, dirPath);
  if (files.length === 0) {
    console.log(`  No files found (or API error)`);
    continue;
  }

  let added = 0;
  for (const { name, size } of files) {
    if (size < MIN_FILE_SIZE) continue; // skip stubs

    const info = parseFilename(name);
    if (!info) continue;

    // Only add if it's a valid chapter and not already mapped
    if (!validChapterIds.has(info.id)) continue;
    if (langData.files[info.id]) continue;

    console.log(`  + ${info.id}: "${info.file}" (${info.title}) [${size} bytes]`);
    langData.files[info.id] = { file: info.file, title: info.title };
    added++;
  }

  if (added > 0) {
    console.log(`  Added ${added} new chapter(s) for ${lang}`);
    totalAdded += added;
  } else {
    console.log(`  Up to date`);
  }
}

if (totalAdded > 0) {
  if (dryRun) {
    console.log(`\nDry run: would update ${totalAdded} chapter(s) total`);
  } else {
    await Bun.write(TRANSLATIONS_PATH, JSON.stringify(translations, null, 2) + "\n");
    console.log(`\nUpdated translations.json with ${totalAdded} new chapter(s)`);
  }
} else {
  console.log(`\nNo new chapters found — translations.json is up to date`);
}

// Exit with code 0 if no changes, 0 if changes (GitHub Action checks git diff)
