export type NapametNivo = 1 | 2 | 3 | 4;

export interface NapametStavka {
  id: string;
  nivo: NapametNivo;
  naziv: string;
  redoslijed: number;
}

// Početni program je sastavljen od sadržaja koji se već koristi u mektebu.
// ID-jevi su stabilni kako bi ocjene ostale vezane za istu stavku i nakon
// dodavanja novih redova u budućnosti.
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

import { db } from "@workspace/db";
import { napametProgramTable } from "@workspace/db/schema";
import { and, asc, eq } from "drizzle-orm";

/** Lazily materialize the shared starter catalogue for a mekteb. */
export async function getNapametKatalog(mektebId: number, includeHidden = false): Promise<(NapametStavka & { isVisible?: boolean })[]> {
  await db.insert(napametProgramTable).values(NAPAMET_KATALOG.map((item) => ({
    mektebId, stavkaId: item.id, nivo: item.nivo, naziv: item.naziv, redoslijed: item.redoslijed,
  }))).onConflictDoNothing();
  const rows = await db.select({
    id: napametProgramTable.stavkaId,
    nivo: napametProgramTable.nivo,
    naziv: napametProgramTable.naziv,
    redoslijed: napametProgramTable.redoslijed,
    isVisible: napametProgramTable.isVisible,
  }).from(napametProgramTable).where(
    includeHidden ? eq(napametProgramTable.mektebId, mektebId) :
      and(eq(napametProgramTable.mektebId, mektebId), eq(napametProgramTable.isVisible, true)),
  ).orderBy(asc(napametProgramTable.nivo), asc(napametProgramTable.redoslijed));
  return rows.map(row => ({ ...row, nivo: row.nivo as NapametNivo }));
}
