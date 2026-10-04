export interface TextLinkPart {
  text: string;
  href?: string;
}

// Descriptions remain plain text. Only explicit web URLs become links.
export function linkifyText(text: string): TextLinkPart[] {
  const parts: TextLinkPart[] = [];
  const urls = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;
  let cursor = 0;

  for (const match of text.matchAll(urls)) {
    let candidate = match[0];
    const brackets = [["(", ")"], ["[", "]"], ["{", "}"]] as const;
    const balances = brackets.map(([open, close]) => ({
      close,
      balance: [...candidate].reduce((sum, char) => sum + (char === open ? 1 : char === close ? -1 : 0), 0),
    }));
    while (candidate) {
      const last = candidate.at(-1)!;
      const bracket = balances.find((entry) => entry.close === last && entry.balance < 0);
      if (/[.,;:!?'"’”]/.test(last)) candidate = candidate.slice(0, -1);
      else if (bracket) {
        bracket.balance++;
        candidate = candidate.slice(0, -1);
      } else break;
    }
    let url: URL;
    try {
      url = new URL(/^www\./i.test(candidate) ? `https://${candidate}` : candidate);
      if (!["http:", "https:"].includes(url.protocol)) continue;
    } catch {
      continue;
    }

    const start = match.index!;
    if (start > cursor) parts.push({ text: text.slice(cursor, start) });
    parts.push({ text: candidate, href: url.href });
    cursor = start + candidate.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}