// Jedna lekcija programa učenja čitanja, u dva prikaza.
//
// Dijete vidi samo vježbe: veliki zapis, zvučnik, ništa što treba pročitati
// na bosanskom. Dijete od pet godina ne može pročitati uputu, pa mu se i ne
// piše — uputa stoji u prikazu za muallima, koji je izgovara naglas.
//
// Imena slova se nigdje ne spominju, ni u jednom prikazu.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Volume2, VolumeX, Check, X, Timer, RotateCcw, Play, Square } from "lucide-react";
import { lekcijaPoBroju, type VjezbaCitanja, type StavkaVjezbe } from "@/data/citanje-lekcije";
import { PROGRAM_CITANJA } from "@/data/citanje-program";
import { RIJECI_CITANJA } from "@/data/citanje-rijeci";
import { pustiZapis, zaustaviZvuk } from "@/lib/citanje-zvuk";

const LIKOVI: Record<string, { ime: string; boja: string }> = {
  rumejsa: { ime: "Rumejsa", boja: "bg-amber-100 text-amber-900" },
  bilal: { ime: "Bilal", boja: "bg-sky-100 text-sky-900" },
  narator: { ime: "", boja: "bg-muted text-muted-foreground" },
};

function Zapis({ tekst, velicina = "text-5xl" }: { tekst: string; velicina?: string }) {
  return <span dir="rtl" lang="ar" className={`${velicina} leading-[1.6] font-semibold`}>{tekst}</span>;
}

function DugmeZvuka({ zapis, oznaka }: { zapis: string; oznaka?: string }) {
  return (
    <button
      type="button"
      onClick={() => pustiZapis(zapis)}
      aria-label={oznaka ?? "Poslušaj"}
      className="w-14 h-14 rounded-full bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center shrink-0 transition-colors"
    >
      <Volume2 className="w-6 h-6" />
    </button>
  );
}

/** Čuje slog, klikne ga među ponuđenima. */
function SlusajKlikni({ stavke }: { stavke: StavkaVjezbe[] }) {
  const [trazeno, setTrazeno] = useState<string | null>(null);
  const [odgovor, setOdgovor] = useState<"tacno" | "netacno" | null>(null);

  const novoPitanje = () => {
    const izbor = stavke[Math.floor(Math.random() * stavke.length)].zapis;
    setTrazeno(izbor);
    setOdgovor(null);
    pustiZapis(izbor);
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <button
        type="button"
        onClick={() => (trazeno ? pustiZapis(trazeno) : novoPitanje())}
        className="w-20 h-20 rounded-full bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center transition-colors"
        aria-label={trazeno ? "Poslušaj ponovo" : "Počni"}
      >
        <Volume2 className="w-9 h-9" />
      </button>

      <div dir="rtl" className="flex flex-wrap justify-center gap-3">
        {stavke.map((s) => {
          const izabrano = odgovor !== null && s.zapis === trazeno;
          const pogresno = odgovor === "netacno" && s.zapis !== trazeno;
          return (
            <button
              key={s.zapis}
              type="button"
              disabled={!trazeno}
              onClick={() => setOdgovor(s.zapis === trazeno ? "tacno" : "netacno")}
              className={`w-28 h-28 rounded-2xl border-2 flex items-center justify-center transition-colors disabled:opacity-40 ${
                izabrano ? "border-emerald-500 bg-emerald-50"
                  : pogresno && odgovor === "netacno" ? "border-border bg-white"
                  : "border-border bg-white hover:border-teal-400"
              }`}
            >
              <Zapis tekst={s.zapis} />
            </button>
          );
        })}
      </div>

      <div className="h-10 flex items-center gap-3">
        {odgovor === "tacno" && (
          <span className="flex items-center gap-2 text-emerald-700 font-bold">
            <Check className="w-5 h-5" /> Tačno
          </span>
        )}
        {odgovor === "netacno" && (
          <span className="flex items-center gap-2 text-amber-700 font-bold">
            <X className="w-5 h-5" /> Poslušaj još jednom
          </span>
        )}
        {trazeno && (
          <button type="button" onClick={novoPitanje}
            className="rounded-xl border border-border px-4 py-2 font-bold hover:bg-muted">
            Sljedeće
          </button>
        )}
      </div>
    </div>
  );
}

/** Isti harf kratko pa dugo — razlika se čuje, ne objašnjava. */
function KratkoDugo({ stavke }: { stavke: StavkaVjezbe[] }) {
  return (
    <div className="flex flex-col gap-3">
      {stavke.map((s) => (
        <div key={s.zapis} dir="rtl" className="flex items-center justify-center gap-3 sm:gap-6 flex-wrap">
          <button type="button" onClick={() => s.parnjak && pustiZapis(s.parnjak)}
            className="flex items-center gap-3 rounded-2xl border-2 border-border bg-white px-6 py-4 hover:border-teal-400 transition-colors">
            <Zapis tekst={s.parnjak ?? ""} velicina="text-4xl" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">kratko</span>
          </button>
          <span className="text-muted-foreground" aria-hidden="true">←</span>
          <button type="button" onClick={() => pustiZapis(s.zapis)}
            className="flex items-center gap-3 rounded-2xl border-2 border-teal-300 bg-teal-50 px-6 py-4 hover:border-teal-500 transition-colors">
            <Zapis tekst={s.zapis} velicina="text-4xl" />
            <span className="text-xs font-bold uppercase tracking-wider text-teal-700">dugo</span>
          </button>
        </div>
      ))}
    </div>
  );
}

/** Vagon po vagon, pa sve zajedno. */
function VozSlogova({ stavke }: { stavke: StavkaVjezbe[] }) {
  return (
    <div className="flex flex-col gap-5">
      {stavke.map((s) => (
        <div key={s.zapis} dir="rtl" className="flex items-center justify-center gap-2 flex-wrap">
          {(s.dijelovi ?? []).map((dio, i) => (
            <span key={`${s.zapis}-${i}`} className="flex items-center gap-2">
              {i > 0 && <span className="text-2xl text-muted-foreground">+</span>}
              <button type="button" onClick={() => pustiZapis(dio)}
                className="w-20 h-20 rounded-xl border-2 border-border bg-white flex items-center justify-center hover:border-teal-400 transition-colors">
                <Zapis tekst={dio} velicina="text-3xl" />
              </button>
            </span>
          ))}
          <span className="text-2xl text-muted-foreground mx-1">=</span>
          <button type="button" onClick={() => pustiZapis(s.zapis)}
            className="h-20 px-6 rounded-xl border-2 border-teal-300 bg-teal-50 flex items-center gap-3 hover:border-teal-500 transition-colors">
            <Zapis tekst={s.zapis} velicina="text-3xl" />
            <Volume2 className="w-5 h-5 text-teal-700" />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Dijete čita samo; zvučnik služi za provjeru poslije. */
function CitajRijeci({ stavke }: { stavke: StavkaVjezbe[] }) {
  return (
    <div dir="rtl" className="flex flex-wrap justify-center gap-3">
      {stavke.map((s) => (
        <div key={s.zapis} className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-white px-6 py-5">
          <Zapis tekst={s.zapis} />
          <DugmeZvuka zapis={s.zapis} oznaka={`Poslušaj ${s.zapis}`} />
        </div>
      ))}
    </div>
  );
}

/** Štoperica je sprava, ne uputa da se sprava pripremi. */
function Brzina({ stavke, sekundi = 20 }: { stavke: StavkaVjezbe[]; sekundi?: number }) {
  const [preostalo, setPreostalo] = useState(sekundi);
  const [radi, setRadi] = useState(false);
  const otkucaj = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!radi) return;
    otkucaj.current = setInterval(() => {
      setPreostalo((p) => {
        if (p <= 1) { setRadi(false); return 0; }
        return p - 1;
      });
    }, 1000);
    return () => { if (otkucaj.current) clearInterval(otkucaj.current); };
  }, [radi]);

  const ponovo = () => { setRadi(false); setPreostalo(sekundi); };

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex items-center gap-4">
        <span className={`flex items-center gap-2 text-3xl font-bold tabular-nums ${
          preostalo === 0 ? "text-amber-600" : "text-teal-700"
        }`}>
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
      <div dir="rtl" className="flex flex-wrap justify-center gap-4 rounded-2xl border-2 border-border bg-white px-6 py-5">
        {stavke.map((s, i) => (
          <button key={`${s.zapis}-${i}`} type="button" onClick={() => pustiZapis(s.zapis)}
            className="hover:text-teal-700 transition-colors">
            <Zapis tekst={s.zapis} velicina="text-4xl" />
          </button>
        ))}
      </div>
    </div>
  );
}

function Vjezba({ v }: { v: VjezbaCitanja }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-muted/20 p-5 flex flex-col gap-5">
      <h3 className="font-extrabold text-lg text-center">{v.naslov}</h3>
      {v.vrsta === "slusaj-klikni" && <SlusajKlikni stavke={v.stavke} />}
      {v.vrsta === "kratko-dugo" && <KratkoDugo stavke={v.stavke} />}
      {v.vrsta === "voz-slogova" && <VozSlogova stavke={v.stavke} />}
      {v.vrsta === "citaj-rijeci" && <CitajRijeci stavke={v.stavke} />}
      {v.vrsta === "brzina" && <Brzina stavke={v.stavke} sekundi={v.sekundi} />}
    </section>
  );
}

function Akordion({ naslov, children }: { naslov: string; children: React.ReactNode }) {
  const [otvoren, setOtvoren] = useState(false);
  return (
    <div className="rounded-2xl border border-border/60 bg-white overflow-hidden">
      <button type="button" onClick={() => setOtvoren((o) => !o)}
        className="w-full text-left px-5 py-4 font-extrabold uppercase tracking-wide text-sm hover:bg-muted/40 flex items-center justify-between gap-3">
        {naslov}
        <span className="text-muted-foreground text-lg leading-none">{otvoren ? "−" : "+"}</span>
      </button>
      {otvoren && <div className="px-5 pb-5 flex flex-col gap-4">{children}</div>}
    </div>
  );
}

export default function CitanjeLekcijaPage() {
  const { broj } = useParams<{ broj: string }>();
  const lekcija = lekcijaPoBroju(Number(broj));
  const program = PROGRAM_CITANJA.find((l) => l.broj === Number(broj));
  const [prikaz, setPrikaz] = useState<"dijete" | "muallim">("dijete");

  useEffect(() => () => zaustaviZvuk(), []);

  const kuranske = useMemo(
    () => RIJECI_CITANJA.filter((r) => r.lekcija === Number(broj) && r.kuran),
    [broj],
  );

  if (!lekcija || !program) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
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
        <div className="flex flex-col gap-5">
          {!lekcija.imaZvuk && (
            <p className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <VolumeX className="w-5 h-5 shrink-0 mt-0.5" />
              <span>Snimci za ovu lekciju još nisu napravljeni. Do tada muallim izgovara
              umjesto zvučnika — sve ostalo u vježbama radi.</span>
            </p>
          )}
          {lekcija.vjezbe.map((v) => <Vjezba key={v.naslov} v={v} />)}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Akordion naslov="1 — Priča">
            <p className="text-sm text-muted-foreground">Pročitati naglas. Uz svaki glas napraviti pokret.</p>
            <div className="flex flex-col gap-2">
              {lekcija.prica.map((r, i) => (
                <div key={i} className={`rounded-xl px-4 py-3 ${LIKOVI[r.ko].boja}`}>
                  {LIKOVI[r.ko].ime && <span className="font-bold">{LIKOVI[r.ko].ime}: </span>}
                  {r.tekst}
                </div>
              ))}
            </div>
            <p className="rounded-xl bg-[#fff9c4] text-neutral-900 px-4 py-3">{lekcija.pokret}</p>
          </Akordion>

          <Akordion naslov="2 — Vježbamo čitanje">
            {lekcija.vjezbe.map((v) => (
              <div key={v.naslov} className="flex flex-col gap-2">
                <div className="font-bold">{v.naslov}</div>
                <p className="rounded-xl bg-[#fff9c4] text-neutral-900 px-4 py-3">{v.uputa}</p>
                <div dir="rtl" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-2xl">
                  {v.stavke.map((s) => s.zapis).join("   ")}
                </div>
              </div>
            ))}
          </Akordion>

          <Akordion naslov="3 — Riječi iz Kur'ana">
            {kuranske.length ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Ove riječi dijete već može pročitati, a javljaju se u Kur'anu. Ne prevoditi —
                  cilj je čitanje.
                </p>
                <div dir="rtl" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 flex flex-wrap gap-5">
                  {kuranske.map((r) => (
                    <button key={r.zapis} type="button" onClick={() => pustiZapis(r.zapis)} className="text-3xl">
                      {r.zapis}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">U ovoj lekciji još nema kur'anskih riječi.</p>
            )}
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
