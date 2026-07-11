export function parseIndexMarkdown(raw: string): string[] {
  const terms: string[] = [];
  const codeBlockRe = /```\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = codeBlockRe.exec(String(raw))) !== null) {
    for (const line of match[1].split('\n')) {
      const tab = line.indexOf('\t');
      if (tab === -1) continue;
      const term = line.slice(0, tab).trim();
      if (term) terms.push(term);
    }
  }
  return terms;
}
