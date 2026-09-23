import { QURAN_PAGES } from "@/lib/quran";

export function quranPageFromSlug(slug?: string | null): number | null {
  const match = /^kuran-stranica-([1-9]\d*)$/.exec(slug ?? "");
  const page = match ? Number(match[1]) : NaN;
  return Number.isInteger(page) && page <= QURAN_PAGES ? page : null;
}

export function lessonHref(slug: string): string {
  const page = quranPageFromSlug(slug);
  return page ? `/kuran/stranica/${page}` : `/ilmihal/${slug}`;
}