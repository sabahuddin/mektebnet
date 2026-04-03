import { apiRequest } from "./api";

let _cache: Record<string, string> | null = null;
let _fetching: Promise<Record<string, string>> | null = null;

export async function fetchRjecnik(): Promise<Record<string, string>> {
  if (_cache) return _cache;
  if (_fetching) return _fetching;
  _fetching = apiRequest<Record<string, string>>("GET", "/content/rjecnik")
    .then(data => { _cache = data; return data; })
    .catch(() => {
      _cache = {};
      return _cache;
    })
    .finally(() => { _fetching = null; });
  return _fetching;
}

export function invalidateRjecnikCache() {
  _cache = null;
}

export function getRjecnikSync(): Record<string, string> {
  return _cache || {};
}

export function processRjecnik(html: string, dict?: Record<string, string>): string {
  const rjecnik = dict || getRjecnikSync();
  const words = Object.keys(rjecnik);
  if (words.length === 0) return html;

  const sortedWords = words.sort((a, b) => b.length - a.length);
  const wordPattern = sortedWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(`(?<![\\wčćžšđ])(${wordPattern})(?![\\wčćžšđ])`, "gi");

  const seen = new Set<string>();

  return html.replace(/>([^<]+)</g, (match, text) => {
    const replaced = text.replace(regex, (word: string) => {
      const key = word.toLowerCase();
      const def = rjecnik[key];
      if (!def) return word;
      if (seen.has(key)) return word;
      seen.add(key);
      return `<span class="rjecnik-rijec" data-def="${def.replace(/"/g, "&quot;")}" tabindex="0">${word}</span>`;
    });
    return `>${replaced}<`;
  });
}
