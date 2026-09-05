/**
 * Čiste funkcije za reorganizaciju kvizova Nivoa 1 u etapne kvizove.
 * Odvojeno od `seed-nivo1-etape.ts` da se logika može testirati bez baze.
 */

export const IZVORNI_KVIZOVI_PO_NIVOU: Record<number, string[]> = {
  1: ["1a", "1a-hard", "1b", "1b-hard", "1c", "1c-hard", "1d", "1d-hard", "1e", "1e-hard"],
  2: ["2a", "2a-hard", "2b", "2b-hard", "2c", "2c-hard", "2d", "2d-hard", "2e", "2e-hard", "2f"],
};

/** Zadržano zbog postojećih poziva za Nivo 1. */
export const IZVORNI_KVIZOVI = IZVORNI_KVIZOVI_PO_NIVOU[1]!;

/** Koliko pitanja ide u jedan etapni kviz. */
export const PITANJA_PO_ETAPI = 100;
/** Koliko pitanja ide u jednu varijantu završnog kviza (A/B/C). */
export const PITANJA_PO_KRUNISANJU = 100;
/** Prag prolaza na etapnom kvizu i krunisanju (vidi .agents/memory/kvizovi-po-etapama.md). */
export const PRAG_PROLAZA_PERCENT = 80;

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

function etapa(nivo: number, redni: number, naziv: string, opis: string, zadnjaLekcija?: number): Etapa {
  const od = (redni - 1) * 10;
  const kraj = zadnjaLekcija != null ? zadnjaLekcija - 1 : od + 9;
  return {
    redni,
    od,
    do: kraj,
    medaljonSlug: `nivo${nivo}-etapa-${redni}`,
    naziv,
    opis,
    kvizSlug: `${nivo}-etapa-${redni}`,
    kvizNaslov: `Zlatni medaljon ${redni} — provjera znanja (lekcije ${od + 1}–${kraj + 1})`,
  };
}

export const ETAPE_PO_NIVOU: Record<number, Etapa[]> = {
  1: [
    etapa(1, 1, "Zlatni medaljon 1 — Prvi koraci", "Euzubilla i Bismilla, dove za početak, naša vjera i mekteb."),
    etapa(1, 2, "Zlatni medaljon 2 — Selam i Fatiha", "Selam, Subhaneke, sura El-Fatiha, Allah dž.š., Muhammed a.s. i dinski šarti."),
    etapa(1, 3, "Zlatni medaljon 3 — Imanski šarti i abdest", "Imanski i islamski šarti, sura El-Ihlas, namaski šarti, abdest i sura En-Nas."),
    etapa(1, 4, "Zlatni medaljon 4 — Ezan i namaski ruknovi", "Odijevanje, namasko vrijeme, ezan i ikamet, kibla, nijet i namaski ruknovi."),
    etapa(1, 5, "Zlatni medaljon 5 — Dove u namazu i mubarek-dani", "Gusul i tejemum, sura El-Felek, Et-Tehijjatu, salavati, dove i Ramazanski bajram."),
    etapa(1, 6, "Zlatni medaljon 6 — Bajrami i dnevni namazi", "Kurban-bajram, hidžretska godina, Mevlud, sabah i akšam, sura El-Leheb i Ajetul-Kursija."),
    etapa(1, 7, "Zlatni medaljon 7 — Zikr i završetak nivoa", "Zikr poslije namaza, sura En-Nasr, bajramske aktivnosti i briga o zdravlju.", 64),
  ],
  2: [
    etapa(2, 1, "Zlatni medaljon 1 — Imanski šarti", "Adem a.s., šest imanskih šarta, Allahova svojstva i sura El-Kafirun."),
    etapa(2, 2, "Zlatni medaljon 2 — Islamski šarti", "Kelimei-šehadet, namaz i njegovi propisi, džemat, post, zekat i hadž."),
    etapa(2, 3, "Zlatni medaljon 3 — Čistoća i porodica", "Urednost, lična higijena, zdravlje, ishrana, bonton jela i dužnosti prema porodici."),
    etapa(2, 4, "Zlatni medaljon 4 — Podne-namaz i grijesi", "Podne-namaz, tejemum, mesh, sura El-Kevser, vrste grijeha i tevba."),
    etapa(2, 5, "Zlatni medaljon 5 — Lijep ahlak i olakšice u namazu", "Čestitost, iskrenost, skromnost, ikindija i jacija, namaz putnika i bolesnika, Kunut-dova i sura El-Maun."),
    etapa(2, 6, "Zlatni medaljon 6 — Džuma, bajram i društvo", "Radne navike, srednji put, džuma i bajram-namaz, sura El-Kurejš, teravih, istina i ponašanje u društvu."),
    etapa(2, 7, "Zlatni medaljon 7 — Domovina i identitet", "Mubarek-noći, nafila-namazi, bošnjački alimi, Bosna i Hercegovina, bosanski jezik, kultura i Lekad džāekum.", 68),
  ],
};

/** Zadržano zbog postojećih poziva za Nivo 1. */
export const ETAPE: Etapa[] = ETAPE_PO_NIVOU[1]!;

/** Etape zadanog nivoa. */
export function etapeZaNivo(nivo: number): Etapa[] {
  const e = ETAPE_PO_NIVOU[nivo];
  if (!e) throw new Error(`Nema definisanih etapa za nivo ${nivo}`);
  return e;
}

/**
 * Etapa kojoj pripada lekcija sa datim `redoslijed`: 1 = lekcije 1–10,
 * 2 = 11–20, ... 7 = 61 i dalje. Isti raspored koristi i `kvizovi.etapa`.
 */
export function etapaZaRedoslijed(redoslijed: number): number {
  // Uvodne lekcije znaju imati negativan `redoslijed` (npr. -10 za "Uvodna
  // riječ" Nivoa 2) — one pripadaju prvoj etapi.
  return Math.min(Math.max(Math.floor(redoslijed / 10) + 1, 1), 7);
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

/**
 * Ugrađeni kviz lekcije (`ilmihal_lekcije.kviz_pitanja`) dolazi u dva oblika:
 * kao niz `{question, options, answer}` i, kod novijih lekcija, kao JSON string
 * sa `{pitanje, odgovori, tacanOdgovor}`. Ova funkcija oba svodi na
 * `LegacyPitanje`.
 */
export function lekcijskaPitanja(sirovo: unknown): LegacyPitanje[] {
  let vrijednost = sirovo;
  if (typeof vrijednost === "string") {
    try {
      vrijednost = JSON.parse(vrijednost);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(vrijednost)) return [];
  const rezultat: LegacyPitanje[] = [];
  for (const stavka of vrijednost as Record<string, unknown>[]) {
    if (!stavka || typeof stavka !== "object") continue;
    if (typeof stavka["question"] === "string") {
      rezultat.push(stavka as LegacyPitanje);
      continue;
    }
    const tekst = stavka["pitanje"];
    const odgovori = stavka["odgovori"];
    const tacan = Number(stavka["tacanOdgovor"]);
    if (typeof tekst !== "string" || !Array.isArray(odgovori)) continue;
    const opcije = odgovori.map(String);
    if (!Number.isInteger(tacan) || tacan < 0 || tacan >= opcije.length) continue;
    rezultat.push({
      question: tekst,
      options: opcije,
      answer: opcije[tacan]!,
      explanation: typeof stavka["objasnjenje"] === "string" ? stavka["objasnjenje"] : "",
    });
  }
  return rezultat;
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

/** Pitanja koja ispit krunisanja može bodovati (njegov UI nudi samo radio dugmad). */
export function jeBodivo(p: { vrsta: Vrsta }): boolean {
  return p.vrsta === "single" || p.vrsta === "truefalse";
}

/** Najmanji broj pitanja koje svaka lekcija zadržava u kvizu svoje etape. */
export const MIN_PO_LEKCIJI = 2;

/**
 * Bira do `PITANJA_PO_ETAPI` pitanja za jednu etapu.
 *
 * Etapni kviz se učeniku servira kroz redovni kviz, koji podržava svih šest
 * vrsta pitanja, pa se tipovi ne filtriraju. Kandidata je po pravilu više nego
 * mjesta, pa se prvo svakoj lekciji te etape rezerviše `MIN_PO_LEKCIJI` njenih
 * vlastitih pitanja — bez toga bi lekcija s malo pitanja mogla ispasti iz kviza
 * u cijelosti. Preostala mjesta popunjava deterministički nasumičan uzorak,
 * koji zadržava približan omjer vrsta iz bazena.
 */
export function odaberiZaEtapu<T extends ParsedPitanje & { etapa: number; lekcijaSlug?: string | null }>(
  svi: T[],
  redni: number,
  limit = PITANJA_PO_ETAPI,
  minPoLekciji = MIN_PO_LEKCIJI,
): T[] {
  const rand = prng(1000 + redni);
  const kandidati = shuffle(svi.filter((p) => p.etapa === redni), rand);

  const rezervisano: T[] = [];
  const uzeto = new Set<T>();
  const brojPoLekciji = new Map<string, number>();
  for (const p of kandidati) {
    const lekcija = p.lekcijaSlug;
    if (!lekcija) continue;
    const dosad = brojPoLekciji.get(lekcija) ?? 0;
    if (dosad >= minPoLekciji || rezervisano.length >= limit) continue;
    brojPoLekciji.set(lekcija, dosad + 1);
    rezervisano.push(p);
    uzeto.add(p);
  }

  const ostatak = kandidati.filter((p) => !uzeto.has(p));
  return shuffle([...rezervisano, ...ostatak].slice(0, limit), rand);
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
