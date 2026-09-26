// Vježbe se izvode iz programa, ne prepisuju rukom.
//
// Prva verzija ovog dijela imala je šest do deset stavki po vježbi, iako u
// četvrtoj lekciji postoji 729 mogućih dvosloga. Razlika između lekcije i
// obrasca s uzorkom jeste upravo u tome: lekcija mora imati dovoljno građe
// da se na njoj radi pola sata, a toliko se građe ne prepisuje rukom.
//
// Ovdje se rukom piše samo priča. Sve ostalo — oblici slova, slogovi,
// spajanja, redovi za tečnost — izvodi se iz onoga što je dijete do te
// lekcije naučilo, pa je po sebi nemoguće da vježba prehitava program.
//
// IZBOR JE ODREĐEN, NE SLUČAJAN. Kad bi se građa miješala slučajno, svaka bi
// izgradnja dala drugu lekciju: imena snimaka bi se mijenjala, testovi bi
// padali nasumično, a dijete bi pri svakom otvaranju dobilo drugu vježbu.
// Zato miješanje ide iz broja lekcije.
import { PROGRAM_CITANJA, znanjeDoLekcije, type Znak } from "./citanje-program";
import { SLOGOVI_CITANJA } from "./citanje-slogovi";
import { RIJECI_CITANJA } from "./citanje-rijeci";
import { obliciHarfa, type Polozaj } from "./citanje-oblici";
import { ASOCIJACIJE, porodicaHarfa } from "./citanje-asocijacije";

const FETHA = "َ", KESRA = "ِ", DAMMA = "ُ";
const HAREKA: Record<string, Znak> = { [FETHA]: "fetha", [KESRA]: "kesra", [DAMMA]: "damma" };

/**
 * Spojevi koje muallim ne želi pred djetetom. Prazno dok se ne ukaže
 * potreba — spajanje daje i besmislene slogove, što je i svrha, ali može
 * slučajno dati i riječ koja ne priliči.
 */
const IZUZETI = new Set<string>([]);

/** Miješanje određeno sjemenom, da svaka izgradnja da istu lekciju. */
function promijesaj<T>(niz: T[], sjeme: number): T[] {
  const izl = [...niz];
  let s = sjeme * 9301 + 49297;
  for (let i = izl.length - 1; i > 0; i -= 1) {
    s = (s * 9301 + 49297) % 233280;
    const j = s % (i + 1);
    [izl[i], izl[j]] = [izl[j], izl[i]];
  }
  return izl;
}

export type VrstaVjezbe =
  | "glas"           // novi glas sam, sa svakim naučenim harekom
  | "oblici"         // isto slovo na početku, u sredini i na kraju
  | "pisi"           // po zraku, po pijesku, u plastelinu
  | "pronadi-harf"   // naći novo slovo među drugima
  | "slusaj-klikni"  // čuje slog, klikne ga
  | "kratko-dugo"    // isti harf kratko pa dugo
  | "voz-slogova"    // spajanje dijelova u cjelinu
  | "citaj-rijeci"   // čita riječi
  | "brzina";        // redovi za tečnost

export interface StavkaVjezbe {
  zapis: string;
  /** Dijelovi od kojih se zapis sastavlja — za voz slogova. */
  dijelovi?: string[];
  /** Kraći parnjak — za kratko-dugo. */
  parnjak?: string;
  /** Oblik slova — za vježbu oblika. */
  polozaj?: Polozaj;
  /** Šta se traži među ponuđenima — za lov na slova. */
  trazeno?: string;
  /** Ponuđeni odgovori. */
  izbor?: string[];
  /** Samo slovo, bez hareka — za pisanje i za sliku. */
  harf?: string;
  /** Na šta slovo liči. */
  slika?: string;
  /** Kojim redom ruka vuče. */
  potez?: string;
  /** Već naučena slova istog kostura, za uporedbu. */
  rodbina?: string[];
}

export interface VjezbaCitanja {
  vrsta: VrstaVjezbe;
  naslov: string;
  /** Uputa muallimu. Dijete je ne čita; muallim je izgovara. */
  uputa: string;
  stavke: StavkaVjezbe[];
  /** Redovi za tečnost — svaki se čita u jednom dahu. */
  redovi?: string[][];
  sekundi?: number;
  /** Traži li vježba snimke da bi imala smisla. */
  trebaZvuk?: boolean;
}

/** Slogovi koje dijete zna, po lekciji. */
const slogoviDo = (lekcija: number) => SLOGOVI_CITANJA.filter((s) => s.lekcija <= lekcija);
const rijeciDo = (lekcija: number) => RIJECI_CITANJA.filter((r) => r.lekcija <= lekcija);

/** Svi slogovi koje program dopušta, i oni koji nisu popisani rukom. */
function sviSlogovi(lekcija: number): string[] {
  const { harfovi, znakovi } = znanjeDoLekcije(lekcija);
  const hareke = [FETHA, KESRA, DAMMA].filter((h) => znakovi.has(HAREKA[h]));
  const izl: string[] = [];
  for (const h of harfovi) {
    // Elif i hemze na liniji ne nose harek kao obični suglasnik.
    if (h === "ا" || h === "ء") continue;
    for (const k of hareke) izl.push(h + k);
  }
  return izl;
}

/**
 * Spojevi dva sloga — jezgro slogovnog čitanja.
 *
 * U spoj ulaze i dugi slogovi, ne samo kratki. To nije samo radi obima: smjena
 * kratkog i dugog unutar riječi jeste ono što dijete zapravo mora savladati, a
 * na samim kratkim slogovima se ne pokaže.
 */
function dvoslozi(lekcija: number, koliko: number): { spoj: string; a: string; b: string }[] {
  const s = [...sviSlogovi(lekcija), ...slogoviDo(lekcija).filter((x) => x.dug).map((x) => x.zapis)];
  const parovi: { spoj: string; a: string; b: string }[] = [];
  for (const a of s) for (const b of s) {
    const spoj = a + b;
    if (!IZUZETI.has(spoj)) parovi.push({ spoj, a, b });
  }
  return promijesaj(parovi, lekcija).slice(0, koliko);
}

/** Sve vježbe jedne lekcije, izvedene iz programa. */
export function vjezbeZaLekciju(lekcija: number): VjezbaCitanja[] {
  const program = PROGRAM_CITANJA.find((p) => p.broj === lekcija);
  if (!program) return [];
  const { znakovi } = znanjeDoLekcije(lekcija);
  const hareke = [FETHA, KESRA, DAMMA].filter((h) => znakovi.has(HAREKA[h]));
  const novi = program.harfovi.filter((h) => h !== "ا" && h !== "ء");
  const stari = slogoviDo(lekcija - 1);
  const vjezbe: VjezbaCitanja[] = [];

  // ── Novi glas, sam ─────────────────────────────────────────────────────
  const noviSlogovi = novi.flatMap((h) => hareke.map((k) => h + k));
  if (noviSlogovi.length) {
    vjezbe.push({
      vrsta: "glas", naslov: "Novi glas", trebaZvuk: true,
      uputa: "Muallim izgovara, dijete ponavlja uz pokret. Ponoviti svaki glas tri puta prije prelaska na sljedeći.",
      stavke: noviSlogovi.map((z) => ({ zapis: z })),
    });
  }

  // ── Oblici slova ───────────────────────────────────────────────────────
  const oblici = program.harfovi.flatMap((h) => obliciHarfa(h).map((o) => ({ zapis: o.prikaz, polozaj: o.polozaj })));
  if (oblici.length) {
    vjezbe.push({
      vrsta: "oblici", naslov: "Isto slovo, više mjesta",
      uputa: "Pokazati da je to jedno te isto slovo. Dijete prstom prati oblik po zraku prije nego pređe na sljedeći.",
      stavke: oblici,
    });
  }

  // ── Pisanje ────────────────────────────────────────────────────────────
  //
  // Ruka pamti ono što oko zaboravi. Dijete najprije vuče slovo prstom po
  // zraku, pa po pijesku ili grubom papiru, pa ga izvalja iz plastelina. Tek
  // kad je oblik prošao kroz ruku, prelazi se na prepoznavanje.
  const naucena = znanjeDoLekcije(lekcija - 1).harfovi;
  const zaPisanje = program.harfovi
    .filter((h) => ASOCIJACIJE[h])
    .map((h) => ({
      zapis: h, harf: h,
      slika: ASOCIJACIJE[h].slika,
      potez: ASOCIJACIJE[h].potez,
      rodbina: porodicaHarfa(h, naucena),
    }));
  if (zaPisanje.length) {
    vjezbe.push({
      vrsta: "pisi", naslov: "Napravi slovo",
      uputa: "Najprije prstom po zraku, pa po pijesku ili grubom papiru, pa iz plastelina. Dok ruka vuče, usta izgovaraju glas.",
      stavke: zaPisanje,
    });
  }

  // ── Lov na slova ───────────────────────────────────────────────────────
  const sviHarfovi = [...znanjeDoLekcije(lekcija).harfovi].filter((h) => h !== "ء");
  if (novi.length && sviHarfovi.length >= 3) {
    const lov = promijesaj(novi.flatMap((h) => obliciHarfa(h).map((o) => ({ harf: h, prikaz: o.prikaz }))), lekcija)
      .slice(0, 10)
      .map(({ harf, prikaz }) => {
        const ometaci = promijesaj(sviHarfovi.filter((d) => d !== harf), lekcija + harf.charCodeAt(0)).slice(0, 3);
        return { zapis: prikaz, trazeno: harf, izbor: promijesaj([prikaz, ...ometaci], harf.charCodeAt(0)) };
      });
    vjezbe.push({
      vrsta: "pronadi-harf", naslov: "Lov na slovo",
      uputa: "Muallim kazuje koji se glas traži. Dijete pokazuje prstom, ne izgovara dok ne pokaže.",
      stavke: lov,
    });
  }

  // ── Slušanje ───────────────────────────────────────────────────────────
  const zaSlusanje = promijesaj([...noviSlogovi, ...stari.filter((s) => !s.dug).map((s) => s.zapis)], lekcija).slice(0, 12);
  if (zaSlusanje.length >= 2) {
    vjezbe.push({
      vrsta: "slusaj-klikni", naslov: "Šta si čuo", trebaZvuk: true,
      uputa: "Pritisnuti zvučnik, pa pokazati prstom šta se čulo. Ne kazivati unaprijed.",
      stavke: zaSlusanje.map((z) => ({ zapis: z })),
    });
  }

  // ── Kratko i dugo ──────────────────────────────────────────────────────
  const dugi = slogoviDo(lekcija).filter((s) => s.dug);
  if (dugi.length) {
    vjezbe.push({
      vrsta: "kratko-dugo", naslov: "Kratko i dugo", trebaZvuk: true,
      uputa: "Uz kratko pljesnuti jednom, uz dugo raširiti ruke i držati ih dok traje glas.",
      stavke: dugi.map((d) => {
        const kratak = slogoviDo(lekcija).find((s) => !s.dug && s.harf === d.harf && s.zapis[1] === d.zapis[1]);
        return { zapis: d.zapis, parnjak: kratak?.zapis };
      }).filter((s) => s.parnjak),
    });
  }

  // ── Spajanje ───────────────────────────────────────────────────────────
  const spojevi = dvoslozi(lekcija, 16);
  if (spojevi.length) {
    vjezbe.push({
      vrsta: "voz-slogova", naslov: "Voz slogova",
      uputa: "Pročitati vagon po vagon, pa sve zajedno u jednom dahu. Ne zastajkivati u sredini.",
      stavke: spojevi.map(({ spoj, a, b }) => ({ zapis: spoj, dijelovi: [a, b] })),
    });
  }

  // ── Riječi ─────────────────────────────────────────────────────────────
  const rijeci = rijeciDo(lekcija);
  if (rijeci.length) {
    const nove = rijeci.filter((r) => r.lekcija === lekcija);
    const ranije = rijeci.filter((r) => r.lekcija < lekcija);
    vjezbe.push({
      vrsta: "citaj-rijeci", naslov: "Riječi", trebaZvuk: true,
      uputa: "Dijete čita samo. Zvučnik se pritiska tek poslije, radi provjere. Ranije riječi se ponavljaju.",
      stavke: [...nove, ...promijesaj(ranije, lekcija).slice(0, 10)].map((r) => ({ zapis: r.zapis })),
    });
  }

  // ── Tečnost ────────────────────────────────────────────────────────────
  const fond = [...sviSlogovi(lekcija), ...dugi.map((d) => d.zapis), ...rijeci.map((r) => r.zapis)];
  const redovi: string[][] = [];
  for (let i = 0; i < 3; i += 1) {
    redovi.push(promijesaj(fond, lekcija * 10 + i).slice(0, 10));
  }
  vjezbe.push({
    vrsta: "brzina", naslov: "Koliko stigneš", sekundi: 20 + lekcija * 2,
    uputa: "Pročitati red bez greške dok traje vrijeme. Tačnost je ispred brzine — greška vraća na početak reda.",
    stavke: [], redovi,
  });

  // Redoslijed je pedagoški, ne redoslijed pisanja: dijete najprije vidi
  // slovo, pa ga prepoznaje među drugima, pa ga čuje, i tek onda čita.
  const RED: VrstaVjezbe[] = [
    "oblici", "pisi", "pronadi-harf", "glas", "slusaj-klikni",
    "kratko-dugo", "voz-slogova", "citaj-rijeci", "brzina",
  ];
  return vjezbe.sort((a, b) => RED.indexOf(a.vrsta) - RED.indexOf(b.vrsta));
}

/**
 * Radni list za printanje.
 *
 * Automatizacija ne dolazi od jednog prolaza na času nego od kratkog
 * svakodnevnog ponavljanja. Zato lekcija ima i tabelu koja izlazi iz
 * štampača i ostaje kod kuće: dijete je prelazi kažiprstom i čita red po red.
 *
 * Miješanje ide iz drugog sjemena nego redovi za brzinu, da radni list ne
 * bude prepis onoga što je dijete već pročitalo na času.
 */
export function radniList(lekcija: number, redova = 6, poRedu = 5): string[][] {
  const { harfovi } = znanjeDoLekcije(lekcija);
  if (!harfovi.size) return [];
  const dugi = slogoviDo(lekcija).filter((s) => s.dug).map((s) => s.zapis);
  const fond = [...sviSlogovi(lekcija), ...dugi, ...rijeciDo(lekcija).map((r) => r.zapis)];
  if (!fond.length) return [];
  const redovi: string[][] = [];
  for (let i = 0; i < redova; i += 1) {
    const red = promijesaj(fond, lekcija * 100 + i * 7 + 3).slice(0, poRedu);
    // Kratka lekcija ima manje građe od jednog reda; tada se red dopuni
    // ponovo, jer prazna polja na radnom listu dijete preskače kao greškom.
    while (red.length && red.length < poRedu) red.push(fond[red.length % fond.length]);
    if (red.length) redovi.push(red);
  }
  return redovi;
}
