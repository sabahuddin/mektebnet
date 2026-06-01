import { db } from "@workspace/db";
import { grupaRasporedTable, ucenikProfiliTable } from "@workspace/db/schema";
import { eq, and, asc } from "drizzle-orm";

// === PER-GRUPA RASPORED LEKCIJA ============================================
// Muallim može složiti vlastiti redoslijed lekcija za svoju grupu. Ako grupa
// NEMA raspored za nivo → koristi se globalni `ilmihal_lekcije.redoslijed`
// (default, nula promjena za postojeće grupe). Ako ima → lekcije se preslažu
// na KONTIGUIRANE efektivne pozicije 1..N po `pozicija`. Lekcije koje muallim
// nije rasporedio idu na kraj po globalnom redoslijedu.
//
// Medaljoni ostaju checkpointi na svojim ordinalnim pozicijama
// (`posAfterRedoslijed` = "nakon X-te lekcije u redoslijedu"), pa pošto su
// efektivne pozicije kontiguirane 1..N, gating ostaje koherentan bez obzira
// na razmak medaljona.

// Vrati grupaId za studenta (ili null ako student nema grupu / nije ucenik).
export async function getGrupaIdForStudent(userId: number): Promise<number | null> {
  const [profil] = await db
    .select({ grupaId: ucenikProfiliTable.grupaId })
    .from(ucenikProfiliTable)
    .where(eq(ucenikProfiliTable.userId, userId))
    .limit(1);
  return profil?.grupaId ?? null;
}

// Vrati mapu lekcijaId → pozicija za raspored grupe na nivou.
// null ako grupa nema raspored za taj nivo (caller koristi default redoslijed).
export async function getRasporedPositions(
  grupaId: number,
  nivo: number,
): Promise<Map<number, number> | null> {
  const redovi = await db
    .select({
      lekcijaId: grupaRasporedTable.lekcijaId,
      pozicija: grupaRasporedTable.pozicija,
    })
    .from(grupaRasporedTable)
    .where(and(eq(grupaRasporedTable.grupaId, grupaId), eq(grupaRasporedTable.nivo, nivo)))
    .orderBy(asc(grupaRasporedTable.pozicija));
  if (redovi.length === 0) return null;
  const map = new Map<number, number>();
  for (const r of redovi) map.set(r.lekcijaId, r.pozicija);
  return map;
}

// Pomoćni: vrati raspored mapu za studenta na nivou (resolveuje grupu).
// null ako student nema grupu ili grupa nema raspored.
export async function getRasporedPositionsForStudent(
  userId: number,
  nivo: number,
): Promise<Map<number, number> | null> {
  const grupaId = await getGrupaIdForStudent(userId);
  if (grupaId == null) return null;
  return getRasporedPositions(grupaId, nivo);
}

type MinimalLekcija = { id: number; redoslijed: number };

// Iz liste lekcija nivoa + (opcione) raspored mape, izračunaj efektivni
// redoslijed po lekciji: KONTIGUIRANE pozicije 1..N.
//   - Lekcije u rasporedu: poredane po `pozicija`.
//   - Lekcije van rasporeda (npr. nove dodate kasnije): nakon njih, po
//     globalnom `redoslijed`.
// Ako je posMap null → vrati globalni redoslijed bez izmjena (default).
export function resolveEffectiveRedoslijed<T extends MinimalLekcija>(
  nivoLekcije: T[],
  posMap: Map<number, number> | null,
): Map<number, number> {
  const eff = new Map<number, number>();
  if (!posMap) {
    for (const l of nivoLekcije) eff.set(l.id, l.redoslijed);
    return eff;
  }
  const uRasporedu = nivoLekcije
    .filter((l) => posMap.has(l.id))
    .sort((a, b) => posMap.get(a.id)! - posMap.get(b.id)!);
  const vanRasporeda = nivoLekcije
    .filter((l) => !posMap.has(l.id))
    .sort((a, b) => a.redoslijed - b.redoslijed);
  let pos = 1;
  for (const l of uRasporedu) eff.set(l.id, pos++);
  for (const l of vanRasporeda) eff.set(l.id, pos++);
  return eff;
}

// Convenience: vrati NOVU listu lekcija s prepisanim `redoslijed` poljem
// (efektivni), sortiranu po efektivnom redoslijedu. Sigurno za default
// (posMap=null) — vraća kopiju sortiranu po globalnom redoslijedu.
export function applyEffectiveOrder<T extends MinimalLekcija>(
  nivoLekcije: T[],
  posMap: Map<number, number> | null,
): T[] {
  const eff = resolveEffectiveRedoslijed(nivoLekcije, posMap);
  return nivoLekcije
    .map((l) => ({ ...l, redoslijed: eff.get(l.id) ?? l.redoslijed }))
    .sort((a, b) => a.redoslijed - b.redoslijed);
}
