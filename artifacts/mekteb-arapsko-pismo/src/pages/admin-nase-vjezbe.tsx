import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/language";
import {
  Loader2, Plus, Save, Trash2, Eye, Copy, ArrowLeft,
  PencilRuler, Grid3x3, TextCursorInput, ListOrdered, Columns3, ArrowLeftRight, Keyboard, AlertTriangle,
} from "lucide-react";

/**
 * Uređivač naših vježbi (osmosmjerka, popuni prazninu, poredak, razvrstaj,
 * spoji parove, upiši odgovor) u admin panelu.
 *
 * Vježbe napravljene ovdje čuvaju se u bazi (`nase_vjezbe`) i odmah su
 * dostupne u lekciji, bez deploya. Ugrađene vježbe (JSON datoteke uz kod)
 * prikazuju se u istom spisku; kad ih admin izmijeni, izmjena se upiše u bazu
 * i od tada prekriva ugrađenu verziju. Brisanje vraća ugrađenu verziju.
 */

interface VjezbaSazetak {
  tip: string;
  id: string;
  naslov: string;
  detalj: string;
  izvor: "ugradjena" | "vlastita";
  url: string;
  updatedAt?: string | null;
}

interface TipVjezbe {
  tip: string;
  naziv: string;
  opis: string;
  vjezbe: VjezbaSazetak[];
}

interface OsmosmjerkaRijec { rijec: string; opis: string }

/** Jedna kutija u vježbi „Razvrstaj"; stavke su tekst, jedna po redu. */
interface Kutija { naziv: string; stavke: string }

/** Jedan par u vježbi „Spoji parove". */
interface Par { lijevo: string; desno: string }

/** Jedno pitanje u vježbi „Upiši odgovor". */
interface Pitanje { pitanje: string; odgovor: string; prihvati: string; pomoc: string }

interface Nacrt {
  tip: string;
  id: string;
  noviUnos: boolean;
  naslov: string;
  uputa: string;
  // osmosmjerka
  velicina: number;
  tezina: "lako" | "srednje" | "tesko";
  prikaz: "rijeci" | "opisi";
  dvoslovi: boolean;
  rijeci: OsmosmjerkaRijec[];
  // popuni prazninu
  tekst: string;
  dodatne: string;
  // poredak — jedna stavka po redu, tačnim redoslijedom
  stavke: string;
  // razvrstaj — od dvije do pet kutija
  kutije: Kutija[];
  // spoji parove
  parovi: Par[];
  // upiši odgovor
  pitanjaZaUpis: Pitanje[];
  /**
   * Njemački i engleski prijevod sadržaja vježbe. Ne uređuje se u ovoj formi,
   * ali se nosi kroz nacrt da ga spremanje ne bi obrisalo.
   */
  prijevodi?: unknown;
}

const PRAZAN_NACRT: Omit<Nacrt, "tip" | "id" | "noviUnos"> = {
  naslov: "",
  uputa: "",
  velicina: 10,
  tezina: "srednje",
  prikaz: "rijeci",
  dvoslovi: true,
  rijeci: [{ rijec: "", opis: "" }, { rijec: "", opis: "" }],
  tekst: "",
  dodatne: "",
  stavke: "",
  kutije: [{ naziv: "", stavke: "" }, { naziv: "", stavke: "" }],
  parovi: [{ lijevo: "", desno: "" }, { lijevo: "", desno: "" }],
  pitanjaZaUpis: [{ pitanje: "", odgovor: "", prihvati: "", pomoc: "" }],
};

/** Oznaka vježbe iz naslova: „Dan u ramazanu" → „dan-u-ramazanu". */
function oznakaIzNaslova(naslov: string): string {
  return naslov
    .toLocaleLowerCase("bs")
    .replace(/[čć]/g, "c").replace(/đ/g, "d").replace(/š/g, "s").replace(/ž/g, "z")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function brojPraznina(tekst: string): number {
  return (tekst.match(/\{[^{}]+\}/g) ?? []).length;
}

function nacrtIzPodataka(tip: string, id: string, podaci: Record<string, unknown>): Nacrt {
  const rijeci = Array.isArray(podaci.rijeci)
    ? podaci.rijeci.map(w => (typeof w === "string"
      ? { rijec: w, opis: "" }
      : { rijec: String((w as Record<string, unknown>)?.rijec ?? ""), opis: String((w as Record<string, unknown>)?.opis ?? "") }))
    : [];
  return {
    tip,
    id,
    noviUnos: false,
    naslov: String(podaci.naslov ?? ""),
    uputa: String(podaci.uputa ?? ""),
    prijevodi: podaci.prijevodi,
    velicina: Number(podaci.velicina ?? 10) || 10,
    tezina: (["lako", "srednje", "tesko"].includes(String(podaci.tezina)) ? String(podaci.tezina) : "srednje") as Nacrt["tezina"],
    prikaz: (String(podaci.prikaz) === "opisi" ? "opisi" : "rijeci") as Nacrt["prikaz"],
    dvoslovi: podaci.dvoslovi !== false,
    rijeci: rijeci.length ? rijeci : [{ rijec: "", opis: "" }, { rijec: "", opis: "" }],
    tekst: String(podaci.tekst ?? ""),
    dodatne: Array.isArray(podaci.dodatne) ? podaci.dodatne.join(", ") : "",
    stavke: Array.isArray(podaci.stavke) ? podaci.stavke.map(s => String(s)).join("\n") : "",
    kutije: Array.isArray(podaci.kategorije) && podaci.kategorije.length
      ? podaci.kategorije.map(k => {
        const kat = (k ?? {}) as Record<string, unknown>;
        return {
          naziv: String(kat.naziv ?? ""),
          stavke: Array.isArray(kat.stavke) ? kat.stavke.map(s => String(s)).join("\n") : "",
        };
      })
      : [{ naziv: "", stavke: "" }, { naziv: "", stavke: "" }],
    parovi: Array.isArray(podaci.parovi) && podaci.parovi.length
      ? podaci.parovi.map(p => {
        const par = (p ?? {}) as Record<string, unknown>;
        return { lijevo: String(par.lijevo ?? ""), desno: String(par.desno ?? "") };
      })
      : [{ lijevo: "", desno: "" }, { lijevo: "", desno: "" }],
    pitanjaZaUpis: Array.isArray(podaci.pitanja) && podaci.pitanja.length
      ? podaci.pitanja.map(p => {
        const red = (p ?? {}) as Record<string, unknown>;
        return {
          pitanje: String(red.pitanje ?? ""),
          odgovor: String(red.odgovor ?? ""),
          prihvati: Array.isArray(red.prihvati) ? red.prihvati.map(s => String(s)).join(", ") : "",
          pomoc: String(red.pomoc ?? ""),
        };
      })
      : [{ pitanje: "", odgovor: "", prihvati: "", pomoc: "" }],
  };
}

/** Stavke poretka: jedna po redu, prazni redovi se preskaču. */
function stavkeIzTeksta(tekst: string): string[] {
  return tekst.split("\n").map(s => s.trim()).filter(Boolean);
}

function podaciIzNacrta(n: Nacrt): Record<string, unknown> {
  const polja = poljaIzNacrta(n);
  return n.prijevodi ? { ...polja, prijevodi: n.prijevodi } : polja;
}

function poljaIzNacrta(n: Nacrt): Record<string, unknown> {
  if (n.tip === "osmosmjerka") {
    return {
      id: n.id,
      naslov: n.naslov.trim(),
      uputa: n.uputa.trim() || undefined,
      velicina: n.velicina,
      tezina: n.tezina,
      prikaz: n.prikaz,
      dvoslovi: n.dvoslovi,
      rijeci: n.rijeci
        .filter(r => r.rijec.trim())
        .map(r => ({ rijec: r.rijec.trim(), opis: r.opis.trim() })),
    };
  }
  if (n.tip === "poredak") {
    return {
      id: n.id,
      naslov: n.naslov.trim(),
      uputa: n.uputa.trim() || undefined,
      stavke: stavkeIzTeksta(n.stavke),
    };
  }
  if (n.tip === "upisi") {
    return {
      id: n.id,
      naslov: n.naslov.trim(),
      uputa: n.uputa.trim() || undefined,
      pitanja: n.pitanjaZaUpis
        .filter(p => p.pitanje.trim() && p.odgovor.trim())
        .map(p => {
          const red: Record<string, unknown> = { pitanje: p.pitanje.trim(), odgovor: p.odgovor.trim() };
          const drugi = p.prihvati.split(",").map(x => x.trim()).filter(Boolean);
          if (drugi.length) red.prihvati = drugi;
          if (p.pomoc.trim()) red.pomoc = p.pomoc.trim();
          return red;
        }),
    };
  }
  if (n.tip === "spoji") {
    return {
      id: n.id,
      naslov: n.naslov.trim(),
      uputa: n.uputa.trim() || undefined,
      parovi: n.parovi
        .filter(p => p.lijevo.trim() && p.desno.trim())
        .map(p => ({ lijevo: p.lijevo.trim(), desno: p.desno.trim() })),
    };
  }
  if (n.tip === "razvrstaj") {
    return {
      id: n.id,
      naslov: n.naslov.trim(),
      uputa: n.uputa.trim() || undefined,
      kategorije: n.kutije
        .filter(k => k.naziv.trim() || k.stavke.trim())
        .map(k => ({ naziv: k.naziv.trim(), stavke: stavkeIzTeksta(k.stavke) })),
    };
  }
  return {
    id: n.id,
    naslov: n.naslov.trim(),
    uputa: n.uputa.trim() || undefined,
    tekst: n.tekst,
    dodatne: n.dodatne.split(",").map(d => d.trim()).filter(Boolean),
  };
}

/** Ikona uz vrstu vježbe u spisku i u formi. */
function IkonaVrste({ tip, className }: { tip: string; className?: string }) {
  if (tip === "osmosmjerka") return <Grid3x3 className={className} />;
  if (tip === "poredak") return <ListOrdered className={className} />;
  if (tip === "razvrstaj") return <Columns3 className={className} />;
  if (tip === "spoji") return <ArrowLeftRight className={className} />;
  if (tip === "upisi") return <Keyboard className={className} />;
  return <TextCursorInput className={className} />;
}

export default function AdminNaseVjezbe() {
  const { token } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [tipovi, setTipovi] = useState<TipVjezbe[]>([]);
  const [ucitavam, setUcitavam] = useState(true);
  const [nacrt, setNacrt] = useState<Nacrt | null>(null);
  const [spremam, setSpremam] = useState(false);
  const [brisem, setBrisem] = useState(false);
  const [pregledKljuc, setPregledKljuc] = useState(0);
  const [spremljenUrl, setSpremljenUrl] = useState<string | null>(null);
  const tekstRef = useRef<HTMLTextAreaElement>(null);

  const ucitajSpisak = useCallback(async () => {
    if (!token) return;
    setUcitavam(true);
    try {
      const res = await apiRequest<{ tipovi: TipVjezbe[] }>("GET", "/nase-vjezbe", undefined, token);
      setTipovi(res.tipovi || []);
    } catch {
      toast({ title: t("Greška"), description: t("Nije moguće učitati spisak vježbi"), variant: "destructive" });
    } finally {
      setUcitavam(false);
    }
  }, [token, t, toast]);

  useEffect(() => { void ucitajSpisak(); }, [ucitajSpisak]);

  const tipInfo = useMemo(
    () => (nacrt ? tipovi.find(x => x.tip === nacrt.tip) : undefined),
    [tipovi, nacrt],
  );

  const novaVjezba = (tip: string) => {
    setSpremljenUrl(null);
    setNacrt({ ...PRAZAN_NACRT, tip, id: "", noviUnos: true, rijeci: [{ rijec: "", opis: "" }, { rijec: "", opis: "" }] });
  };

  const otvori = async (stavka: VjezbaSazetak, kaoKopiju = false) => {
    if (!token) return;
    try {
      const res = await apiRequest<{ podaci: Record<string, unknown> }>(
        "GET", `/nase-vjezbe/${stavka.tip}/${stavka.id}`, undefined, token,
      );
      const osnova = nacrtIzPodataka(stavka.tip, kaoKopiju ? "" : stavka.id, res.podaci);
      setSpremljenUrl(kaoKopiju ? null : stavka.url);
      setNacrt(kaoKopiju
        ? { ...osnova, id: "", noviUnos: true, naslov: `${osnova.naslov} (kopija)` }
        : osnova);
    } catch (e) {
      toast({ title: t("Greška"), description: (e as Error).message, variant: "destructive" });
    }
  };

  const spremi = async () => {
    if (!nacrt || !token) return;
    const id = (nacrt.id || oznakaIzNaslova(nacrt.naslov)).trim();
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) {
      toast({
        title: t("Greška"),
        description: t("Oznaka vježbe smije imati samo mala slova, cifre i crticu (npr. bajram-01)."),
        variant: "destructive",
      });
      return;
    }
    setSpremam(true);
    try {
      const podaci = podaciIzNacrta({ ...nacrt, id });
      const spremljeno = nacrt.noviUnos
        ? await apiRequest<VjezbaSazetak>("POST", `/nase-vjezbe/${nacrt.tip}`, { vjezbaId: id, podaci }, token)
        : await apiRequest<VjezbaSazetak>("PUT", `/nase-vjezbe/${nacrt.tip}/${id}`, { podaci }, token);
      toast({ title: t("Sačuvano"), description: spremljeno.naslov });
      setNacrt({ ...nacrt, id, noviUnos: false });
      setSpremljenUrl(spremljeno.url);
      setPregledKljuc(k => k + 1);
      void ucitajSpisak();
    } catch (e) {
      toast({ title: t("Nije sačuvano"), description: (e as Error).message, variant: "destructive" });
    } finally {
      setSpremam(false);
    }
  };

  const obrisi = async (stavka: VjezbaSazetak) => {
    if (!token) return;
    const pitanje = stavka.izvor === "vlastita"
      ? t('Obrisati vježbu "{naslov}"? Lekcije u kojima je već dodana ostaju, ali vježba se više neće otvarati.', { naslov: stavka.naslov })
      : t('Vratiti "{naslov}" na ugrađenu verziju?', { naslov: stavka.naslov });
    if (!window.confirm(pitanje)) return;
    setBrisem(true);
    try {
      const res = await apiRequest<{ vraceneNaUgradjenu: boolean; tipovi: TipVjezbe[] }>(
        "DELETE", `/nase-vjezbe/${stavka.tip}/${stavka.id}`, undefined, token,
      );
      setTipovi(res.tipovi || []);
      if (nacrt && nacrt.tip === stavka.tip && nacrt.id === stavka.id) setNacrt(null);
      toast({
        title: res.vraceneNaUgradjenu ? t("Vraćeno na ugrađenu verziju") : t("Obrisano"),
        description: stavka.naslov,
      });
    } catch (e) {
      toast({ title: t("Greška"), description: (e as Error).message, variant: "destructive" });
    } finally {
      setBrisem(false);
    }
  };

  /** Označi izabranu riječ u priči kao prazninu (ili skini oznaku). */
  const oznaciPrazninu = () => {
    const el = tekstRef.current;
    if (!el || !nacrt) return;
    const { selectionStart: od, selectionEnd: doo, value } = el;
    if (od === doo) {
      toast({ title: t("Označi riječ"), description: t("Prvo mišem označi riječ u priči, pa klikni ovo dugme.") });
      return;
    }
    const izabrano = value.slice(od, doo).trim();
    if (!izabrano) return;
    const vecPraznina = value.slice(od - 1, doo + 1) === `{${izabrano}}`;
    const noviTekst = vecPraznina
      ? value.slice(0, od - 1) + izabrano + value.slice(doo + 1)
      : value.slice(0, od) + `{${izabrano}}` + value.slice(doo);
    setNacrt({ ...nacrt, tekst: noviTekst });
    requestAnimationFrame(() => {
      el.focus();
      const pomak = vecPraznina ? -1 : 1;
      el.setSelectionRange(od + pomak, doo + pomak);
    });
  };

  if (ucitavam && tipovi.length === 0) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-teal-500" /></div>;
  }

  // ── Spisak ────────────────────────────────────────────────────────────────
  if (!nacrt) {
    return (
      <div className="flex flex-col gap-8">
        {tipovi.map(tv => (
          <section key={tv.tip}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-teal-100 flex items-center justify-center">
                  <IkonaVrste tip={tv.tip} className="w-5 h-5 text-teal-700" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-foreground">{tv.naziv}</h2>
                  <p className="text-sm text-muted-foreground">{tv.opis}</p>
                </div>
              </div>
              <button
                onClick={() => novaVjezba(tv.tip)}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-2.5 min-h-11"
                data-testid={`nova-vjezba-${tv.tip}`}
              >
                <Plus className="w-4 h-4" /> {t("Nova vježba")}
              </button>
            </div>

            {tv.vjezbe.length === 0 ? (
              <p className="text-muted-foreground bg-white border border-border/50 rounded-2xl p-6">
                {t("Još nema nijedne vježbe ove vrste.")}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tv.vjezbe.map(v => (
                  <div key={`${v.tip}-${v.id}`} className="bg-white border border-border/60 rounded-2xl p-4 flex flex-col gap-3">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-lg leading-tight">{v.naslov}</h3>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                          v.izvor === "vlastita"
                            ? "bg-teal-100 text-teal-800"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {v.izvor === "vlastita" ? t("moja") : t("ugrađena")}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{v.detalj}</p>
                      <p className="text-xs text-muted-foreground/80 mt-1 font-mono">{v.id}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-auto">
                      <button
                        onClick={() => otvori(v)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 min-h-10 text-sm font-bold hover:bg-muted"
                      >
                        <PencilRuler className="w-4 h-4" /> {t("Uredi")}
                      </button>
                      <button
                        onClick={() => otvori(v, true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 min-h-10 text-sm font-bold hover:bg-muted"
                        title={t("Napravi kopiju i uredi je")}
                      >
                        <Copy className="w-4 h-4" /> {t("Kopiraj")}
                      </button>
                      <a
                        href={v.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 min-h-10 text-sm font-bold hover:bg-muted"
                      >
                        <Eye className="w-4 h-4" /> {t("Pogledaj")}
                      </a>
                      {v.izvor === "vlastita" && (
                        <button
                          onClick={() => obrisi(v)}
                          disabled={brisem}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 text-red-600 px-3 py-2 min-h-10 text-sm font-bold hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" /> {t("Obriši")}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    );
  }

  // ── Uređivač ──────────────────────────────────────────────────────────────
  const idZaPrikaz = nacrt.id || oznakaIzNaslova(nacrt.naslov);
  const praznina = brojPraznina(nacrt.tekst);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => setNacrt(null)}
          className="inline-flex items-center gap-2 text-teal-700 font-bold min-h-11"
        >
          <ArrowLeft className="w-4 h-4" /> {t("Nazad na spisak")}
        </button>
        <div className="flex gap-2">
          <button
            onClick={spremi}
            disabled={spremam || !nacrt.naslov.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold px-5 py-2.5 min-h-11"
            data-testid="spremi-vjezbu"
          >
            {spremam ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t("Sačuvaj")}
          </button>
        </div>
      </div>

      <div className="bg-white border border-border/60 rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2 text-sm font-bold text-teal-800">
          <IkonaVrste tip={nacrt.tip} className="w-4 h-4" />
          {tipInfo?.naziv ?? nacrt.tip}
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold">{t("Naslov")}</span>
          <input
            value={nacrt.naslov}
            onChange={e => setNacrt({ ...nacrt, naslov: e.target.value })}
            placeholder={t("npr. Ramazan")}
            className="px-3 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-teal-400"
            data-testid="polje-naslov"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold">{t("Uputa djetetu")} <span className="font-normal text-muted-foreground">({t("nije obavezno")})</span></span>
          <input
            value={nacrt.uputa}
            onChange={e => setNacrt({ ...nacrt, uputa: e.target.value })}
            className="px-3 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold">{t("Oznaka (u adresi)")}</span>
          <input
            value={nacrt.id}
            onChange={e => setNacrt({ ...nacrt, id: e.target.value })}
            disabled={!nacrt.noviUnos}
            placeholder={idZaPrikaz || "npr. bajram-01"}
            className="px-3 py-2.5 rounded-xl border border-border font-mono text-sm disabled:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-teal-400"
            data-testid="polje-oznaka"
          />
          <span className="text-xs text-muted-foreground">
            {nacrt.noviUnos
              ? t("Ostavi prazno pa se napravi iz naslova. Mala slova, cifre i crtica.")
              : t("Oznaka se ne mijenja poslije čuvanja — lekcije koje koriste vježbu pokazuju na nju.")}
          </span>
        </label>

        {nacrt.tip === "osmosmjerka" ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-bold">{t("Težina")}</span>
                <select
                  value={nacrt.tezina}
                  onChange={e => setNacrt({ ...nacrt, tezina: e.target.value as Nacrt["tezina"] })}
                  className="px-3 py-2.5 rounded-xl border border-border bg-white min-h-11"
                >
                  <option value="lako">{t("Lako — desno i dolje")}</option>
                  <option value="srednje">{t("Srednje — i ukoso")}</option>
                  <option value="tesko">{t("Teško — svih osam smjerova")}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-bold">{t("Na spisku prikaži")}</span>
                <select
                  value={nacrt.prikaz}
                  onChange={e => setNacrt({ ...nacrt, prikaz: e.target.value as Nacrt["prikaz"] })}
                  className="px-3 py-2.5 rounded-xl border border-border bg-white min-h-11"
                >
                  <option value="rijeci">{t("Riječi")}</option>
                  <option value="opisi">{t("Opise (dijete pogađa riječ)")}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-bold">{t("Veličina mreže")}</span>
                <input
                  type="number"
                  min={8}
                  max={14}
                  value={nacrt.velicina}
                  onChange={e => setNacrt({ ...nacrt, velicina: Number(e.target.value) || 10 })}
                  className="px-3 py-2.5 rounded-xl border border-border min-h-11"
                />
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={nacrt.dvoslovi}
                onChange={e => setNacrt({ ...nacrt, dvoslovi: e.target.checked })}
                className="w-4 h-4"
              />
              {t("DŽ, LJ i NJ stoje u jednom polju")}
            </label>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-bold">
                {t("Riječi")} <span className="font-normal text-muted-foreground">({nacrt.rijeci.filter(r => r.rijec.trim()).length})</span>
              </span>
              {nacrt.prikaz === "opisi" && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {t("Dijete vidi opise, pa svaka riječ mora imati opis.")}
                </p>
              )}
              {nacrt.rijeci.map((r, i) => (
                <div key={i} className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={r.rijec}
                    onChange={e => {
                      const rijeci = [...nacrt.rijeci];
                      rijeci[i] = { ...rijeci[i], rijec: e.target.value };
                      setNacrt({ ...nacrt, rijeci });
                    }}
                    placeholder={t("riječ")}
                    className="sm:w-52 px-3 py-2.5 rounded-xl border border-border min-h-11"
                    data-testid={`rijec-${i}`}
                  />
                  <input
                    value={r.opis}
                    onChange={e => {
                      const rijeci = [...nacrt.rijeci];
                      rijeci[i] = { ...rijeci[i], opis: e.target.value };
                      setNacrt({ ...nacrt, rijeci });
                    }}
                    placeholder={t("opis (za pogađanje)")}
                    className="flex-1 px-3 py-2.5 rounded-xl border border-border min-h-11"
                  />
                  <button
                    onClick={() => setNacrt({ ...nacrt, rijeci: nacrt.rijeci.filter((_, k) => k !== i) })}
                    className="sm:w-11 min-h-11 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 flex items-center justify-center"
                    aria-label={t("Obriši riječ")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setNacrt({ ...nacrt, rijeci: [...nacrt.rijeci, { rijec: "", opis: "" }] })}
                className="self-start inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 min-h-11 font-bold hover:bg-muted"
                data-testid="dodaj-rijec"
              >
                <Plus className="w-4 h-4" /> {t("Dodaj riječ")}
              </button>
            </div>
          </>
        ) : nacrt.tip === "upisi" ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold">{t("Pitanja")}</span>
              <span className="text-sm text-muted-foreground">
                {t("Pitanja:")}{" "}
                <strong>{nacrt.pitanjaZaUpis.filter(p => p.pitanje.trim() && p.odgovor.trim()).length}</strong>
              </span>
            </div>
            {nacrt.pitanjaZaUpis.map((p, i) => (
              <div key={i} className="rounded-2xl border border-border p-3 flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    value={p.pitanje}
                    onChange={e => {
                      const red = [...nacrt.pitanjaZaUpis];
                      red[i] = { ...red[i], pitanje: e.target.value };
                      setNacrt({ ...nacrt, pitanjaZaUpis: red });
                    }}
                    placeholder={t("pitanje, npr. Kako se zove poziv na namaz?")}
                    className="flex-1 px-3 py-2.5 rounded-xl border border-border min-h-11 font-bold"
                    data-testid={`pitanje-${i}`}
                  />
                  <button
                    onClick={() => setNacrt({ ...nacrt, pitanjaZaUpis: nacrt.pitanjaZaUpis.filter((_, x) => x !== i) })}
                    disabled={nacrt.pitanjaZaUpis.length <= 1}
                    className="w-11 min-h-11 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-transparent flex items-center justify-center"
                    aria-label={t("Obriši pitanje")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    value={p.odgovor}
                    onChange={e => {
                      const red = [...nacrt.pitanjaZaUpis];
                      red[i] = { ...red[i], odgovor: e.target.value };
                      setNacrt({ ...nacrt, pitanjaZaUpis: red });
                    }}
                    placeholder={t("tačan odgovor")}
                    className="px-3 py-2.5 rounded-xl border border-border min-h-11"
                    data-testid={`odgovor-${i}`}
                  />
                  <input
                    value={p.prihvati}
                    onChange={e => {
                      const red = [...nacrt.pitanjaZaUpis];
                      red[i] = { ...red[i], prihvati: e.target.value };
                      setNacrt({ ...nacrt, pitanjaZaUpis: red });
                    }}
                    placeholder={t("drugi prihvaćeni odgovori (zarezom)")}
                    className="px-3 py-2.5 rounded-xl border border-border min-h-11"
                    data-testid={`prihvati-${i}`}
                  />
                </div>
                <input
                  value={p.pomoc}
                  onChange={e => {
                    const red = [...nacrt.pitanjaZaUpis];
                    red[i] = { ...red[i], pomoc: e.target.value };
                    setNacrt({ ...nacrt, pitanjaZaUpis: red });
                  }}
                  placeholder={t("kratka pomoć uz pitanje (nije obavezno)")}
                  className="px-3 py-2.5 rounded-xl border border-border min-h-11"
                  data-testid={`pomoc-${i}`}
                />
              </div>
            ))}
            <button
              onClick={() => setNacrt({
                ...nacrt,
                pitanjaZaUpis: [...nacrt.pitanjaZaUpis, { pitanje: "", odgovor: "", prihvati: "", pomoc: "" }],
              })}
              disabled={nacrt.pitanjaZaUpis.length >= 20}
              className="self-start inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 min-h-11 font-bold hover:bg-muted disabled:opacity-40"
              data-testid="dodaj-pitanje"
            >
              <Plus className="w-4 h-4" /> {t("Dodaj pitanje")}
            </button>
            <p className="text-xs text-muted-foreground">
              {t("Odgovor se priznaje bez obzira na velika i mala slova, razmake i tačku na kraju. Ako dijete napiše sve tačno osim kvačica, odgovor se priznaje uz napomenu kako se riječ piše.")}
            </p>
          </div>
        ) : nacrt.tip === "spoji" ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold">{t("Parovi")}</span>
              <span className="text-sm text-muted-foreground">
                {t("Parova:")}{" "}
                <strong>{nacrt.parovi.filter(p => p.lijevo.trim() && p.desno.trim()).length}</strong>
              </span>
            </div>
            {nacrt.parovi.map((p, i) => (
              <div key={i} className="flex flex-col sm:flex-row gap-2">
                <input
                  value={p.lijevo}
                  onChange={e => {
                    const parovi = [...nacrt.parovi];
                    parovi[i] = { ...parovi[i], lijevo: e.target.value };
                    setNacrt({ ...nacrt, parovi });
                  }}
                  placeholder={t("pojam (npr. ezan)")}
                  className="sm:w-52 px-3 py-2.5 rounded-xl border border-border min-h-11 font-bold"
                  data-testid={`par-lijevo-${i}`}
                />
                <input
                  value={p.desno}
                  onChange={e => {
                    const parovi = [...nacrt.parovi];
                    parovi[i] = { ...parovi[i], desno: e.target.value };
                    setNacrt({ ...nacrt, parovi });
                  }}
                  placeholder={t("odgovor (npr. poziv na namaz)")}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-border min-h-11"
                  data-testid={`par-desno-${i}`}
                />
                <button
                  onClick={() => setNacrt({ ...nacrt, parovi: nacrt.parovi.filter((_, x) => x !== i) })}
                  disabled={nacrt.parovi.length <= 2}
                  className="sm:w-11 min-h-11 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-transparent flex items-center justify-center"
                  aria-label={t("Obriši par")}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => setNacrt({ ...nacrt, parovi: [...nacrt.parovi, { lijevo: "", desno: "" }] })}
              disabled={nacrt.parovi.length >= 12}
              className="self-start inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 min-h-11 font-bold hover:bg-muted disabled:opacity-40"
              data-testid="dodaj-par"
            >
              <Plus className="w-4 h-4" /> {t("Dodaj par")}
            </button>
            <p className="text-xs text-muted-foreground">
              {t("Od dva do dvanaest parova. Lijevo pojam, desno njegovo značenje. Vježba pomiješa odgovore pred djetetom; isti pojam ili isti odgovor ne smiju se ponavljati.")}
            </p>
          </div>
        ) : nacrt.tip === "razvrstaj" ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold">{t("Kutije")}</span>
              <span className="text-sm text-muted-foreground">
                {t("Stavki ukupno:")}{" "}
                <strong>{nacrt.kutije.reduce((zbir, k) => zbir + stavkeIzTeksta(k.stavke).length, 0)}</strong>
              </span>
            </div>
            {nacrt.kutije.map((k, i) => (
              <div key={i} className="rounded-2xl border border-border p-3 flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    value={k.naziv}
                    onChange={e => {
                      const kutije = [...nacrt.kutije];
                      kutije[i] = { ...kutije[i], naziv: e.target.value };
                      setNacrt({ ...nacrt, kutije });
                    }}
                    placeholder={t("naziv kutije, npr. Hidžretski mjeseci")}
                    className="flex-1 px-3 py-2.5 rounded-xl border border-border min-h-11 font-bold"
                    data-testid={`kutija-naziv-${i}`}
                  />
                  <button
                    onClick={() => setNacrt({ ...nacrt, kutije: nacrt.kutije.filter((_, x) => x !== i) })}
                    disabled={nacrt.kutije.length <= 2}
                    className="w-11 min-h-11 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-transparent flex items-center justify-center"
                    aria-label={t("Obriši kutiju")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <textarea
                  value={k.stavke}
                  onChange={e => {
                    const kutije = [...nacrt.kutije];
                    kutije[i] = { ...kutije[i], stavke: e.target.value };
                    setNacrt({ ...nacrt, kutije });
                  }}
                  rows={5}
                  placeholder={"muharrem\nsafer\nramazan"}
                  className="px-3 py-2.5 rounded-xl border border-border font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-400"
                  data-testid={`kutija-stavke-${i}`}
                />
                <span className="text-xs text-muted-foreground">
                  {t("Stavki u ovoj kutiji:")} <strong>{stavkeIzTeksta(k.stavke).length}</strong>
                </span>
              </div>
            ))}
            <button
              onClick={() => setNacrt({ ...nacrt, kutije: [...nacrt.kutije, { naziv: "", stavke: "" }] })}
              disabled={nacrt.kutije.length >= 5}
              className="self-start inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 min-h-11 font-bold hover:bg-muted disabled:opacity-40"
              data-testid="dodaj-kutiju"
            >
              <Plus className="w-4 h-4" /> {t("Dodaj kutiju")}
            </button>
            <p className="text-xs text-muted-foreground">
              {t("Od dvije do pet kutija, u svakoj jedna stavka po redu. Ista stavka ne smije stajati u dvije kutije. Vježba sve stavke izmiješa i ponudi djetetu.")}
            </p>
          </div>
        ) : nacrt.tip === "poredak" ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold">{t("Stavke, tačnim redoslijedom")}</span>
              <span className="text-sm text-muted-foreground">
                {t("Stavki:")} <strong>{stavkeIzTeksta(nacrt.stavke).length}</strong>
              </span>
            </div>
            <textarea
              value={nacrt.stavke}
              onChange={e => setNacrt({ ...nacrt, stavke: e.target.value })}
              rows={12}
              placeholder={"Prouči Bismillu\nOperi šake tri puta\nIsperi usta tri puta"}
              className="px-3 py-2.5 rounded-xl border border-border font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-400"
              data-testid="polje-stavke"
            />
            <p className="text-xs text-muted-foreground">
              {t("Jedna stavka po redu, od prve do zadnje. Vježba ih sama izmiješa pred djetetom. Stavka može biti riječ, izraz ili cijela rečenica; dvije iste stavke nisu dozvoljene.")}
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold">{t("Priča")}</span>
                <span className="text-sm text-muted-foreground">
                  {t("Praznina:")} <strong>{praznina}</strong>
                </span>
              </div>
              <textarea
                ref={tekstRef}
                value={nacrt.tekst}
                onChange={e => setNacrt({ ...nacrt, tekst: e.target.value })}
                rows={12}
                placeholder={t("Prije namaza uzimamo abdest…")}
                className="px-3 py-2.5 rounded-xl border border-border font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-400"
                data-testid="polje-prica"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={oznaciPrazninu}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2.5 min-h-11"
                  data-testid="oznaci-prazninu"
                >
                  {t("Označi riječ kao prazninu")}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("Označi riječ mišem pa klikni dugme — riječ dobije vitičaste zagrade i postaje prazno mjesto. Prazan red pravi novi pasus.")}
              </p>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-bold">
                {t("Dodatne riječi")} <span className="font-normal text-muted-foreground">({t("ne trebaju nigdje; odvoji zarezom")})</span>
              </span>
              <input
                value={nacrt.dodatne}
                onChange={e => setNacrt({ ...nacrt, dodatne: e.target.value })}
                placeholder={t("npr. sanke, lopta")}
                className="px-3 py-2.5 rounded-xl border border-border min-h-11"
              />
            </label>
          </>
        )}
      </div>

      <div className="bg-white border border-border/60 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="font-bold flex items-center gap-2"><Eye className="w-4 h-4" /> {t("Pregled")}</h3>
          {spremljenUrl && (
            <button
              onClick={() => setPregledKljuc(k => k + 1)}
              className="rounded-lg border border-border px-3 py-2 min-h-10 text-sm font-bold hover:bg-muted"
            >
              {t("Osvježi pregled")}
            </button>
          )}
        </div>
        {spremljenUrl ? (
          <iframe
            key={pregledKljuc}
            src={spremljenUrl}
            title={t("Pregled vježbe")}
            className="w-full rounded-xl border border-border"
            style={{ height: 620 }}
          />
        ) : (
          <p className="text-muted-foreground flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {t("Sačuvaj vježbu pa se ovdje prikaže onako kako je vidi dijete.")}
          </p>
        )}
      </div>
    </div>
  );
}
