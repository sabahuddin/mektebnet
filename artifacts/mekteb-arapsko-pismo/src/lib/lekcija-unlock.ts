// Dijeljena logika otključavanja lekcija (medaljon-blokovi).
//
// Koriste je OBA gate-a — mapa (nivo1-mapa.tsx) i stranica lekcije
// (ilmihal-lekcija.tsx) — da bi otključavanje bilo identično. Ako se logika
// razdvoji, mapa može otključati lekciju koju stranica i dalje blokira (i
// obrnuto). Vidi .agents/memory/lekcije-dvije-brave.md.

export interface MedaljonGate {
  id: number;
  posAfterRedoslijed: number;
  imaKviz?: boolean;
  isGating?: boolean;
}

// Etapa (medaljon) je "položena" ako:
//   - nije gating (admin toggle) → ne blokira napredak,
//   - student ju je osvojio (kviz/legacy claim), ili
//   - nema kviz I student je završio dovoljno lekcija (soft napredak).
export function isEtapaPassed(
  m: MedaljonGate,
  completedCount: number,
  osvojeniSet: Set<number>,
): boolean {
  if (m.isGating === false) return true;
  if (osvojeniSet.has(m.id)) return true;
  if (!m.imaKviz && completedCount >= m.posAfterRedoslijed) return true;
  return false;
}

// Broj otključanih ćelija (lekcija) za datog korisnika:
//   - privilegovan (admin/muallim/roditelj): sve,
//   - gost: prvih 5,
//   - učenik: prvih 10 + 10 po svakoj uzastopno položenoj etapi.
export function computeUnlockedCellCount(opts: {
  isPrivileged: boolean;
  isGuest: boolean;
  totalCells: number;
  medaljoni: MedaljonGate[];
  completedCount: number;
  osvojeniSet: Set<number>;
}): number {
  const { isPrivileged, isGuest, totalCells, medaljoni, completedCount, osvojeniSet } = opts;
  if (isPrivileged) return totalCells;
  if (isGuest) return Math.min(totalCells, 5);
  const sorted = [...medaljoni].sort((a, b) => a.posAfterRedoslijed - b.posAfterRedoslijed);
  let unlocked = Math.min(totalCells, 10);
  for (const m of sorted) {
    if (isEtapaPassed(m, completedCount, osvojeniSet)) {
      unlocked = Math.min(totalCells, m.posAfterRedoslijed + 10);
    } else {
      break;
    }
  }
  return unlocked;
}
