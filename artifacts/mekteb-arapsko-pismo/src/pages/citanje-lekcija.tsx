// Jedna lekcija programa učenja čitanja.
//
// Dijete vidi lekciju istim redom kojim se uči: najprije razgovor Rumejse i
// Bilala, pa naše objašnjenje harfa, pa vježbe — vidjeti slovo, prepoznati
// ga, čuti ga, pročitati ga.
//
// Muallim vidi isto to složeno u četiri akordiona, s uputama koje izgovara
// naglas. Upute stoje kod njega, ne kod djeteta: dijete od pet godina ne može
// pročitati „Pripremiti štopericu".
//
// Imena slova se ne spominju ni u jednom prikazu.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Volume2, VolumeX, Check, X, Timer, RotateCcw, Play, Square, Printer,
  Hand, Eye, Search, Ruler, Link2, BookOpen } from "lucide-react";
import { lekcijaPoBroju, type ReplikaPrice, type Raspolozenje } from "@/data/citanje-lekcije";
import { vjezbeZaLekciju, radniList, type VjezbaCitanja, type StavkaVjezbe, type VrstaVjezbe } from "@/data/citanje-vjezbe";
import { asocijacija, porodicaHarfa } from "@/data/citanje-asocijacije";
import { NAZIV_POLOZAJA, REDOSLIJED_POLOZAJA } from "@/data/citanje-oblici";
import { PROGRAM_CITANJA, znanjeDoLekcije } from "@/data/citanje-program";
import { RIJECI_CITANJA } from "@/data/citanje-rijeci";
import { pustiZapis, zaustaviZvuk } from "@/lib/citanje-zvuk";
import { grozdovi, osnova, jeDuzina, TATVIL } from "@/lib/citanje-grozd";

/**
 * Slika po liku i raspoloženju. Rumejsa i Bilal imaju svoju sliku za isto
 * raspoloženje, pa priča kazuje šta lik osjeća, a ne koja datoteka stoji.
 */
const POZE: Record<"rumejsa" | "bilal", Record<Raspolozenje, string>> = {
  rumejsa: {
    pozdrav: "pcela-mase", odobrava: "pcela-palac", razmislja: "pcela-razmislja2",
    paznja: "pcela-boka", radost: "pcela-skace", "cudi-se": "pcela-iznenadjena",
    pokazuje: "pcela-pokazuje-lijevo", spava: "pcela-spava", zuri: "pcela-leti",
  },
  bilal: {
    pozdrav: "mrav-mase", odobrava: "mrav-palac", razmislja: "mrav-razmislja",
    paznja: "mrav-boka", radost: "mrav-skace", "cudi-se": "mrav-oduseven",
    pokazuje: "mrav-pokazuje", spava: "mrav-spava", zuri: "mrav-trci",
  },
};

const putanjaPoze = (ko: "rumejsa" | "bilal", raspolozenje: Raspolozenje) =>
  `/images/maskota/poses/${POZE[ko][raspolozenje]}.webp`;

const LIKOVI: Record<ReplikaPrice["ko"], { ime: string; okvir: string; mjehur: string }> = {
  rumejsa: { ime: "Rumejsa", okvir: "border-amber-200", mjehur: "bg-amber-50 text-amber-950" },
  bilal: { ime: "Bilal", okvir: "border-sky-200", mjehur: "bg-sky-50 text-sky-950" },
  narator: { ime: "", okvir: "border-transparent", mjehur: "bg-muted/50 text-muted-foreground italic" },
};

/**
 * Boje nose značenje, ne ukras. Tri su, i više ih neće biti — četvrta boja na
 * istom zapisu prestaje biti isticanje i postaje šara.
 */
const BOJA = {
  novi: "text-rose-600",       // ono što lekcija uvodi
  duzina: "text-sky-600",      // harf produženja
  tatvil: "text-neutral-300",  // crta koja stoji umjesto susjednog harfa
};

interface Isticanje {
  /** Harfovi koje lekcija uvodi — oni se boje. */
  novi?: string[];
  /** Bojiti i harfove produženja. */
  duzine?: boolean;
}

/**
 * Arapski zapis u lekciji.
 *
 * Prored je 2,0, ne manji: vokalizirani arapski ima harekate iznad i ispod
 * slova, pa se pri manjem proredu naslanjaju na red iznad i dijete ih više ne
 * razlikuje. Font je Scheherazade New — vidjeti --font-citanje u index.css.
 *
 * ISTIČE SE GROZD, NE HAREK. Mjereno u pregledniku: span oko samog hareka
 * preglednik zanemari, a boja harfa povuče harek za sobom. Bojenje hareka u
 * jednu a harfa u drugu boju — kako rade neki arapski bukvari — ovdje nije
 * moguće. Spajanje slova, s druge strane, span ne lomi, pa se jedan harf
 * smije istaknuti i usred riječi. Vidjeti citanje-grozd.ts.
 */
function Zapis({ tekst, velicina = "text-5xl", isticanje }: {
  tekst: string; velicina?: string; isticanje?: Isticanje;
}) {
  const djelovi = useMemo(() => {
    const g = grozdovi(tekst);
    return g.map((grozd, i) => {
      const o = osnova(grozd);
      if (o === TATVIL) return { grozd, klasa: BOJA.tatvil };
      if (isticanje?.novi?.includes(o)) return { grozd, klasa: BOJA.novi };
      if (isticanje?.duzine && jeDuzina(g, i)) return { grozd, klasa: BOJA.duzina };
      return { grozd, klasa: "" };
    });
  }, [tekst, isticanje]);

  return (
    <span dir="rtl" lang="ar" className={`${velicina} font-semibold`}
      style={{ fontFamily: "var(--font-citanje)", lineHeight: 2 }}>
      {djelovi.map((d, i) => d.klasa
        ? <span key={i} className={d.klasa}>{d.grozd}</span>
        : <span key={i}>{d.grozd}</span>)}
    </span>
  );
}

/** Znak sam, na tačkastom kolutu — jedini način da se harek vidi bez harfa. */
const KOLUT = "\u25CC";

/** Šta koja boja znači. Stoji jednom, iznad vježbi. */
function Legenda({ novi, duzine }: { novi: string[]; duzine: boolean }) {
  const stavke = [
    { klasa: BOJA.novi, tekst: "novo u ovoj lekciji" },
    ...(duzine ? [{ klasa: BOJA.duzina, tekst: "dužina" }] : []),
    { klasa: BOJA.tatvil, tekst: "crta umjesto susjednog harfa" },
  ];
  if (!novi.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm">
      {stavke.map((s) => (
        <span key={s.tekst} className="flex items-center gap-2">
          <span className={`${s.klasa} text-xl font-bold leading-none`} aria-hidden="true">●</span>
          <span className="text-muted-foreground">{s.tekst}</span>
        </span>
      ))}
    </div>
  );
}

/** Broj stavke u uglu okvira. Dijete ga koristi da kaže dokle je stiglo. */
function Broj({ n }: { n: number }) {
  return (
    <span className="absolute top-1.5 right-2 text-[11px] font-bold tabular-nums text-muted-foreground/70">
      {n}
    </span>
  );
}

/** Zaglavlje tabele — isti izgled u svim vježbama koje tabelu koriste. */
function Glava({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b-2 border-border">
      {children}
    </th>
  );
}

function Prica({ replike }: { replike: ReplikaPrice[] }) {
  return (
    <section className="flex flex-col gap-3">
      {replike.map((r, i) => {
        const lik = LIKOVI[r.ko];
        if (r.ko === "narator") {
          return <p key={i} className={`rounded-xl px-4 py-3 text-[15px] ${lik.mjehur}`}>{r.tekst}</p>;
        }
        return (
          <div key={i} className="flex items-start gap-3">
            <div className={`w-16 h-16 shrink-0 rounded-2xl border-2 ${lik.okvir} bg-white overflow-hidden grid place-items-center`}>
              {r.slika
                ? <img src={putanjaPoze(r.ko as "rumejsa" | "bilal", r.slika)} alt=""
                    className="w-full h-full object-contain" loading="lazy" />
                : <span className="text-xs font-bold text-muted-foreground">{lik.ime.slice(0, 2)}</span>}
            </div>
            <div className={`flex-1 rounded-2xl px-4 py-3 ${lik.mjehur}`}>
              <div className="font-bold text-sm mb-0.5">{lik.ime}</div>
              <div className="text-[15px] leading-relaxed">{r.tekst}</div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function DugmeZvuka({ zapis, velicina = "w-14 h-14" }: { zapis: string; velicina?: string }) {
  return (
    <button type="button" onClick={() => pustiZapis(zapis)} aria-label="Poslušaj"
      className={`${velicina} rounded-full bg-teal-600 hover:bg-teal-700 text-white grid place-items-center shrink-0 transition-colors`}>
      <Volume2 className="w-6 h-6" />
    </button>
  );
}

/**
 * Isto slovo na više mjesta — bez ovoga dijete ga ne prepoznaje u riječi.
 *
 * Tabela, ne niz okvira: dijete gleda odozgo nadolje i vidi da je riječ o
 * jednom te istom slovu, a ne o četiri različita. Tatvil je prigušen, pa se
 * vidi šta je harf a šta crta koja stoji umjesto susjeda.
 */
function Oblici({ stavke, novi }: { stavke: StavkaVjezbe[]; novi: string[] }) {
  const poHarfu = useMemo(() => {
    const m = new Map<string, StavkaVjezbe[]>();
    for (const s of stavke) {
      const kljuc = s.zapis.replace(/ـ/g, "");
      m.set(kljuc, [...(m.get(kljuc) ?? []), s]);
    }
    return [...m.entries()];
  }, [stavke]);

  const kolone = useMemo(
    () => REDOSLIJED_POLOZAJA.filter((p) => poHarfu.some(([, o]) => o.some((x) => x.polozaj === p))),
    [poHarfu],
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate" style={{ borderSpacing: "0 8px" }}>
        <thead>
          <tr>{kolone.map((k) => <Glava key={k}>{NAZIV_POLOZAJA[k]}</Glava>)}</tr>
        </thead>
        <tbody>
          {poHarfu.map(([harf, oblici]) => (
            <tr key={harf}>
              {kolone.map((k) => {
                const o = oblici.find((x) => x.polozaj === k);
                return (
                  <td key={k} className="px-1">
                    {o ? (
                      <div className="rounded-xl border-2 border-border bg-white py-3 grid place-items-center">
                        <Zapis tekst={o.zapis} velicina="text-4xl" isticanje={{ novi }} />
                      </div>
                    ) : (
                      <div className="rounded-xl border-2 border-dashed border-border/50 py-3 grid place-items-center text-muted-foreground/50 text-sm">
                        ne spaja
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Naći novo slovo među drugima — prepoznavanje prije čitanja. */
function PronadiHarf({ stavke, novi }: { stavke: StavkaVjezbe[]; novi: string[] }) {
  const [i, setI] = useState(0);
  const [odgovor, setOdgovor] = useState<"tacno" | "netacno" | null>(null);
  const s = stavke[i];
  if (!s) return null;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex items-center gap-4 rounded-2xl border-2 border-rose-200 bg-rose-50 px-6 py-3">
        <span className="text-xs font-bold uppercase tracking-wider text-rose-700">traži se</span>
        <Zapis tekst={s.trazeno ?? ""} velicina="text-4xl" isticanje={{ novi }} />
      </div>

      <div className="flex gap-1.5" aria-hidden="true">
        {stavke.map((_, j) => (
          <span key={j} className={`h-1.5 rounded-full transition-all ${
            j < i ? "w-6 bg-teal-600" : j === i ? "w-10 bg-teal-400" : "w-6 bg-border"}`} />
        ))}
      </div>

      <div dir="rtl" className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
        {(s.izbor ?? []).map((iz, j) => {
          const tacno = iz === s.zapis;
          const pokazi = odgovor !== null && tacno;
          return (
            <button key={j} type="button" disabled={odgovor !== null}
              onClick={() => setOdgovor(tacno ? "tacno" : "netacno")}
              className={`relative h-28 rounded-2xl border-2 grid place-items-center transition-colors disabled:cursor-default ${
                pokazi ? "border-emerald-500 bg-emerald-50" : "border-border bg-white hover:border-teal-400"
              }`}>
              <Broj n={j + 1} />
              <Zapis tekst={iz} velicina="text-4xl" />
              {pokazi && <Check className="absolute bottom-2 left-2 w-5 h-5 text-emerald-600" />}
            </button>
          );
        })}
      </div>

      <div className="h-10 flex items-center gap-3">
        {odgovor === "tacno" && <span className="flex items-center gap-2 text-emerald-700 font-bold"><Check className="w-5 h-5" /> Tačno</span>}
        {odgovor === "netacno" && <span className="flex items-center gap-2 text-amber-700 font-bold"><X className="w-5 h-5" /> Pogledaj ponovo</span>}
        {odgovor !== null && i + 1 < stavke.length && (
          <button type="button" onClick={() => { setI(i + 1); setOdgovor(null); }}
            className="rounded-xl border border-border px-4 py-2 font-bold hover:bg-muted">Sljedeće</button>
        )}
        {odgovor !== null && i + 1 === stavke.length && (
          <button type="button" onClick={() => { setI(0); setOdgovor(null); }}
            className="rounded-xl border border-border px-4 py-2 font-bold hover:bg-muted">Ispočetka</button>
        )}
      </div>
    </div>
  );
}

const HAREK = [
  { znak: "َ", ime: "fetha", glas: "E" },
  { znak: "ِ", ime: "kesra", glas: "I" },
  { znak: "ُ", ime: "damma", glas: "U" },
];

/**
 * Novi glas sa svakim naučenim harekom.
 *
 * Tabela sa harekom u zaglavlju: dijete čita red i čuje isti harf u tri
 * odjeće, pa mu je razlika u znaku, a ne u slovu. Zaglavlje nosi znak na
 * tačkastom kolutu, jer se harek drukčije ne može pokazati sam.
 */
function Glas({ stavke, novi }: { stavke: StavkaVjezbe[]; novi: string[] }) {
  const { harfovi, hareke } = useMemo(() => {
    const h: string[] = [];
    const k: string[] = [];
    for (const s of stavke) {
      const o = s.zapis[0];
      const z = s.zapis.slice(1);
      if (!h.includes(o)) h.push(o);
      if (z && !k.includes(z)) k.push(z);
    }
    return { harfovi: h, hareke: HAREK.filter((x) => k.includes(x.znak)) };
  }, [stavke]);

  const nadji = (harf: string, znak: string) =>
    stavke.find((s) => s.zapis === harf + znak)?.zapis;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate" style={{ borderSpacing: "0 8px" }}>
        <thead>
          <tr>
            {hareke.map((h) => (
              <Glava key={h.znak}>
                <span className="flex flex-col items-center gap-0.5">
                  <span dir="rtl" lang="ar" className="text-2xl text-foreground" style={{ fontFamily: "var(--font-citanje)" }}>
                    {KOLUT + h.znak}
                  </span>
                  <span>{h.ime} · {h.glas}</span>
                </span>
              </Glava>
            ))}
          </tr>
        </thead>
        <tbody>
          {harfovi.map((harf) => (
            <tr key={harf}>
              {hareke.map((h) => {
                const zapis = nadji(harf, h.znak);
                return (
                  <td key={h.znak} className="px-1">
                    {zapis ? (
                      <button type="button" onClick={() => pustiZapis(zapis)}
                        className="w-full rounded-xl border-2 border-border bg-white py-4 flex flex-col items-center gap-1.5 hover:border-teal-400 transition-colors">
                        <Zapis tekst={zapis} isticanje={{ novi }} />
                        <Volume2 className="w-5 h-5 text-teal-700" />
                      </button>
                    ) : <div className="py-4" />}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SlusajKlikni({ stavke }: { stavke: StavkaVjezbe[] }) {
  const [trazeno, setTrazeno] = useState<string | null>(null);
  const [odgovor, setOdgovor] = useState<"tacno" | "netacno" | null>(null);
  const ponudjeni = useMemo(() => stavke.slice(0, 6), [stavke]);

  const novo = () => {
    const izbor = ponudjeni[Math.floor(Math.random() * ponudjeni.length)].zapis;
    setTrazeno(izbor); setOdgovor(null); pustiZapis(izbor);
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <button type="button" onClick={() => (trazeno ? pustiZapis(trazeno) : novo())}
        className="w-24 h-24 rounded-full bg-teal-600 hover:bg-teal-700 text-white grid place-items-center transition-colors shadow-lg shadow-teal-600/20"
        aria-label={trazeno ? "Poslušaj ponovo" : "Počni"}>
        <Volume2 className="w-11 h-11" />
      </button>
      <p className="text-sm text-muted-foreground">
        {trazeno ? "Pokaži šta si čuo" : "Pritisni zvučnik"}
      </p>
      <div dir="rtl" className="grid grid-cols-3 gap-3 w-full">
        {ponudjeni.map((s, j) => (
          <button key={s.zapis} type="button" disabled={!trazeno}
            onClick={() => setOdgovor(s.zapis === trazeno ? "tacno" : "netacno")}
            className={`relative h-28 rounded-2xl border-2 grid place-items-center transition-colors disabled:opacity-40 ${
              odgovor !== null && s.zapis === trazeno ? "border-emerald-500 bg-emerald-50" : "border-border bg-white hover:border-teal-400"
            }`}>
            <Broj n={j + 1} />
            <Zapis tekst={s.zapis} velicina="text-4xl" />
          </button>
        ))}
      </div>
      <div className="h-10 flex items-center gap-3">
        {odgovor === "tacno" && <span className="flex items-center gap-2 text-emerald-700 font-bold"><Check className="w-5 h-5" /> Tačno</span>}
        {odgovor === "netacno" && <span className="flex items-center gap-2 text-amber-700 font-bold"><X className="w-5 h-5" /> Poslušaj još jednom</span>}
        {trazeno && <button type="button" onClick={novo} className="rounded-xl border border-border px-4 py-2 font-bold hover:bg-muted">Sljedeće</button>}
      </div>
    </div>
  );
}

/**
 * Kratko i dugo, jedno uz drugo.
 *
 * Tabela sa dvije kolone, jer se dužina ne čuje sama nego u poređenju.
 * Harf produženja je obojen, pa dijete vidi gdje je razlika prije nego je čuje.
 */
function KratkoDugo({ stavke }: { stavke: StavkaVjezbe[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate" style={{ borderSpacing: "0 8px" }}>
        <thead>
          <tr>
            <Glava>kratko — jedan pljesak</Glava>
            <Glava>dugo — raširi ruke</Glava>
          </tr>
        </thead>
        <tbody>
          {stavke.map((s) => (
            <tr key={s.zapis}>
              <td className="px-1">
                <button type="button" onClick={() => s.parnjak && pustiZapis(s.parnjak)}
                  className="w-full rounded-xl border-2 border-border bg-white py-3 flex items-center justify-center gap-3 hover:border-teal-400 transition-colors">
                  <Zapis tekst={s.parnjak ?? ""} velicina="text-4xl" />
                  <Volume2 className="w-4 h-4 text-muted-foreground" />
                </button>
              </td>
              <td className="px-1">
                <button type="button" onClick={() => pustiZapis(s.zapis)}
                  className="w-full rounded-xl border-2 border-sky-300 bg-sky-50 py-3 flex items-center justify-center gap-3 hover:border-sky-500 transition-colors">
                  <Zapis tekst={s.zapis} velicina="text-4xl" isticanje={{ duzine: true }} />
                  <Volume2 className="w-4 h-4 text-sky-700" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Spajanje dijelova u cjelinu — vagoni koji se kače jedan za drugi. */
function VozSlogova({ stavke, novi }: { stavke: StavkaVjezbe[]; novi: string[] }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {stavke.map((s, i) => (
        <div key={s.zapis} className="relative rounded-2xl border-2 border-border bg-white px-3 py-3">
          <Broj n={i + 1} />
          <div dir="rtl" className="flex items-center justify-center gap-1.5 flex-wrap">
            {(s.dijelovi ?? []).map((dio, j) => (
              <span key={j} className="flex items-center gap-1.5">
                {j > 0 && <span className="text-lg font-bold text-muted-foreground/60">+</span>}
                <span className="w-14 h-14 rounded-lg border-2 border-dashed border-border grid place-items-center bg-muted/20">
                  <Zapis tekst={dio} velicina="text-2xl" isticanje={{ novi }} />
                </span>
              </span>
            ))}
            <span className="text-lg font-bold text-muted-foreground/60 mx-0.5">=</span>
            <button type="button" onClick={() => pustiZapis(s.zapis)}
              className="h-14 px-4 rounded-lg border-2 border-teal-300 bg-teal-50 flex items-center gap-2 hover:border-teal-500 transition-colors">
              <Zapis tekst={s.zapis} velicina="text-2xl" isticanje={{ novi }} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Riječi. Novi harf je obojen i unutar riječi — span ne lomi spajanje. */
function CitajRijeci({ stavke, novi }: { stavke: StavkaVjezbe[]; novi: string[] }) {
  return (
    <div dir="rtl" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {stavke.map((s, i) => (
        <div key={s.zapis} className="relative flex flex-col items-center gap-3 rounded-2xl border-2 border-border bg-white px-4 py-5">
          <Broj n={i + 1} />
          <Zapis tekst={s.zapis} isticanje={{ novi, duzine: true }} />
          <DugmeZvuka zapis={s.zapis} velicina="w-11 h-11" />
        </div>
      ))}
    </div>
  );
}

/** Štoperica je sprava, ne uputa da se sprava pripremi. */
function Brzina({ redovi, sekundi = 20, novi }: { redovi: string[][]; sekundi?: number; novi: string[] }) {
  const [preostalo, setPreostalo] = useState(sekundi);
  const [radi, setRadi] = useState(false);
  const [red, setRed] = useState(0);
  const otkucaj = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!radi) return;
    otkucaj.current = setInterval(() => {
      setPreostalo((p) => (p <= 1 ? (setRadi(false), 0) : p - 1));
    }, 1000);
    return () => { if (otkucaj.current) clearInterval(otkucaj.current); };
  }, [radi]);

  const ponovo = () => { setRadi(false); setPreostalo(sekundi); };
  const dio = Math.max(0, Math.min(1, preostalo / sekundi));

  // Red se lomi na linije po pet, da stane na uzak ekran a da se i dalje čita
  // zdesna nalijevo, a ne odozgo nadolje.
  const podredovi = useMemo(() => {
    const izvor = redovi[red] ?? [];
    const izl: string[][] = [];
    for (let i = 0; i < izvor.length; i += 5) izl.push(izvor.slice(i, i + 5));
    return izl;
  }, [redovi, red]);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="w-full rounded-2xl border-2 border-border bg-white px-5 py-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className={`flex items-center gap-2 text-3xl font-bold tabular-nums ${preostalo === 0 ? "text-amber-600" : "text-teal-700"}`}>
            <Timer className="w-7 h-7" />{preostalo}
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {!radi && preostalo > 0 && (
              <button type="button" onClick={() => setRadi(true)}
                className="flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold px-5 py-2.5">
                <Play className="w-4 h-4" /> Kreni
              </button>
            )}
            {radi && (
              <button type="button" onClick={() => setRadi(false)}
                className="flex items-center gap-2 rounded-xl border border-border font-bold px-5 py-2.5 hover:bg-muted">
                <Square className="w-4 h-4" /> Stani
              </button>
            )}
            {(preostalo === 0 || (!radi && preostalo < sekundi)) && (
              <button type="button" onClick={ponovo}
                className="flex items-center gap-2 rounded-xl border border-border font-bold px-5 py-2.5 hover:bg-muted">
                <RotateCcw className="w-4 h-4" /> Ispočetka
              </button>
            )}
          </div>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-1000 ease-linear ${preostalo === 0 ? "bg-amber-500" : "bg-teal-500"}`}
            style={{ width: `${dio * 100}%` }} />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap justify-center">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">red</span>
        {redovi.map((_, i) => (
          <button key={i} type="button" onClick={() => { setRed(i); ponovo(); }}
            className={`w-9 h-9 rounded-lg font-bold text-sm ${i === red ? "bg-teal-600 text-white" : "border border-border hover:bg-muted"}`}>
            {i + 1}
          </button>
        ))}
      </div>

      {/* Tečnost se vježba vodoravnim prelaskom preko reda, zdesna nalijevo.
          Okomit stupac bi bio čitljiv, ali bi vježbao pogrešan pokret oka. */}
      <div dir="rtl" className="w-full rounded-2xl border-2 border-border bg-white p-3">
        <table className="w-full border-separate" style={{ borderSpacing: "6px" }}>
          <tbody>
            {podredovi.map((pod, r) => (
              <tr key={r}>
                {pod.map((z, i) => (
                  <td key={`${z}-${i}`} className="w-1/5">
                    <button type="button" onClick={() => pustiZapis(z)}
                      className="w-full rounded-xl border border-border/70 py-2 grid place-items-center hover:border-teal-400 hover:bg-teal-50/40 transition-colors">
                      <Zapis tekst={z} velicina="text-3xl" isticanje={{ novi, duzine: true }} />
                    </button>
                  </td>
                ))}
                {pod.length < 5 && Array.from({ length: 5 - pod.length }, (_, k) => <td key={`p${k}`} />)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Na šta slovo liči.
 *
 * Oblik se ne pamti kao geometrija nego kao slika. „Uspravna linija sa
 * vodoravnom crticom" je opis za odraslog; dijete pamti čamac, uho i zdjelicu.
 * Zato svako novo slovo dobije predmet iz svoje okoline prije nego se od njega
 * zatraži da ga prepozna.
 */
function SlikeSlova({ harfovi, naucena }: { harfovi: string[]; naucena: Set<string> }) {
  const stavke = harfovi.map((h) => ({ harf: h, a: asocijacija(h), rod: porodicaHarfa(h, naucena) }))
    .filter((x) => x.a);
  if (!stavke.length) return null;

  return (
    <section className="flex flex-col gap-3">
      {stavke.map(({ harf, a, rod }) => (
        <div key={harf} className="rounded-2xl border border-indigo-200 bg-indigo-50/60 px-5 py-4 flex items-start gap-4">
          <div dir="rtl" className="shrink-0 rounded-xl bg-white border border-indigo-200 px-5 py-2 grid place-items-center">
            <Zapis tekst={harf} velicina="text-5xl" />
          </div>
          <div className="flex flex-col gap-1.5 min-w-0">
            <h2 className="font-extrabold text-indigo-900">Ovo je {a!.slika}</h2>
            <p className="text-[15px] leading-relaxed text-indigo-950">{a!.opis}</p>
            {rod.length > 0 && (
              <p dir="ltr" className="text-sm text-indigo-800">
                Isti oblik već znaš:{" "}
                <span dir="rtl" lang="ar" className="text-2xl align-middle"
                  style={{ fontFamily: "var(--font-citanje)" }}>{rod.join("  ")}</span>
                {" "}— razlika je samo u tačkicama.
              </p>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}

/**
 * Pisanje prstom i plastelinom.
 *
 * Oko prepozna slovo prije nego ga ruka umije napraviti, ali se bez ruke
 * prepoznavanje raspada kad slovo stoji u nepoznatoj riječi. Zato ruka dolazi
 * prije lova na slova, a ne poslije čitanja.
 */
function Pisi({ stavke, novi }: { stavke: StavkaVjezbe[]; novi: string[] }) {
  const KORACI = ["prstom po zraku", "po pijesku ili grubom papiru", "iz plastelina"];
  return (
    <div className="flex flex-col gap-4">
      {stavke.map((s, i) => (
        <div key={s.zapis} className="relative rounded-2xl border-2 border-border bg-white p-4 flex flex-col gap-3">
          <Broj n={i + 1} />
          <div className="flex items-center gap-4">
            <div dir="rtl" className="shrink-0 w-24 h-24 rounded-xl border-2 border-dashed border-rose-300 bg-rose-50/40 grid place-items-center">
              <Zapis tekst={s.zapis} velicina="text-5xl" isticanje={{ novi }} />
            </div>
            <div className="flex flex-col gap-1.5 min-w-0">
              {s.slika && (
                <span className="self-start rounded-lg bg-indigo-100 text-indigo-900 px-2.5 py-1 text-sm font-bold">
                  {s.slika}
                </span>
              )}
              <p className="text-[15px] leading-relaxed text-muted-foreground flex items-start gap-2">
                <Hand className="w-4 h-4 shrink-0 mt-1" />
                <span>{s.potez}</span>
              </p>
            </div>
          </div>
          <ol className="flex flex-wrap gap-2">
            {KORACI.map((k, j) => (
              <li key={k} className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-1.5 text-sm">
                <span className="w-5 h-5 rounded-full bg-teal-600 text-white grid place-items-center text-[11px] font-bold">{j + 1}</span>
                {k}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

/**
 * Radni list za printanje.
 *
 * Tečnost se ne stiče na času nego između časova, kratkim svakodnevnim
 * prolazom. Tabela zato izlazi iz štampača i ostaje kod kuće; dijete je
 * prelazi kažiprstom i čita red po red.
 *
 * Pri štampi se sve ostalo sakriva, a ne uklanja: `visibility` čuva raspored
 * stranice, dok bi `display: none` na roditeljima odnio i samu tabelu.
 */
function RadniList({ redovi, domaca }: { redovi: string[][]; domaca: string[] }) {
  if (!redovi.length) return null;
  return (
    <>
      <style>{`@media print {
        body * { visibility: hidden; }
        #radni-list, #radni-list * { visibility: visible; }
        #radni-list { position: absolute; inset: 0 auto auto 0; width: 100%; padding: 0; border: 0; }
        #radni-list .bez-stampe { display: none; }
      }`}</style>
      <div id="radni-list" className="flex flex-col gap-4 rounded-2xl border border-border p-5">
        <div className="bez-stampe flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground">
            Isprintati i ostaviti kod kuće. Dijete prelazi kažiprstom i čita red po red.
          </p>
          <button type="button" onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white">
            <Printer className="w-4 h-4" /> Printaj
          </button>
        </div>
        <div dir="rtl" className="flex flex-col gap-2">
          {redovi.map((red, i) => (
            <div key={i} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${red.length}, minmax(0,1fr))` }}>
              {red.map((z, j) => (
                <div key={`${i}-${j}`} className="rounded-lg border border-border bg-white grid place-items-center py-2">
                  <Zapis tekst={z} velicina="text-3xl" />
                </div>
              ))}
            </div>
          ))}
        </div>
        {domaca.length > 0 && (
          <ul className="flex flex-col gap-1.5 text-sm">
            {domaca.map((d, i) => <li key={i} className="flex gap-2"><span>•</span><span>{d}</span></li>)}
          </ul>
        )}
      </div>
    </>
  );
}

/** Ikona i boja trake, po vrsti vježbe. Oko traži vježbu po boji, ne po naslovu. */
const TRAKA: Record<VrstaVjezbe, { ikona: typeof Eye; boja: string }> = {
  oblici:         { ikona: Eye,     boja: "bg-slate-100 text-slate-700" },
  pisi:           { ikona: Hand,    boja: "bg-rose-100 text-rose-700" },
  "pronadi-harf": { ikona: Search,  boja: "bg-amber-100 text-amber-800" },
  glas:           { ikona: Volume2, boja: "bg-teal-100 text-teal-800" },
  "slusaj-klikni":{ ikona: Volume2, boja: "bg-teal-100 text-teal-800" },
  "kratko-dugo":  { ikona: Ruler,   boja: "bg-sky-100 text-sky-800" },
  "voz-slogova":  { ikona: Link2,   boja: "bg-violet-100 text-violet-800" },
  "citaj-rijeci": { ikona: BookOpen,boja: "bg-emerald-100 text-emerald-800" },
  brzina:         { ikona: Timer,   boja: "bg-orange-100 text-orange-800" },
};

function Vjezba({ v, imaZvuk, novi, redni }: {
  v: VjezbaCitanja; imaZvuk?: boolean; novi: string[]; redni: number;
}) {
  const t = TRAKA[v.vrsta];
  const Ikona = t.ikona;
  const koliko = v.redovi ? v.redovi.flat().length : v.stavke.length;

  return (
    <section className="rounded-2xl border-2 border-border/60 bg-white overflow-hidden">
      <header className={`flex items-center gap-3 px-5 py-3 ${t.boja}`}>
        <span className="w-9 h-9 rounded-xl bg-white/70 grid place-items-center shrink-0">
          <Ikona className="w-5 h-5" />
        </span>
        <div className="flex flex-col min-w-0">
          <h3 className="font-extrabold leading-tight">{redni}. {v.naslov}</h3>
          <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">{koliko} stavki</span>
        </div>
        {v.trebaZvuk && !imaZvuk && <VolumeX className="w-5 h-5 ml-auto shrink-0" aria-label="bez snimaka" />}
      </header>

      <div className="p-5 bg-muted/20">
        {v.vrsta === "oblici" && <Oblici stavke={v.stavke} novi={novi} />}
        {v.vrsta === "pisi" && <Pisi stavke={v.stavke} novi={novi} />}
        {v.vrsta === "pronadi-harf" && <PronadiHarf stavke={v.stavke} novi={novi} />}
        {v.vrsta === "glas" && <Glas stavke={v.stavke} novi={novi} />}
        {v.vrsta === "slusaj-klikni" && <SlusajKlikni stavke={v.stavke} />}
        {v.vrsta === "kratko-dugo" && <KratkoDugo stavke={v.stavke} />}
        {v.vrsta === "voz-slogova" && <VozSlogova stavke={v.stavke} novi={novi} />}
        {v.vrsta === "citaj-rijeci" && <CitajRijeci stavke={v.stavke} novi={novi} />}
        {v.vrsta === "brzina" && <Brzina redovi={v.redovi ?? []} sekundi={v.sekundi} novi={novi} />}
      </div>
    </section>
  );
}

function Akordion({ naslov, children }: { naslov: string; children: React.ReactNode }) {
  const [otvoren, setOtvoren] = useState(false);
  return (
    <div className="rounded-2xl border border-border/60 bg-white overflow-hidden">
      <button type="button" onClick={() => setOtvoren((o) => !o)}
        className="w-full text-left px-5 py-4 font-extrabold uppercase tracking-wide text-sm hover:bg-muted/40 flex items-center justify-between gap-3">
        {naslov}<span className="text-muted-foreground text-lg leading-none">{otvoren ? "−" : "+"}</span>
      </button>
      {otvoren && <div className="px-5 pb-5 flex flex-col gap-4">{children}</div>}
    </div>
  );
}

export default function CitanjeLekcijaPage() {
  const { broj } = useParams<{ broj: string }>();
  const lekcija = lekcijaPoBroju(Number(broj));
  const program = PROGRAM_CITANJA.find((l) => l.broj === Number(broj));
  const vjezbe = useMemo(() => vjezbeZaLekciju(Number(broj)), [broj]);
  const [prikaz, setPrikaz] = useState<"dijete" | "muallim">("dijete");

  useEffect(() => () => zaustaviZvuk(), []);

  const kuranske = useMemo(
    () => RIJECI_CITANJA.filter((r) => r.lekcija === Number(broj) && r.kuran),
    [broj],
  );

  // Slova naučena do prethodne lekcije — za uporedbu kostura („isti čamac,
  // samo sa dvije tačkice"). Današnja slova se u uporedbu ne broje.
  const naucena = useMemo(() => znanjeDoLekcije(Number(broj) - 1).harfovi, [broj]);
  const list = useMemo(() => radniList(Number(broj)), [broj]);

  if (!lekcija || !program) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center flex flex-col gap-3">
        <p className="text-muted-foreground">Ova lekcija još nije napisana.</p>
        <Link href="/citanje" className="text-teal-700 font-bold">Nazad na spisak</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">
      <Link href="/citanje" className="inline-flex items-center gap-2 text-teal-700 font-bold w-fit">
        <ArrowLeft className="w-4 h-4" /> Sve lekcije
      </Link>

      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-extrabold">{lekcija.broj}. {lekcija.naslov}</h1>
        <div className="flex items-center gap-3 flex-wrap text-muted-foreground">
          <span dir="rtl" lang="ar" className="text-3xl" style={{ fontFamily: "var(--font-citanje)", lineHeight: 2 }}>{program.harfovi.join("  ")}</span>
          {program.znakovi.length > 0 && <span className="text-sm">+ {program.znakovi.join(", ")}</span>}
        </div>
      </header>

      <div className="flex gap-2 rounded-xl bg-muted p-1 w-fit">
        {(["dijete", "muallim"] as const).map((p) => (
          <button key={p} type="button" onClick={() => { zaustaviZvuk(); setPrikaz(p); }}
            className={`px-5 py-2 rounded-lg font-bold text-sm transition-colors ${
              prikaz === p ? "bg-white shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}>
            {p === "dijete" ? "Za dijete" : "Za muallima"}
          </button>
        ))}
      </div>

      {prikaz === "dijete" ? (
        <div className="flex flex-col gap-6">
          {!lekcija.imaZvuk && (
            <p className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <VolumeX className="w-5 h-5 shrink-0 mt-0.5" />
              <span>Snimci za ovu lekciju još nisu napravljeni. Do tada muallim izgovara
              umjesto zvučnika — sve ostalo u vježbama radi.</span>
            </p>
          )}

          <Prica replike={lekcija.prica} />

          <section className="flex flex-col gap-3">
            {lekcija.objasnjenje.map((o) => (
              <div key={o.naslov} className="rounded-2xl border border-teal-200 bg-teal-50/60 px-5 py-4 flex flex-col gap-2">
                <h2 className="font-extrabold text-teal-900">{o.naslov}</h2>
                <p className="text-[15px] leading-relaxed text-teal-950">{o.tekst}</p>
                {o.primjer && (
                  <div dir="rtl" className="self-start rounded-xl bg-white border border-teal-200 px-5 py-2">
                    <Zapis tekst={o.primjer} velicina="text-3xl" />
                  </div>
                )}
              </div>
            ))}
          </section>

          <SlikeSlova harfovi={program.harfovi} naucena={naucena} />

          <Legenda novi={program.harfovi} duzine={znanjeDoLekcije(Number(broj)).znakovi.has("medd")} />

          {vjezbe.map((v, i) => (
            <Vjezba key={v.vrsta} v={v} imaZvuk={lekcija.imaZvuk} novi={program.harfovi} redni={i + 1} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Akordion naslov="1 — Priča">
            <p className="text-sm text-muted-foreground">Pročitati naglas onima koji još ne čitaju. Uz svaki glas napraviti pokret.</p>
            <Prica replike={lekcija.prica} />
            <p className="rounded-xl bg-[#fff9c4] text-neutral-900 px-4 py-3">{lekcija.pokret}</p>
            <p className="text-sm text-muted-foreground">
              Slike slova ispod izgovoriti prije prve vježbe. Dijete slovo prvo vidi kao
              predmet, pa onda kao slovo.
            </p>
            <SlikeSlova harfovi={program.harfovi} naucena={naucena} />
          </Akordion>

          <Akordion naslov="2 — Vježbamo čitanje">
            {vjezbe.map((v) => (
              <div key={v.vrsta} className="flex flex-col gap-2">
                <div className="font-bold">{v.naslov} <span className="font-normal text-muted-foreground">
                  ({v.redovi ? `${v.redovi.length} reda` : `${v.stavke.length} stavki`})</span></div>
                <p className="rounded-xl bg-[#fff9c4] text-neutral-900 px-4 py-3">{v.uputa}</p>
              </div>
            ))}
          </Akordion>

          <Akordion naslov="3 — Riječi iz Kur'ana">
            {kuranske.length ? (
              <>
                <p className="text-sm text-muted-foreground">Ove riječi dijete već može pročitati, a javljaju se u Kur'anu. Ne prevoditi — cilj je čitanje.</p>
                <div dir="rtl" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 flex flex-wrap gap-5">
                  {kuranske.map((r) => (
                    <button key={r.zapis} type="button" onClick={() => pustiZapis(r.zapis)} className="text-3xl" style={{ fontFamily: "var(--font-citanje)", lineHeight: 2 }}>{r.zapis}</button>
                  ))}
                </div>
              </>
            ) : <p className="text-sm text-muted-foreground">U ovoj lekciji još nema kur'anskih riječi.</p>}
          </Akordion>

          <Akordion naslov="4 — Ponavljanje i radni list">
            <p className="text-sm text-muted-foreground">Provjeriti prije kraja časa:</p>
            <ul className="flex flex-col gap-2">
              {lekcija.provjera.map((p, i) => (
                <li key={i} className="rounded-xl bg-[#fff9c4] text-neutral-900 px-4 py-3">{p}</li>
              ))}
            </ul>
            <RadniList redovi={list} domaca={lekcija.domaca} />
          </Akordion>
        </div>
      )}
    </div>
  );
}
