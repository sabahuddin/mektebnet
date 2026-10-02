export interface GroupStatisticsDetails {
  id: number;
  lekcije: Array<{ id: number; naslov: string; nivo: number; slug: string }>;
  kvizovi: Array<{ id: number; kvizId: number; naslov: string; nivo: number | null; procenat: number; tacniOdgovori: number; ukupnoPitanja: number; bodovi: number; datum: string | null }>;
  ocjene: Array<{ id: number; datum: string; predmet: string | null; lekcijaNaslov: string | null; ocjena: number | null; ocjenaOpisna: string | null; napomena: string | null }>;
  etape: Array<{ medaljonId: number; naziv: string; nivo: number; redoslijed: number; brojPokusaja: number; polozeno: boolean; najboljiProcenat: number }>;
  medaljoni: Array<{ medaljonId: number; naziv: string; nivo: number; datum: string | null }>;
}

export interface GStudent {
  id: number;
  ime: string;
  prisustvoPct: number | null;
  prisutanCount: number;
  odsutanCount: number;
  zakasnioCount: number;
  opravdanCount: number;
  ukupnoPrisustvo: number;
  prisustvoPoDatumu: Record<string, string>;
  mjesecnoStats: { mjesec: string; prisutan: number; ukupno: number; pct: number | null }[];
  prosjecneOcjene: Record<string, { prosjek: number; broj: number }>;
  ukupnaProsjecna: number | null;
  brojOcjena: number;
  kvizCount: number;
  kvizProsjecniProcenat: number | null;
  ukupnoBodova: number;
}

export interface GStat {
  ucenici: GStudent[];
  ukupnoCasova: number;
  svaDatumi: string[];
  grupaPrisustvoPct: number | null;
  grupaProsjekOcjena: number | null;
  detaljiUcenika?: GroupStatisticsDetails[];
}

export interface GVjezbeStudent {
  id: number;
  naseVjezbe: number;
  h5pVjezbe: number;
  etapneVjezbe: number;
  h5pPokusaji: number;
  h5pProsjek: number | null;
  etapnePokusaji: number;
  etapneProsjek: number | null;
}

export interface GVjezbe {
  ucenici: GVjezbeStudent[];
  ukupno: { naseVjezbe: number; h5pPokusaji: number; h5pProsjek: number | null; etapnePokusaji: number; etapneProsjek: number | null };
}

export interface GInteraktivni {
  ukupnoPokusaja: number;
  prosjekTacnosti: number | null;
  ucenici: Array<{ id: number; displayName?: string; brojPokusaja: number; procenatTacnih: number | null; pomocBroj: number; tacnoNakonPonovnogCitanja: number }>;
  pitanja: Array<{ lekcijaNaslov: string; pitanjeTekst: string; brojPokusaja: number; netacniPokusaji: number; procenatTacnih: number }>;
}
