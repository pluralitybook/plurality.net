export function keys(obj) {
  return Object.keys(obj || {});
}

export function where(arr, key, val) {
  if (!arr) return [];
  return arr.filter((item) => item[key] === val);
}

export function slice(arr, start, end) {
  if (!arr) return [];
  return arr.slice(start, end);
}

export function first(arr) {
  if (!arr || !arr.length) return null;
  return arr[0];
}

export function attr(obj, key) {
  if (!obj) return "";
  return obj[key] || "";
}

// Clean fetched markdown: strip leading # title and translation front matter
export function cleanMarkdown(raw) {
  let s = String(raw);
  s = s.replace(/^\s*#\s+.+\n+/, "");
  s = s.replace(/^\|?\s*原文[：:][\s\S]*?(?=\n---)/m, "");
  s = s.replace(/^\s*---\s*\n/, "");
  return s;
}
