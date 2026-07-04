/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare module "markdown-it-footnote" {
  import type MarkdownIt from "markdown-it";
  const plugin: MarkdownIt.PluginSimple;
  export default plugin;
}
