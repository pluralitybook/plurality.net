/**
 * Extract the English book-index terms from the upstream markdown document.
 *
 * The upstream file stores terms inside fenced code blocks as `term<TAB>page`
 * lines. We collect the terms, preserving order, and skip any line without a
 * tab separator.
 */
export function parseIndexMarkdown(raw) {
  const terms = [];
  const codeBlockRe = /```\n([\s\S]*?)```/g;
  let match;
  while ((match = codeBlockRe.exec(String(raw))) !== null) {
    for (const line of match[1].split("\n")) {
      const tab = line.indexOf("\t");
      if (tab === -1) continue;
      const term = line.slice(0, tab).trim();
      if (term) terms.push(term);
    }
  }
  return terms;
}
