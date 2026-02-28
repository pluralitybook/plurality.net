import EleventyFetch from "@11ty/eleventy-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const chapters = JSON.parse(
  fs.readFileSync(path.join(__dirname, "chapters.json"), "utf-8")
);
const translations = JSON.parse(
  fs.readFileSync(path.join(__dirname, "translations.json"), "utf-8")
);
const i18n = JSON.parse(
  fs.readFileSync(path.join(__dirname, "i18n.json"), "utf-8")
);

// Replicate markdown-it-anchor's default slugify
function slugify(s) {
  return encodeURIComponent(String(s).trim().toLowerCase().replace(/\s+/g, "-"));
}

function stripInlineMarkdown(s) {
  // Remove images
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "");
  // Remove links but keep text
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  // Remove footnote references
  s = s.replace(/\[\^[^\]]*\]/g, "");
  // Remove footnote definitions
  s = s.replace(/^\[\^[^\]]*\]:.*$/gm, "");
  // Remove HTML tags
  s = s.replace(/<[^>]+>/g, "");
  // Remove bold/italic markers
  s = s.replace(/(\*{1,3}|_{1,3})/g, "");
  // Remove blockquote markers
  s = s.replace(/^>\s?/gm, "");
  // Remove horizontal rules
  s = s.replace(/^[-*_]{3,}\s*$/gm, "");
  // Remove code blocks
  s = s.replace(/```[\s\S]*?```/g, "");
  s = s.replace(/`([^`]*)`/g, "$1");
  // Collapse multiple newlines
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

function cleanFrontMatter(raw) {
  let s = String(raw);
  // Remove leading # Title line
  s = s.replace(/^\s*#\s+.+\n+/, "");
  // Remove Chinese translation metadata block
  s = s.replace(/^\|?\s*原文[：:][\s\S]*?(?=\n---)/m, "");
  s = s.replace(/^\s*---\s*\n/, "");
  return s;
}

// Split markdown by h2/h3/h4 headings into subsections
function splitByHeadings(raw) {
  const cleaned = cleanFrontMatter(raw);
  // Match ## or ### or #### headings
  const headingRe = /^(#{2,4})\s+(.+)$/gm;
  const subsections = [];
  let lastIdx = 0;
  let lastHeading = null;
  let lastAnchor = null;
  let match;

  while ((match = headingRe.exec(cleaned)) !== null) {
    // Capture content before this heading
    const content = cleaned.substring(lastIdx, match.index);
    const stripped = stripInlineMarkdown(content);
    if (stripped) {
      subsections.push({
        heading: lastHeading,
        anchor: lastAnchor,
        content: stripped,
      });
    }
    lastHeading = match[2].trim();
    lastAnchor = slugify(lastHeading);
    lastIdx = match.index + match[0].length;
  }

  // Capture trailing content after the last heading
  const trailing = cleaned.substring(lastIdx);
  const strippedTrailing = stripInlineMarkdown(trailing);
  if (strippedTrailing) {
    subsections.push({
      heading: lastHeading,
      anchor: lastAnchor,
      content: strippedTrailing,
    });
  }

  return subsections;
}

export default async function () {
  const targetLangs = ["zh", "ja"];
  const result = {};

  for (const lang of targetLangs) {
    const langData = translations[lang];
    if (!langData || !langData.files) {
      result[lang] = [];
      continue;
    }

    const base = langData.githubBase ||
      "https://raw.githubusercontent.com/pluralitybook/plurality/main/contents/";
    const langI18n = i18n[lang] || {};
    const entries = [];

    for (const section of chapters.sections) {
      const sectionName = (langI18n.sections && langI18n.sections[section.title]) || section.title;

      for (const ch of section.chapters) {
        const override = langData.files[ch.id];
        if (!override) continue;

        const file = override.file;
        const title = override.title;
        const encodedFile = encodeURIComponent(file + ".md");
        const url = `${base}${langData.dir}/${encodedFile}`;
        const pageUrl = `${langData.prefix}/read/${ch.id}/`;
        const sectionLabel = `${sectionName} · ${ch.number}`;

        try {
          const raw = await EleventyFetch(url, { duration: "1d", type: "text" });
          const subsections = splitByHeadings(raw);

          entries.push({
            title,
            section: sectionLabel,
            url: pageUrl,
            subsections,
          });
        } catch (e) {
          // Skip chapters that fail to fetch
        }
      }
    }

    result[lang] = entries;
  }

  return result;
}
