const SUPPORTED: Record<string, true> = {
  en: true,
  zh: true,
  ja: true,
  de: true,
  th: true,
  el: true,
}

/** Explicit ?lang= from search.js; default en. Phase 3 adds script heuristic. */
export function resolveQueryLang(param: string | undefined): string {
  const lang = param?.trim().toLowerCase()
  if (lang && lang in SUPPORTED) return lang
  return 'en'
}