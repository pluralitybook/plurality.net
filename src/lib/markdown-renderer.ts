import MarkdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import markdownItFootnote from "markdown-it-footnote";
import { cleanMarkdown } from "./markdown";

const md = new MarkdownIt({ html: true, typographer: true, linkify: true })
  .use(markdownItAnchor, { permalink: false, level: [2, 3, 4] })
  .use(markdownItFootnote);

export function renderBookMarkdown(raw: string): string {
  if (!raw) return "";
  return md.render(cleanMarkdown(raw));
}
