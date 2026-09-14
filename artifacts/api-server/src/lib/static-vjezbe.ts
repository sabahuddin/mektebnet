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
};

export function getStaticVjezba(key: string): StaticVjezbaConfig | null {
  return STATIC_VJEZBE[key] ?? null;
}