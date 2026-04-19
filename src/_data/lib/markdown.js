// Replicate markdown-it-anchor's default slugify
export function slugify(s) {
  return encodeURIComponent(String(s).trim().toLowerCase().replace(/\s+/g, "-"));
}

export function stripInlineMarkdown(s) {
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "");
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  s = s.replace(/\[\^[^\]]*\]/g, "");
  s = s.replace(/^\[\^[^\]]*\]:.*$/gm, "");
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(/(\*{1,3}|_{1,3})/g, "");
  s = s.replace(/^>\s?/gm, "");
  s = s.replace(/^[-*_]{3,}\s*$/gm, "");
  s = s.replace(/```[\s\S]*?```/g, "");
  s = s.replace(/`([^`]*)`/g, "$1");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

export function cleanFrontMatter(raw) {
  let s = String(raw);
  s = s.replace(/^\s*#\s+.+\n+/, "");
  s = s.replace(/^\|?\s*原文[：:][\s\S]*?(?=\n---)/m, "");
  s = s.replace(/^\s*---\s*\n/, "");
  return s;
}

export function splitByHeadings(raw) {
  const cleaned = cleanFrontMatter(raw);
  const headingRe = /^(#{2,4})\s+(.+)$/gm;
  const subsections = [];
  let lastIdx = 0;
  let lastHeading = null;
  let lastAnchor = null;
  let match;

  while ((match = headingRe.exec(cleaned)) !== null) {
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
