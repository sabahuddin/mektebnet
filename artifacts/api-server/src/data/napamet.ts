import { db } from "@workspace/db";
import {
  ilmihalLekcijeTable,
  napametGlobalProgramTable,
  napametMuallimProgramTable,
  napametProgramTable,
} from "@workspace/db/schema";
import { and, asc, eq } from "drizzle-orm";

export type NapametNivo = 1 | 2 | 3 | 4;
export type NapametScope = "global" | "lokalno" | "legacy";

export interface NapametStavka {
  id: string;
  nivo: NapametNivo;
  naziv: string;
  redoslijed: number;
  isVisible?: boolean;
  scope?: NapametScope;
  sourceLessonSlug?: string | null;
}

// Stabilni identiteti iz prvog NAPAMET programa ostaju nepromijenjeni, tako da
// svaka postojeća ocjena i dalje pokazuje na istu stavku.
export const NAPAMET_KATALOG: NapametStavka[] = [
  { id: "n1-fatiha", nivo: 1, naziv: "El-Fatiha", redoslijed: 1 },
  { id: "n1-ihlās", nivo: 1, naziv: "El-Ihlas", redoslijed: 2 },
  { id: "n1-felek", nivo: 1, naziv: "El-Felek", redoslijed: 3 },
  { id: "n1-nas", nivo: 1, naziv: "En-Nas", redoslijed: 4 },
  { id: "n1-kafirun", nivo: 1, naziv: "El-Kafirun", redoslijed: 5 },
  { id: "n2-kevser", nivo: 2, naziv: "El-Kevser", redoslijed: 1 },
  { id: "n2-asr", nivo: 2, naziv: "El-Asr", redoslijed: 2 },
  { id: "n2-nasr", nivo: 2, naziv: "En-Nasr", redoslijed: 3 },
  { id: "n2-maun", nivo: 2, naziv: "El-Maun", redoslijed: 4 },
  { id: "n2-kurejs", nivo: 2, naziv: "Kurejš", redoslijed: 5 },
  { id: "n3-fil", nivo: 3, naziv: "El-Fil", redoslijed: 1 },
  { id: "n3-humeze", nivo: 3, naziv: "El-Humeze", redoslijed: 2 },
  { id: "n3-teblas", nivo: 3, naziv: "El-Leheb", redoslijed: 3 },
  { id: "n3-kadr", nivo: 3, naziv: "El-Kadr", redoslijed: 4 },
  { id: "n3-bejjine", nivo: 3, naziv: "El-Bejjine", redoslijed: 5 },
  { id: "d-iftitah", nivo: 4, naziv: "Dova iftitah", redoslijed: 1 },
  { id: "d-kunut", nivo: 4, naziv: "Kunut-dova", redoslijed: 2 },
  { id: "d-ettehijjatu", nivo: 4, naziv: "Ettehijjatu", redoslijed: 3 },
  { id: "d-salavati", nivo: 4, naziv: "Salavati", redoslijed: 4 },
];
export const NAPAMET_KATALOG_MAP = new Map(NAPAMET_KATALOG.map((item) => [item.id, item]));

const asNivo = (nivo: number): NapametNivo => ([1, 2, 3, 4].includes(nivo) ? nivo : 4) as NapametNivo;

function canonicalNapametName(naziv: string): string {
  return naziv
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bucenje\b|\bsure?\b|\bdova?\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function lessonCandidate(lesson: { slug: string; naslov: string; nivo: number; redoslijed: number }): NapametStavka | null {
  // Sadržaj ima kanonski slug, pa ne oslanjamo se na prijevod naslova. U
  // globalni program ulaze sve objavljene sure i dove iz Ilmihal lekcija.
  if (!lesson.slug.startsWith("sura-") && !lesson.slug.includes("dova")) return null;
  return {
    id: `lekcija-${lesson.slug}`.slice(0, 80),
    nivo: asNivo(lesson.nivo),
    naziv: lesson.naslov.trim(),
    redoslijed: 10000 + lesson.redoslijed,
    sourceLessonSlug: lesson.slug,
  };
}

/** Seed globalnih stavki je idempotentan i automatski pokupi nove sure/dove iz lekcija. */
export async function ensureGlobalNapametKatalog(): Promise<void> {
  const lessons = await db.select({
    slug: ilmihalLekcijeTable.slug,
    naslov: ilmihalLekcijeTable.naslov,
    nivo: ilmihalLekcijeTable.nivo,
    redoslijed: ilmihalLekcijeTable.redoslijed,
  }).from(ilmihalLekcijeTable).where(eq(ilmihalLekcijeTable.isPublished, true));
  const items = [
    ...NAPAMET_KATALOG,
    ...lessons.map(lessonCandidate).filter((item): item is NapametStavka => item !== null),
  ];
  // Početna lista je namjerno prva: sačuva stabilni ID postojećih ocjena, a
  // slug istoimene Ilmihal lekcije se samo pridruži toj stavci.
  const byName = new Map<string, NapametStavka>();
  for (const item of items) {
    const key = canonicalNapametName(item.naziv);
    const existing = byName.get(key);
    if (!existing) byName.set(key, { ...item });
    else if (!existing.sourceLessonSlug && item.sourceLessonSlug) existing.sourceLessonSlug = item.sourceLessonSlug;
  }
  const unique = [...byName.values()];
  if (!unique.length) return;
  await db.insert(napametGlobalProgramTable).values(unique.map((item) => ({
    stavkaId: item.id,
    nivo: item.nivo,
    naziv: item.naziv,
    redoslijed: item.redoslijed,
    sourceLessonSlug: item.sourceLessonSlug ?? null,
  }))).onConflictDoNothing();
}

export async function getGlobalNapametKatalog(includeHidden = false): Promise<NapametStavka[]> {
  await ensureGlobalNapametKatalog();
  const rows = await db.select({
    id: napametGlobalProgramTable.stavkaId,
    nivo: napametGlobalProgramTable.nivo,
    naziv: napametGlobalProgramTable.naziv,
    redoslijed: napametGlobalProgramTable.redoslijed,
    isVisible: napametGlobalProgramTable.isVisible,
    sourceLessonSlug: napametGlobalProgramTable.sourceLessonSlug,
  }).from(napametGlobalProgramTable).where(
    includeHidden ? undefined : eq(napametGlobalProgramTable.isVisible, true),
  ).orderBy(asc(napametGlobalProgramTable.nivo), asc(napametGlobalProgramTable.redoslijed));
  return rows.map((row) => ({ ...row, nivo: asNivo(row.nivo), scope: "global" }));
}

type NapametKatalogOptions = {
  mektebId?: number | null;
  grupaId?: number | null;
  muallimId?: number | null;
  includeHidden?: boolean;
};

/**
 * Objedinjeni katalog za konkretan kontekst. Stari mektebski redovi ostaju
 * dostupni samo kao kompatibilni dodatak, čime se postojeće ocjene nikada ne
 * gube kada mekteb pređe na globalni katalog.
 */
export async function getNapametKatalog({
  mektebId,
  grupaId,
  muallimId,
  includeHidden = false,
}: NapametKatalogOptions = {}): Promise<NapametStavka[]> {
  const [globalne, lokalne, legacy] = await Promise.all([
    getGlobalNapametKatalog(includeHidden),
    grupaId ? db.select({
      id: napametMuallimProgramTable.stavkaId,
      nivo: napametMuallimProgramTable.nivo,
      naziv: napametMuallimProgramTable.naziv,
      redoslijed: napametMuallimProgramTable.redoslijed,
      isVisible: napametMuallimProgramTable.isVisible,
    }).from(napametMuallimProgramTable).where(
      muallimId
        ? and(eq(napametMuallimProgramTable.grupaId, grupaId), eq(napametMuallimProgramTable.muallimId, muallimId))
        : eq(napametMuallimProgramTable.grupaId, grupaId),
    ).orderBy(asc(napametMuallimProgramTable.nivo), asc(napametMuallimProgramTable.redoslijed)) : [],
    mektebId ? db.select({
      id: napametProgramTable.stavkaId,
      nivo: napametProgramTable.nivo,
      naziv: napametProgramTable.naziv,
      redoslijed: napametProgramTable.redoslijed,
      isVisible: napametProgramTable.isVisible,
    }).from(napametProgramTable).where(
      includeHidden
        ? eq(napametProgramTable.mektebId, mektebId)
        : and(eq(napametProgramTable.mektebId, mektebId), eq(napametProgramTable.isVisible, true)),
    ).orderBy(asc(napametProgramTable.nivo), asc(napametProgramTable.redoslijed)) : [],
  ]);

  const merged = new Map<string, NapametStavka>();
  for (const item of globalne) merged.set(item.id, item);
  for (const item of lokalne) {
    if (includeHidden || item.isVisible) merged.set(item.id, { ...item, nivo: asNivo(item.nivo), scope: "lokalno" });
  }
  for (const item of legacy) {
    if ((includeHidden || item.isVisible) && !merged.has(item.id)) {
      merged.set(item.id, { ...item, nivo: asNivo(item.nivo), scope: "legacy" });
    }
  }
  return [...merged.values()].sort((a, b) => a.nivo - b.nivo || a.redoslijed - b.redoslijed || a.naziv.localeCompare(b.naziv, "bs"));
}