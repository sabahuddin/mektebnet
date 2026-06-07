import { db } from "@workspace/db";
import {
  grupeTable,
  ucenikProfiliTable,
  priustvoTable,
  ocjeneTable,
  zadaceTable,
  zadaceStatusTable,
  zadaceUceniciTable,
} from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";

export interface StudentGodine {
  // Sve mektebske godine u kojima učenik ima upise (najnovija prva).
  godine: string[];
  // Trenutna (aktivna) mektebska godina — iz grupe u kojoj je učenik sada.
  tekuca: string | null;
  // Mapa: mektebska godina -> id-evi grupa te godine vezanih za učenika.
  yearToGroupIds: Map<string, number[]>;
  // Trenutna grupa učenika (ili null).
  tekucaGrupaId: number | null;
}

/**
 * Skuplja sve grupe (preko grupaId) u kojima učenik ima bilo kakav trag
 * (prisustvo, ocjene, zadaće preko statusa/targeta) + trenutnu grupu, te ih
 * grupiše po mektebskoj godini (grupe.skolskaGodina).
 *
 * Napomena: napredak (lekcije, med, aferimi, kvizovi) se NE tiče ovoga — on je
 * uvijek kumulativan i vezan za nalog učenika.
 */
export async function getStudentGodine(ucenikUserId: number): Promise<StudentGodine> {
  const [profil] = await db
    .select()
    .from(ucenikProfiliTable)
    .where(eq(ucenikProfiliTable.userId, ucenikUserId));
  const tekucaGrupaId = profil?.grupaId ?? null;

  const grupaIds = new Set<number>();
  if (tekucaGrupaId) grupaIds.add(tekucaGrupaId);

  // Prisustvo (grupaId notNull)
  const pris = await db
    .select({ grupaId: priustvoTable.grupaId })
    .from(priustvoTable)
    .where(eq(priustvoTable.ucenikId, ucenikUserId));
  for (const r of pris) if (r.grupaId != null) grupaIds.add(r.grupaId);

  // Ocjene (grupaId nullable)
  const ocj = await db
    .select({ grupaId: ocjeneTable.grupaId })
    .from(ocjeneTable)
    .where(eq(ocjeneTable.ucenikId, ucenikUserId));
  for (const r of ocj) if (r.grupaId != null) grupaIds.add(r.grupaId);

  // Zadaće preko statusa učenika
  const statusZadaceIds = (
    await db
      .select({ zadacaId: zadaceStatusTable.zadacaId })
      .from(zadaceStatusTable)
      .where(eq(zadaceStatusTable.ucenikId, ucenikUserId))
  ).map((r) => r.zadacaId);
  // Zadaće preko targetiranja
  const targetZadaceIds = (
    await db
      .select({ zadacaId: zadaceUceniciTable.zadacaId })
      .from(zadaceUceniciTable)
      .where(eq(zadaceUceniciTable.ucenikId, ucenikUserId))
  ).map((r) => r.zadacaId);
  const zadaceIds = [...new Set([...statusZadaceIds, ...targetZadaceIds])];
  if (zadaceIds.length > 0) {
    const zadace = await db
      .select({ grupaId: zadaceTable.grupaId })
      .from(zadaceTable)
      .where(inArray(zadaceTable.id, zadaceIds));
    for (const r of zadace) if (r.grupaId != null) grupaIds.add(r.grupaId);
  }

  const yearToGroupIds = new Map<string, number[]>();
  let tekuca: string | null = null;
  if (grupaIds.size > 0) {
    const grupe = await db
      .select({ id: grupeTable.id, skolskaGodina: grupeTable.skolskaGodina })
      .from(grupeTable)
      .where(inArray(grupeTable.id, [...grupaIds]));
    for (const g of grupe) {
      const god = g.skolskaGodina;
      if (!god) continue;
      const arr = yearToGroupIds.get(god) || [];
      arr.push(g.id);
      yearToGroupIds.set(god, arr);
      if (tekucaGrupaId && g.id === tekucaGrupaId) tekuca = god;
    }
  }

  // Sortiraj godine — najnovija prva (string poređenje radi za "...2025/26").
  const godine = [...yearToGroupIds.keys()].sort((a, b) => b.localeCompare(a));

  return { godine, tekuca, yearToGroupIds, tekucaGrupaId };
}

/**
 * Razrješava odabranu mektebsku godinu na konkretne id-eve grupa za učenika.
 * - Ako godina nije zadana → koristi tekuću (default).
 * - Vraća `null` kada nema filtera (učenik nema grupa / godina nepoznata) —
 *   u tom slučaju pozivatelj NE filtrira (prikazuje sve, bez regresije).
 */
export function razrijesiGodinu(
  info: StudentGodine,
  trazenaGodina?: string | null,
): { godina: string | null; grupaIds: number[] | null; jeTekuca: boolean } {
  const godina = (trazenaGodina && trazenaGodina.trim()) || info.tekuca || null;
  if (!godina) return { godina: null, grupaIds: null, jeTekuca: true };
  const grupaIds = info.yearToGroupIds.get(godina) || [];
  return { godina, grupaIds, jeTekuca: godina === info.tekuca };
}
