/**
 * Čiste funkcije za reorganizaciju kvizova Nivoa 1 u etapne kvizove.
 * Odvojeno od `seed-nivo1-etape.ts` da se logika može testirati bez baze.
 */

export const IZVORNI_KVIZOVI = [
  "1a", "1a-hard", "1b", "1b-hard", "1c", "1c-hard", "1d", "1d-hard", "1e", "1e-hard",
] as const;

/** Koliko pitanja ide u jedan etapni kviz. */
export const PITANJA_PO_ETAPI = 100;
/** Koliko pitanja ide u jednu varijantu završnog kviza (A/B/C). */
export const PITANJA_PO_KRUNISANJU = 100;

export type Etapa = {
  redni: number;
  /** `redoslijed` prve lekcije etape (0-baziran, kao u bazi). */
  od: number;
  /** `redoslijed` posljednje lekcije etape — ujedno `posAfterRedoslijed` medaljona. */
  do: number;
  medaljonSlug: string;
  naziv: string;
  opis: string;
  kvizSlug: string;
  kvizNaslov: string;
};

function etapa(redni: number, naziv: string, opis: string): Etapa {
  const od = (redni - 1) * 10;
  const kraj = od + 9;
  return {
    redni,
    od,
    do: kraj,
    medaljonSlug: `nivo1-etapa-${redni}`,
    naziv,
    opis,
    kvizSlug: `1-etapa-${redni}`,
    kvizNaslov: `Zlatni medaljon ${redni} — provjera znanja (lekcije ${od + 1}–${kraj + 1})`,
  };
}

export const ETAPE: Etapa[] = [
  etapa(1, "Zlatni medaljon 1 — Prvi koraci", "Provjera znanja nakon prvih 10 lekcija: Euzubilla i Bismilla, dove za početak, naša vjera i mekteb."),
  etapa(2, "Zlatni medaljon 2 — Selam i Fatiha", "Provjera znanja nakon 20 lekcija: selam, Subhaneke, sura El-Fatiha, Allah dž.š., Muhammed a.s. i dinski šarti."),
  etapa(3, "Zlatni medaljon 3 — Imanski šarti i abdest", "Provjera znanja nakon 30 lekcija: imanski i islamski šarti, sura El-Ihlas, namaski šarti, abdest i sura En-Nas."),
  etapa(4, "Zlatni medaljon 4 — Ezan i namaski ruknovi", "Provjera znanja nakon 40 lekcija: odijevanje, namasko vrijeme, ezan i ikamet, kibla, nijet i namaski ruknovi."),
  etapa(5, "Zlatni medaljon 5 — Dove u namazu i mubarek-dani", "Provjera znanja nakon 50 lekcija: gusul i tejemum, sura El-Felek, Et-Tehijjatu, salavati, dove i Ramazanski bajram."),
  etapa(6, "Zlatni medaljon 6 — Bajrami i dnevni namazi", "Provjera znanja nakon 60 lekcija: Kurban-bajram, hidžretska godina, Mevlud, sabah i akšam, sura El-Leheb i Ajetul-Kursija."),
];

/**
 * Etapa kojoj pripada lekcija sa datim `redoslijed`. Lekcije 61-64
 * (`redoslijed` 60-63) nemaju svoj medaljon — vraća se 7 i te lekcije ulaze
 * samo u završni ispit nivoa.
 */
export function etapaZaRedoslijed(redoslijed: number): number {
  return Math.min(Math.floor(redoslijed / 10) + 1, 7);
}

// ── Parsiranje legacy JSONB pitanja ────────────────────────────────────────

export type LegacyPitanje = {
  question: string;
  options?: string[];
  answer?: string;
  explanation?: string;
  image?: string;
  slika?: string;
  type?: string;
  items?: { text: string; order: number }[];
  template?: string[];
  words?: string[];
  correct?: string[];
  text?: string;
  /** U seed JSONB-u su ovo indeksi u `words`; banka i frontend očekuju riječi. */
  incorrect?: (string | number)[];
  tezina?: number;
};

export type Vrsta = "single" | "multiple" | "truefalse" | "reorder" | "dragDrop" | "markWords";

export type Meta = {
  template?: string[];
  words?: string[];
  correct?: string[];
  text?: string;
  incorrect?: string[];
} | null;

/**
 * Oblik pitanja u `kvizovi.pitanja`. `question`/`options`/`answer` su obavezni
 * jer ih traži `QuizQuestion` tip iz sheme; interaktivni tipovi ih popunjavaju
 * izvedenim vrijednostima, a kviz UI za njih koristi `items`/`template`/`words`.
 */
export type LegacyJsonb = {
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
  image?: string;
  type?: string;
  items?: { text: string; order: number }[];
  template?: string[];
  words?: string[];
  correct?: string[];
  text?: string;
  incorrect?: string[];
};

export interface ParsedPitanje {
  pitanje: string;
  vrsta: Vrsta;
  opcije: string[];
  correctIndex: number;
  correctIndexes: number[] | null;
  correctOrder: number[] | null;
  meta: Meta;
  objasnjenje: string;
  slika: string | null;
  tezina: number;
  /** Oblik koji ide u `kvizovi.pitanja` JSONB (legacy read path + kviz UI). */
  legacy: LegacyJsonb;
}

export function normalize(s: string): string {
  return String(s ?? "").trim().replace(/\s+/g, " ");
}

function kljucTekst(s: string): string {
  return normalize(s).toLowerCase().replace(/[‘’'"`´]/g, "'");
}

/**
 * Ključ po kojem se pitanje smatra duplikatom. Prati UNIQUE indekse u
 * `pitanja_banka`: standardni tipovi po tekstu, dragDrop/markWords po
 * tekstu + meta (jer dijele generički tekst tipa "Pronađi greške:").
 */
export function bankaKljuc(p: { pitanje: string; vrsta: Vrsta | string; meta?: Meta }): string {
  const t = kljucTekst(p.pitanje);
  if (p.vrsta === "markWords") return `mw::${t}::${kljucTekst(p.meta?.text ?? "")}`;
  if (p.vrsta === "dragDrop") {
    return `dd::${t}::${kljucTekst((p.meta?.template ?? []).join("|"))}::${kljucTekst((p.meta?.correct ?? []).join("|"))}`;
  }
  return t;
}

const DA_NE = new Set(["da", "ne"]);

export function parseLegacy(p: LegacyPitanje, ctx: string): ParsedPitanje | null {
  if (!p?.question) return null;
  const pitanje = normalize(p.question);
  const tip = (p.type ?? "").toLowerCase();
  const slika = (p.slika ?? p.image ?? null) || null;
  const objasnjenje = normalize(p.explanation ?? "");
  const tezina = Number(p.tezina) > 0 ? Number(p.tezina) : 1;
  const baza = { pitanje, objasnjenje, slika, tezina };

  if (tip === "reorder") {
    const items = (p.items ?? []).filter((it) => normalize(it?.text ?? ""));
    if (items.length < 2) return null;
    const opcije = items.map((it) => normalize(it.text));
    const correctOrder = items.map((it) => Number(it.order) || 0);
    if (correctOrder.some((o) => o <= 0)) return null;
    return {
      ...baza,
      vrsta: "reorder",
      opcije,
      correctIndex: 0,
      correctIndexes: null,
      correctOrder,
      meta: null,
      legacy: {
        type: "reorder",
        question: pitanje,
        explanation: objasnjenje,
        options: opcije,
        answer: [...items].sort((x, y) => Number(x.order) - Number(y.order)).map((it) => normalize(it.text)).join("|||"),
        items: items.map((it) => ({ text: normalize(it.text), order: Number(it.order) })),
      },
    };
  }

  if (tip === "dragdrop") {
    const template = (p.template ?? []).map(String);
    const words = (p.words ?? []).map(String);
    const correct = (p.correct ?? []).map(String);
    const dropova = template.filter((t) => t === "DROP").length;
    if (dropova === 0 || words.length === 0 || correct.length !== dropova) return null;
    const meta = { template, words, correct };
    return {
      ...baza,
      vrsta: "dragDrop",
      opcije: [],
      correctIndex: 0,
      correctIndexes: null,
      correctOrder: null,
      meta,
      legacy: { type: "dragDrop", question: pitanje, explanation: objasnjenje, options: words, answer: correct.join("|||"), ...meta },
    };
  }

  if (tip === "markwords") {
    const words = (p.words ?? []).map(String);
    // Seed čuva indekse; banka i frontend očekuju same riječi.
    const incorrect = (p.incorrect ?? [])
      .map((w) => (typeof w === "number" ? words[w] : String(w)))
      .filter((w): w is string => typeof w === "string" && w.length > 0);
    if (words.length === 0 || incorrect.length === 0) return null;
    const meta = { text: normalize(p.text ?? ""), words, incorrect };
    return {
      ...baza,
      vrsta: "markWords",
      opcije: [],
      correctIndex: 0,
      correctIndexes: null,
      correctOrder: null,
      meta,
      legacy: { type: "markWords", question: pitanje, explanation: objasnjenje, options: words, answer: incorrect.join("|||"), ...meta },
    };
  }

  const opcijeRaw = (p.options ?? []).map(normalize).filter(Boolean);
  if (opcijeRaw.length === 0) return null;

  const odgovori = (p.answer ?? "").includes("|||")
    ? p.answer!.split("|||").map(normalize).filter(Boolean)
    : [normalize(p.answer ?? "")];
  const idxs: number[] = [];
  for (const dio of odgovori) {
    const trazeno = dio.toLowerCase();
    let i = opcijeRaw.findIndex((o) => o.toLowerCase() === trazeno);
    if (i < 0) {
      // U par pitanja iz seeda odgovor ima višak riječi u odnosu na opciju
      // (npr. odgovor "124.000 ukupno" prema opciji "124.000"). Prihvatamo
      // prefiksno poklapanje samo ako je jednoznačno.
      const kandidati = opcijeRaw
        .map((o, j) => ({ o: o.toLowerCase(), j }))
        .filter(({ o }) => o.length > 0 && (trazeno.startsWith(o) || o.startsWith(trazeno)));
      if (kandidati.length === 1) i = kandidati[0]!.j;
    }
    if (i >= 0 && !idxs.includes(i)) idxs.push(i);
  }
  if (idxs.length === 0) {
    console.warn(`  [${ctx}] odgovor "${p.answer}" nije među opcijama — preskačem`);
    return null;
  }

  // DA/NE pitanja normalizujemo u `truefalse` sa fiksnim opcijama Da/Ne.
  const jeDaNe = tip === "truefalse"
    || (opcijeRaw.length === 2 && opcijeRaw.every((o) => DA_NE.has(o.toLowerCase())));
  if (jeDaNe) {
    const tacnoDa = normalize(opcijeRaw[idxs[0]!] ?? "").toLowerCase() === "da";
    return {
      ...baza,
      vrsta: "truefalse",
      opcije: ["Da", "Ne"],
      correctIndex: tacnoDa ? 0 : 1,
      correctIndexes: null,
      correctOrder: null,
      meta: null,
      legacy: { type: "truefalse", question: pitanje, explanation: objasnjenje, options: ["Da", "Ne"], answer: tacnoDa ? "Da" : "Ne" },
    };
  }

  const viseTacnih = idxs.length > 1 || tip === "checkbox" || tip === "multiple";
  return {
    ...baza,
    vrsta: viseTacnih ? "multiple" : "single",
    opcije: opcijeRaw,
    correctIndex: idxs[0]!,
    correctIndexes: viseTacnih ? idxs : null,
    correctOrder: null,
    meta: null,
    legacy: {
      type: viseTacnih ? "checkbox" : "radio",
      question: pitanje,
      explanation: objasnjenje,
      options: opcijeRaw,
      answer: idxs.map((i) => opcijeRaw[i]).join("|||"),
      ...(viseTacnih ? { correct: idxs.map((i) => opcijeRaw[i]) } : {}),
      ...(slika ? { image: slika } : {}),
    },
  };
}

// ── Izbor pitanja ──────────────────────────────────────────────────────────

/** Deterministički PRNG (mulberry32) — isti izbor pri svakom pokretanju. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Pitanja koja ispit etape/krunisanja može bodovati (UI nudi samo radio dugmad). */
export function jeBodivo(p: { vrsta: Vrsta }): boolean {
  return p.vrsta === "single" || p.vrsta === "truefalse";
}

/**
 * Bira do `PITANJA_PO_ETAPI` pitanja za jednu etapu. Prednost imaju bodiva
 * pitanja (single/truefalse) da ispit etape bude što potpuniji, a preostala
 * mjesta popunjavaju interaktivni tipovi koji rade u redovnom kvizu.
 */
export function odaberiZaEtapu<T extends ParsedPitanje & { etapa: number }>(
  svi: T[],
  redni: number,
  limit = PITANJA_PO_ETAPI,
): T[] {
  const rand = prng(1000 + redni);
  const kandidati = svi.filter((p) => p.etapa === redni);
  const bodiva = shuffle(kandidati.filter(jeBodivo), rand);
  const ostala = shuffle(kandidati.filter((p) => !jeBodivo(p)), rand);
  return shuffle([...bodiva, ...ostala].slice(0, limit), rand);
}

/**
 * Dijeli bodiva pitanja cijelog nivoa (uključujući lekcije 61-64) u tri
 * završna kviza od po `PITANJA_PO_KRUNISANJU` pitanja, bez preklapanja.
 * Bira se naizmjenično po etapama da svaka varijanta pokrije cijeli nivo.
 */
export function podijeliKrunisanje<T extends ParsedPitanje & { etapa: number }>(
  svi: T[],
  poVarijanti = PITANJA_PO_KRUNISANJU,
): { a: T[]; b: T[]; c: T[] } {
  const rand = prng(20250904);
  const grupe = new Map<number, T[]>();
  for (const p of svi.filter(jeBodivo)) {
    if (!grupe.has(p.etapa)) grupe.set(p.etapa, []);
    grupe.get(p.etapa)!.push(p);
  }
  const redovi = [...grupe.keys()].sort((x, y) => x - y).map((k) => shuffle(grupe.get(k)!, rand));
  const redoslijed: T[] = [];
  for (let i = 0; redovi.some((r) => i < r.length); i++) {
    for (const red of redovi) {
      const p = red[i];
      if (p) redoslijed.push(p);
    }
  }
  const uzeto = redoslijed.slice(0, poVarijanti * 3);
  // Raspoređujemo naizmjenično unutar svake etape da sve tri varijante imaju
  // približno isti broj pitanja iz svakog bloka lekcija.
  const a: T[] = [], b: T[] = [], c: T[] = [];
  const poEtapi = new Map<number, T[]>();
  for (const p of uzeto) {
    if (!poEtapi.has(p.etapa)) poEtapi.set(p.etapa, []);
    poEtapi.get(p.etapa)!.push(p);
  }
  let pomak = 0;
  for (const etapa of [...poEtapi.keys()].sort((x, y) => x - y)) {
    poEtapi.get(etapa)!.forEach((p, i) => [a, b, c][(i + pomak) % 3]!.push(p));
    pomak = (pomak + poEtapi.get(etapa)!.length) % 3;
  }
  return { a, b, c };
}

// ── Bazen pitanja iz postojećih kvizova ────────────────────────────────────

export type PoolStavka = { id: string; izvori: string[]; pitanje: LegacyPitanje };

/**
 * Deduplicira pitanja iz zadanih kvizova po pravilima banke i vraća ih u
 * stabilnom redoslijedu. `id` je `<slug>#<indeks>` prvog pojavljivanja i
 * ujedno ključ u `nivo1-mapa-pitanja.json`.
 */
export function buildPool(kvizovi: { slug: string; pitanja: LegacyPitanje[] }[]): PoolStavka[] {
  const pool: PoolStavka[] = [];
  const vidjeno = new Map<string, PoolStavka>();
  for (const { slug, pitanja } of kvizovi) {
    pitanja.forEach((p, i) => {
      const tip = (p.type ?? "").toLowerCase();
      const kljuc = tip === "markwords"
        ? `mw::${kljucTekst(p.question)}::${kljucTekst(p.text ?? "")}`
        : tip === "dragdrop"
          ? `dd::${kljucTekst(p.question)}::${kljucTekst((p.template ?? []).join("|"))}::${kljucTekst((p.correct ?? []).join("|"))}`
          : kljucTekst(p.question);
      const postoji = vidjeno.get(kljuc);
      if (postoji) {
        postoji.izvori.push(`${slug}#${i}`);
        return;
      }
      const stavka: PoolStavka = { id: `${slug}#${i}`, izvori: [`${slug}#${i}`], pitanje: p };
      vidjeno.set(kljuc, stavka);
      pool.push(stavka);
    });
  }
  return pool;
}
