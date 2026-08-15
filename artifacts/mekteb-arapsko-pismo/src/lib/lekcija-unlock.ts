// Dijeljena logika otključavanja lekcija.
//
// Nova logika (prerequisiti): svaka lekcija ima listu uvjetiIds — lekcija je
// otključana tek kad student završi sve navedene preduvjete. Lekcije bez
// uvjeta (uvjetiIds=[]) su uvijek otključane (nema sekvencijalnog blokera).
// Gost dobija max 5 lekcija; privilegovani (admin/muallim) sve.
//
// Stara logika (computeUnlockedCellCount) ostaje za kompatibilnost s
// provjerama vrata i etapa, ali NE koristi se za per-lekcija lock.
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
//   - privilegovan (admin/muallim): sve,
//   - gost: prvih 5,
//   - učenik: prvih 10 + 10 po svakoj uzastopno položenoj etapi.
// NAPOMENA (Task #133): roditelj NIJE privilegovan — pozivaoci ga šalju kao
// `isGuest: true` (gost), pa dobija prvih 5. Ne vraćaj ga u privilegovane.
// Per-lekcija provjera otključanosti na osnovu prerequisita (uvjetiIds).
// Identična logika mora biti i na backend-u (content.ts gate).
// Vidi .agents/memory/lekcije-dvije-brave.md.
export function isLekcijaUnlocked(opts: {
  uvjetiIds: number[];
  completedIds: Set<number>;
  isPrivileged: boolean;
  isGuest: boolean;
  index: number; // 0-based pozicija u sortiranoj listi
}): boolean {
  const { uvjetiIds, completedIds, isPrivileged, isGuest, index } = opts;
  if (isPrivileged) return true;
  if (isGuest) return index < 5;
  // Učenik: otključano ako nema uvjeta ILI su svi uvjeti ispunjeni.
  if (uvjetiIds.length === 0) return true;
  return uvjetiIds.every((id) => completedIds.has(id));
}

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
