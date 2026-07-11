// Astro generates `.astro/types.d.ts` for content-collection ambient types; it has
// no ES module form, so the official Astro convention is this triple-slash path
// reference (see astro sync / astro dev output). An import would turn this file
// into a module and break the `declare module` augmentation below.
// oxlint-disable-next-line typescript/triple-slash-reference
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare module 'markdown-it-footnote' {
  import type MarkdownIt from 'markdown-it';
  const plugin: MarkdownIt.PluginSimple;
  export default plugin;
}
