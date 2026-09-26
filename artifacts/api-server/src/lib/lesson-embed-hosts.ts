// Novi vanjski sadržaj ispod lekcija dolazi samo s ovih platformi.
// Stare priloge i ugrađene iframeove s drugih izvora ne brišemo.
const NEW_EMBED_HOSTS = [
  "learningapps.org",
  "wordwall.net",
  "wayground.com",
  "kahoot.it",
  "kahoot.com",
];

const LEGACY_EMBED_HOSTS = [
  "genial.ly",
  "quizizz.com",
  "padlet.com",
  "mentimeter.com",
  "h5p.org",
];

const CONTENT_EXTRA_HOSTS = ["youtube.com", "youtube-nocookie.com"];

export const CONTENT_IFRAME_WHITELIST = [
  ...NEW_EMBED_HOSTS,
  ...LEGACY_EMBED_HOSTS,
  ...CONTENT_EXTRA_HOSTS,
];

function matchesHost(url: string, domains: readonly string[]): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const host = parsed.hostname.toLowerCase();
    return domains.some(domain => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

export function isAllowedNewEmbedUrl(url: string): boolean {
  return matchesHost(url, NEW_EMBED_HOSTS);
}

export function extractEmbedSrc(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed) && !/<iframe/i.test(trimmed)) {
    return trimmed.length <= 2000 ? trimmed : null;
  }
  const match = trimmed.match(/<iframe[^>]+src\s*=\s*["']([^"']+)["']/i);
  if (match?.[1] && /^https?:\/\//i.test(match[1]) && match[1].length <= 2000) {
    return match[1];
  }
  return null;
}

function iframeSrcs(html: string): string[] {
  if (typeof html !== "string" || !html) return [];
  const srcs: string[] = [];
  for (const match of html.matchAll(/<iframe\b[^>]*>/gi)) {
    srcs.push(match[0].match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] || "");
  }
  return srcs;
}

export function findDisallowedIframeSrcs(html: string, previousHtml = ""): string[] {
  const legacyCounts = new Map<string, number>();
  for (const src of iframeSrcs(previousHtml)) {
    if (matchesHost(src, LEGACY_EMBED_HOSTS)) {
      const key = src.replace(/&amp;/gi, "&");
      legacyCounts.set(key, (legacyCounts.get(key) ?? 0) + 1);
    }
  }

  const bad: string[] = [];
  for (const src of iframeSrcs(html)) {
    if (matchesHost(src, [...NEW_EMBED_HOSTS, ...CONTENT_EXTRA_HOSTS])) continue;
    const key = src.replace(/&amp;/gi, "&");
    const previousCount = legacyCounts.get(key) ?? 0;
    if (previousCount > 0 && matchesHost(src, LEGACY_EMBED_HOSTS)) {
      legacyCounts.set(key, previousCount - 1);
    } else {
      bad.push(src || "(iframe bez src)");
    }
  }
  return bad;
}