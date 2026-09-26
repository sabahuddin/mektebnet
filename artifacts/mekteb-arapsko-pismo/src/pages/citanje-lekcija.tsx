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
import { ArrowLeft, Volume2, VolumeX, Check, X, Timer, RotateCcw, Play, Square } from "lucide-react";
import { lekcijaPoBroju, type ReplikaPrice } from "@/data/citanje-lekcije";
import { vjezbeZaLekciju, type VjezbaCitanja, type StavkaVjezbe } from "@/data/citanje-vjezbe";
import { PROGRAM_CITANJA } from "@/data/citanje-program";
import { RIJECI_CITANJA } from "@/data/citanje-rijeci";
import { pustiZapis, zaustaviZvuk } from "@/lib/citanje-zvuk";

const POZE: Record<string, string> = {
  hoda: "/images/maskota/poses/pcela-hoda.webp",
  razmislja: "/images/maskota/poses/pcela-razmislja.webp",
  cita: "/images/maskota/poses/pcela-cita-kuran.webp",
};

const LIKOVI: Record<ReplikaPrice["ko"], { ime: string; okvir: string; mjehur: string }> = {
  rumejsa: { ime: "Rumejsa", okvir: "border-amber-200", mjehur: "bg-amber-50 text-amber-950" },
  bilal: { ime: "Bilal", okvir: "border-sky-200", mjehur: "bg-sky-50 text-sky-950" },
  narator: { ime: "", okvir: "border-transparent", mjehur: "bg-muted/50 text-muted-foreground italic" },
};

function Zapis({ tekst, velicina = "text-5xl" }: { tekst: string; velicina?: string }) {
  return <span dir="rtl" lang="ar" className={`${velicina} leading-[1.6] font-semibold`}>{tekst}</span>;
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
            {/* Rumejsa ima poze. Bilal ih još nema — kad stigne slika mrava u
                istom stilu, doda se ovdje isto kao i za nju. */}
            <div className={`w-14 h-14 shrink-0 rounded-2xl border-2 ${lik.okvir} bg-white overflow-hidden grid place-items-center`}>
              {r.ko === "rumejsa" && r.slika
                ? <img src={POZE[r.slika]} alt="" className="w-full h-full object-contain" />
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

/** Isto slovo na tri mjesta — bez ovoga dijete ga ne prepoznaje u riječi. */
function Oblici({ stavke }: { stavke: StavkaVjezbe[] }) {
  const poHarfu = useMemo(() => {
    const m = new Map<string, StavkaVjezbe[]>();
    for (const s of stavke) {
      const kljuc = s.zapis.replace(/ـ/g, "");
      m.set(kljuc, [...(m.get(kljuc) ?? []), s]);
    }
    return [...m.entries()];
  }, [stavke]);

  return (
    <div className="flex flex-col gap-4">
      {poHarfu.map(([harf, oblici]) => (
        <div key={harf} dir="rtl" className="grid gap-2" style={{ gridTemplateColumns: `repeat(${oblici.length}, minmax(0,1fr))` }}>
          {oblici.map((o) => (
            <div key={o.polozaj} className="flex flex-col items-center gap-1 rounded-xl border border-border bg-white py-4">
              <Zapis tekst={o.zapis} velicina="text-4xl" />
              <span dir="ltr" className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {o.polozaj === "sam" ? "sam" : o.polozaj === "pocetni" ? "na početku" : o.polozaj === "srednji" ? "u sredini" : "na kraju"}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Naći novo slovo među drugima — prepoznavanje prije čitanja. */
function PronadiHarf({ stavke }: { stavke: StavkaVjezbe[] }) {
  const [i, setI] = useState(0);
  const [odgovor, setOdgovor] = useState<"tacno" | "netacno" | null>(null);
  const s = stavke[i];
  if (!s) return null;

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-sm text-muted-foreground">Pitanje {i + 1} od {stavke.length}</p>
      <div dir="rtl" className="flex flex-wrap justify-center gap-3">
        {(s.izbor ?? []).map((iz, j) => {
          const tacno = iz === s.zapis;
          const pokazi = odgovor !== null && tacno;
          return (
            <button key={j} type="button" disabled={odgovor !== null}
              onClick={() => setOdgovor(tacno ? "tacno" : "netacno")}
              className={`w-24 h-24 rounded-2xl border-2 grid place-items-center transition-colors disabled:cursor-default ${
                pokazi ? "border-emerald-500 bg-emerald-50" : "border-border bg-white hover:border-teal-400"
              }`}>
              <Zapis tekst={iz} velicina="text-4xl" />
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

function Glas({ stavke }: { stavke: StavkaVjezbe[] }) {
  return (
    <div dir="rtl" className="flex flex-wrap justify-center gap-3">
      {stavke.map((s) => (
        <button key={s.zapis} type="button" onClick={() => pustiZapis(s.zapis)}
          className="flex flex-col items-center gap-2 rounded-2xl border-2 border-border bg-white px-7 py-5 hover:border-teal-400 transition-colors">
          <Zapis tekst={s.zapis} />
          <Volume2 className="w-5 h-5 text-teal-700" />
        </button>
      ))}
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
        className="w-20 h-20 rounded-full bg-teal-600 hover:bg-teal-700 text-white grid place-items-center transition-colors"
        aria-label={trazeno ? "Poslušaj ponovo" : "Počni"}>
        <Volume2 className="w-9 h-9" />
      </button>
      <div dir="rtl" className="flex flex-wrap justify-center gap-3">
        {ponudjeni.map((s) => (
          <button key={s.zapis} type="button" disabled={!trazeno}
            onClick={() => setOdgovor(s.zapis === trazeno ? "tacno" : "netacno")}
            className={`w-24 h-24 rounded-2xl border-2 grid place-items-center transition-colors disabled:opacity-40 ${
              odgovor !== null && s.zapis === trazeno ? "border-emerald-500 bg-emerald-50" : "border-border bg-white hover:border-teal-400"
            }`}>
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

function KratkoDugo({ stavke }: { stavke: StavkaVjezbe[] }) {
  return (
    <div className="flex flex-col gap-3">
      {stavke.map((s) => (
        <div key={s.zapis} dir="rtl" className="flex items-center justify-center gap-3 sm:gap-6 flex-wrap">
          <button type="button" onClick={() => s.parnjak && pustiZapis(s.parnjak)}
            className="flex items-center gap-3 rounded-2xl border-2 border-border bg-white px-6 py-4 hover:border-teal-400 transition-colors">
            <Zapis tekst={s.parnjak ?? ""} velicina="text-4xl" />
            <span dir="ltr" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">kratko</span>
          </button>
          <span className="text-muted-foreground" aria-hidden="true">←</span>
          <button type="button" onClick={() => pustiZapis(s.zapis)}
            className="flex items-center gap-3 rounded-2xl border-2 border-teal-300 bg-teal-50 px-6 py-4 hover:border-teal-500 transition-colors">
            <Zapis tekst={s.zapis} velicina="text-4xl" />
            <span dir="ltr" className="text-xs font-bold uppercase tracking-wider text-teal-700">dugo</span>
          </button>
        </div>
      ))}
    </div>
  );
}

function VozSlogova({ stavke }: { stavke: StavkaVjezbe[] }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {stavke.map((s) => (
        <div key={s.zapis} dir="rtl" className="flex items-center justify-center gap-2 flex-wrap rounded-xl border border-border bg-white py-3">
          {(s.dijelovi ?? []).map((dio, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span className="text-xl text-muted-foreground">+</span>}
              <span className="w-16 h-16 rounded-lg border border-border grid place-items-center"><Zapis tekst={dio} velicina="text-2xl" /></span>
            </span>
          ))}
          <span className="text-xl text-muted-foreground mx-1">=</span>
          <button type="button" onClick={() => pustiZapis(s.zapis)}
            className="h-16 px-4 rounded-lg border-2 border-teal-300 bg-teal-50 flex items-center gap-2 hover:border-teal-500 transition-colors">
            <Zapis tekst={s.zapis} velicina="text-2xl" />
          </button>
        </div>
      ))}
    </div>
  );
}

function CitajRijeci({ stavke }: { stavke: StavkaVjezbe[] }) {
  return (
    <div dir="rtl" className="flex flex-wrap justify-center gap-3">
      {stavke.map((s) => (
        <div key={s.zapis} className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-white px-6 py-5">
          <Zapis tekst={s.zapis} />
          <DugmeZvuka zapis={s.zapis} velicina="w-11 h-11" />
        </div>
      ))}
    </div>
  );
}

/** Štoperica je sprava, ne uputa da se sprava pripremi. */
function Brzina({ redovi, sekundi = 20 }: { redovi: string[][]; sekundi?: number }) {
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

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex items-center gap-3 flex-wrap justify-center">
        <span className={`flex items-center gap-2 text-3xl font-bold tabular-nums ${preostalo === 0 ? "text-amber-600" : "text-teal-700"}`}>
          <Timer className="w-7 h-7" />{preostalo}
        </span>
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
      <div className="flex gap-2">
        {redovi.map((_, i) => (
          <button key={i} type="button" onClick={() => { setRed(i); ponovo(); }}
            className={`w-9 h-9 rounded-lg font-bold text-sm ${i === red ? "bg-teal-600 text-white" : "border border-border hover:bg-muted"}`}>
            {i + 1}
          </button>
        ))}
      </div>
      <div dir="rtl" className="flex flex-wrap justify-center gap-4 rounded-2xl border-2 border-border bg-white px-6 py-5">
        {(redovi[red] ?? []).map((z, i) => (
          <button key={`${z}-${i}`} type="button" onClick={() => pustiZapis(z)} className="hover:text-teal-700 transition-colors">
            <Zapis tekst={z} velicina="text-3xl" />
          </button>
        ))}
      </div>
    </div>
  );
}

function Vjezba({ v, imaZvuk }: { v: VjezbaCitanja; imaZvuk?: boolean }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-muted/20 p-5 flex flex-col gap-5">
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <h3 className="font-extrabold text-lg text-center">{v.naslov}</h3>
        {v.trebaZvuk && !imaZvuk && <VolumeX className="w-4 h-4 text-amber-600" aria-label="bez snimaka" />}
      </div>
      {v.vrsta === "oblici" && <Oblici stavke={v.stavke} />}
      {v.vrsta === "pronadi-harf" && <PronadiHarf stavke={v.stavke} />}
      {v.vrsta === "glas" && <Glas stavke={v.stavke} />}
      {v.vrsta === "slusaj-klikni" && <SlusajKlikni stavke={v.stavke} />}
      {v.vrsta === "kratko-dugo" && <KratkoDugo stavke={v.stavke} />}
      {v.vrsta === "voz-slogova" && <VozSlogova stavke={v.stavke} />}
      {v.vrsta === "citaj-rijeci" && <CitajRijeci stavke={v.stavke} />}
      {v.vrsta === "brzina" && <Brzina redovi={v.redovi ?? []} sekundi={v.sekundi} />}
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
          <span dir="rtl" lang="ar" className="text-3xl">{program.harfovi.join("  ")}</span>
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

          {vjezbe.map((v) => <Vjezba key={v.vrsta} v={v} imaZvuk={lekcija.imaZvuk} />)}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Akordion naslov="1 — Priča">
            <p className="text-sm text-muted-foreground">Pročitati naglas onima koji još ne čitaju. Uz svaki glas napraviti pokret.</p>
            <Prica replike={lekcija.prica} />
            <p className="rounded-xl bg-[#fff9c4] text-neutral-900 px-4 py-3">{lekcija.pokret}</p>
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
                    <button key={r.zapis} type="button" onClick={() => pustiZapis(r.zapis)} className="text-3xl">{r.zapis}</button>
                  ))}
                </div>
              </>
            ) : <p className="text-sm text-muted-foreground">U ovoj lekciji još nema kur'anskih riječi.</p>}
          </Akordion>

          <Akordion naslov="4 — Ponavljanje">
            <ul className="flex flex-col gap-2">
              {lekcija.provjera.map((p, i) => (
                <li key={i} className="rounded-xl bg-[#fff9c4] text-neutral-900 px-4 py-3">{p}</li>
              ))}
            </ul>
          </Akordion>
        </div>
      )}
    </div>
  );
}
