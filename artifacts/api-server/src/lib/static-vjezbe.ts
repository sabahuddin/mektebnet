export type StaticVjezbaConfig = {
  key: string;
  naslov: string;
  maxScore: number;
};

// Za novu vježbu dodaje se samo jedan unos ovdje, statički HTML u
// public/vjezbe i iframe sa odgovarajućim data-vjezba-kljuc atributom.
export const STATIC_VJEZBE: Record<string, StaticVjezbaConfig> = {
  "etapa-lekcije-1-10": {
    key: "etapa-lekcije-1-10",
    naslov: "Ponavljanje lekcija 1–10",
    maxScore: 17,
  },
  "etapa-lekcije-11-20": {
    key: "etapa-lekcije-11-20",
    naslov: "Ponavljanje lekcija 11–20",
    maxScore: 24,
  },
  "etapa-lekcije-21-30": {
    key: "etapa-lekcije-21-30",
    naslov: "Ponavljanje lekcija 21–30",
    maxScore: 30,
  },
  "etapa-lekcije-31-40": {
    key: "etapa-lekcije-31-40",
    naslov: "Ponavljanje lekcija 31–40",
    maxScore: 30,
  },
  "etapa-lekcije-41-50": {
    key: "etapa-lekcije-41-50",
    naslov: "Ponavljanje lekcija 41–50",
    maxScore: 30,
  },
  "etapa-lekcije-51-63": {
    key: "etapa-lekcije-51-63",
    naslov: "Ponavljanje lekcija 51–63",
    maxScore: 30,
  },
};

export function getStaticVjezba(key: string): StaticVjezbaConfig | null {
  return STATIC_VJEZBE[key] ?? null;
}