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
    maxScore: 23,
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
  "etapa-nivo2-lekcije-1-10": {
    key: "etapa-nivo2-lekcije-1-10",
    naslov: "Ponavljanje lekcija 1–10 (nivo 2)",
    maxScore: 28,
  },
  "etapa-nivo2-lekcije-11-20": {
    key: "etapa-nivo2-lekcije-11-20",
    naslov: "Ponavljanje lekcija 11–20 (nivo 2)",
    maxScore: 28,
  },
  "etapa-nivo2-lekcije-21-30": {
    key: "etapa-nivo2-lekcije-21-30",
    naslov: "Ponavljanje lekcija 21–30 (nivo 2)",
    maxScore: 28,
  },
  "etapa-nivo2-lekcije-31-40": {
    key: "etapa-nivo2-lekcije-31-40",
    naslov: "Ponavljanje lekcija 31–40 (nivo 2)",
    maxScore: 28,
  },
  "etapa-nivo2-lekcije-41-50": {
    key: "etapa-nivo2-lekcije-41-50",
    naslov: "Ponavljanje lekcija 41–50 (nivo 2)",
    maxScore: 28,
  },
  "etapa-nivo2-lekcije-51-60": {
    key: "etapa-nivo2-lekcije-51-60",
    naslov: "Ponavljanje lekcija 51–60 (nivo 2)",
    maxScore: 28,
  },
  "etapa-nivo2-lekcije-61-68": {
    key: "etapa-nivo2-lekcije-61-68",
    naslov: "Ponavljanje lekcija 61–68 (nivo 2)",
    maxScore: 28,
  },
  "etapa-nivo3-lekcije-1-10": {
    key: "etapa-nivo3-lekcije-1-10",
    naslov: "Ponavljanje lekcija 1–10 (nivo 3)",
    maxScore: 28,
  },
  "etapa-nivo3-lekcije-11-20": {
    key: "etapa-nivo3-lekcije-11-20",
    naslov: "Ponavljanje lekcija 11–20 (nivo 3)",
    maxScore: 28,
  },
  "etapa-nivo3-lekcije-21-30": {
    key: "etapa-nivo3-lekcije-21-30",
    naslov: "Ponavljanje lekcija 21–30 (nivo 3)",
    maxScore: 28,
  },
  "etapa-nivo3-lekcije-31-40": {
    key: "etapa-nivo3-lekcije-31-40",
    naslov: "Ponavljanje lekcija 31–40 (nivo 3)",
    maxScore: 28,
  },
  "etapa-nivo3-lekcije-41-50": {
    key: "etapa-nivo3-lekcije-41-50",
    naslov: "Ponavljanje lekcija 41–50 (nivo 3)",
    maxScore: 28,
  },
  "etapa-nivo3-lekcije-51-60": {
    key: "etapa-nivo3-lekcije-51-60",
    naslov: "Ponavljanje lekcija 51–60 (nivo 3)",
    maxScore: 28,
  },
  "etapa-nivo3-lekcije-61-70": {
    key: "etapa-nivo3-lekcije-61-70",
    naslov: "Ponavljanje lekcija 61–70 (nivo 3)",
    maxScore: 28,
  },
  "etapa-nivo3-lekcije-71-80": {
    key: "etapa-nivo3-lekcije-71-80",
    naslov: "Ponavljanje lekcija 71–80 (nivo 3)",
    maxScore: 28,
  },
  "etapa-nivo3-lekcije-81-90": {
    key: "etapa-nivo3-lekcije-81-90",
    naslov: "Ponavljanje lekcija 81–90 (nivo 3)",
    maxScore: 28,
  },
  "etapa-nivo3-lekcije-91-100": {
    key: "etapa-nivo3-lekcije-91-100",
    naslov: "Ponavljanje lekcija 91–100 (nivo 3)",
    maxScore: 28,
  },
};

export function getStaticVjezba(key: string): StaticVjezbaConfig | null {
  return STATIC_VJEZBE[key] ?? null;
}

export function staticVjezbaRewardForAttempt(attemptNo: number): number {
  if (attemptNo <= 1) return 50;
  if (attemptNo === 2) return 20;
  return 0;
}

export function staticVjezbaMultiplierForAttempt(attemptNo: number): number {
  return staticVjezbaRewardForAttempt(attemptNo) / staticVjezbaRewardForAttempt(1);
}