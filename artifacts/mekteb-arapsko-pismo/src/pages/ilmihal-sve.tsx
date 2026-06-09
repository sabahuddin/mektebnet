import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { apiRequest } from "@/lib/api";
import { ArrowLeft, CheckCircle2, BookOpen, Lock, ChevronDown, Search, X, Filter, Award, Plus } from "lucide-react";

interface Lekcija {
  id: number;
  nivo: number;
  slug: string;
  naslov: string;
  redoslijed?: number;
  zavrseno?: boolean;
  predmet?: string | null;
}

const BEZ_PREDMETA = "__bez__";

const NIVO_INFO: Record<number, { naslov: string; podnaslov: string; bg: string; ring: string }> = {
  1: { naslov: "Mala Košnica",     podnaslov: "Nivo 1", bg: "from-yellow-50 to-yellow-100", ring: "ring-yellow-200" },
  2: { naslov: "Zlatna Košnica",   podnaslov: "Nivo 2", bg: "from-amber-50 to-amber-100",   ring: "ring-amber-200" },
  3: { naslov: "Košnica Mudrosti", podnaslov: "Nivo 3", bg: "from-orange-50 to-orange-100", ring: "ring-orange-200" },
};

export default function IlmihalSvePage() {
  const { token, user } = useAuth();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const isAdmin = user?.role === "admin";
  const [lekcije, setLekcije] = useState<Lekcija[]>([]);
  const [loading, setLoading] = useState(true);
  // Akordion: koji nivoi su otvoreni. Po defaultu SVI ZATVORENI da
  // korisnik ne mora skrolati Nivo 1+2 da bi došao do Nivoa 3.
  const [openNivoi, setOpenNivoi] = useState<Record<number, boolean>>({
    1: false,
    2: false,
    3: false,
  });
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim().toLowerCase();
  // Filter po predmetu (Ahlak, Akaid, Ibadat, ...). "" = svi predmeti.
  // Vrijednosti dolaze iz priprema HTML-a; nove se pojave automatski čim
  // muallim upiše novi predmet u pripremu lekcije.
  const [predmet, setPredmet] = useState<string>("");

  // Gate: ucenik (i nelogovan posjetilac) moze otvoriti samo zavrsene
  // lekcije + prvu sljedecu nezavrsenu. Muallim/admin/roditelj vide sve
  // kao otvoreno (oni pregledaju gradivo, ne uce).
  const enforceProgress = !user || user.role === "ucenik";

  useEffect(() => {
    setLoading(true);
    apiRequest<Lekcija[]>("GET", "/content/ilmihal", undefined, token || undefined)
      .then((data) => setLekcije(Array.isArray(data) ? data : []))
      .catch(() => setLekcije([]))
      .finally(() => setLoading(false));
  }, [token]);

  const groupedByNivo: Record<number, Lekcija[]> = useMemo(() => {
    const g: Record<number, Lekcija[]> = { 1: [], 2: [], 3: [] };
    for (const l of lekcije) {
      if (g[l.nivo]) g[l.nivo].push(l);
    }
    for (const k of Object.keys(g)) {
      const n = Number(k);
      g[n].sort((a, b) => (a.redoslijed ?? a.id) - (b.redoslijed ?? b.id));
    }
    return g;
  }, [lekcije]);

  // Lista jedinstvenih predmeta (sortirana po broju lekcija, najveći prvo).
  // Lekcije bez predmeta dobijaju zasebnu opciju "Bez predmeta" na dnu.
  const predmetiOptions = useMemo(() => {
    const counts = new Map<string, number>();
    let bez = 0;
    for (const l of lekcije) {
      const p = (l.predmet || "").trim();
      if (!p) { bez++; continue; }
      counts.set(p, (counts.get(p) || 0) + 1);
    }
    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "bs"))
      .map(([value, count]) => ({ value, label: value, count }));
    if (bez > 0) sorted.push({ value: BEZ_PREDMETA, label: t("Bez predmeta"), count: bez });
    return sorted;
  }, [lekcije]);

  // Pretraga + filter po predmetu. Kada je bilo koji filter aktivan, otvori
  // sve nivoe koji imaju match (da rezultati budu vidljivi bez ručnog otvaranja).
  const filteredByNivo: Record<number, Lekcija[]> = useMemo(() => {
    const hasQuery = trimmedQuery.length > 0;
    const hasPredmet = predmet.length > 0;
    if (!hasQuery && !hasPredmet) return groupedByNivo;
    const out: Record<number, Lekcija[]> = { 1: [], 2: [], 3: [] };
    for (const n of [1, 2, 3]) {
      out[n] = groupedByNivo[n].filter((l) => {
        if (hasQuery && !l.naslov.toLowerCase().includes(trimmedQuery)) return false;
        if (hasPredmet) {
          const p = (l.predmet || "").trim();
          if (predmet === BEZ_PREDMETA) {
            if (p) return false;
          } else if (p !== predmet) {
            return false;
          }
        }
        return true;
      });
    }
    return out;
  }, [groupedByNivo, trimmedQuery, predmet]);

  const isSearching = trimmedQuery.length > 0 || predmet.length > 0;

  // Admin: kreira novu DODATAK lekciju na kraj akordiona datog nivoa.
  // DODATAK lekcije nisu dio ilmihal-mape/progresije (isključene na serveru
  // po slug-u `dodatak-nivo%`), pa ne kvare brojanje medaljona. Imaju punu
  // strukturu (akordioni, vježbe) — admin ih popunjava u editoru lekcije.
  async function createDodatak(nivo: number) {
    if (!token) return;
    const existing = (groupedByNivo[nivo] || []).filter((l) => l.slug.startsWith(`dodatak-nivo${nivo}-`));
    const nums = existing
      .map((l) => parseInt(l.slug.split("-").pop() || "0", 10))
      .filter((x) => !Number.isNaN(x));
    const n = (nums.length ? Math.max(...nums) : 0) + 1;
    const slug = `dodatak-nivo${nivo}-${n}`;
    const naslov = "DODATAK";
    try {
      await apiRequest(
        "POST",
        "/admin/ilmihal",
        {
          naslov,
          slug,
          nivo,
          redoslijed: 9500 + n,
          contentHtml: `<h1>${naslov}</h1><p>Dodatni sadržaj — popuni akordionima i vježbama.</p>`,
        },
        token,
      );
      setLocation(`/ilmihal/${slug}`);
    } catch {
      // admin može ponoviti pokušaj
    }
  }

  const total = lekcije.length;
  const done = lekcije.filter((l) => l.zavrseno).length;
  const matchCount = isSearching
    ? filteredByNivo[1].length + filteredByNivo[2].length + filteredByNivo[3].length
    : 0;

  const toggleNivo = (n: number) =>
    setOpenNivoi((prev) => ({ ...prev, [n]: !prev[n] }));

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-2 sm:px-4 pb-12">
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/ilmihal"
            className="inline-flex items-center gap-2 text-amber-900 font-bold hover:underline"
            data-testid="link-back-ilmihal"
          >
            <ArrowLeft className="w-5 h-5" />
            {t("Nazad na Lekcije")}
          </Link>
          {token && total > 0 && (
            <div className="text-sm font-bold text-amber-900 bg-white/80 rounded-full px-3 py-1 shadow-sm">
              {done} / {total} {t("završeno")}
            </div>
          )}
        </div>

        <div className="text-center mb-6">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-amber-900 mb-2">
            {t("Spisak svih lekcija")}
          </h1>
          <p className="text-amber-800/80 text-sm sm:text-base">
            {t("Pregledaj sve lekcije po nivoima i otvori bilo koju")}
          </p>
        </div>

        <div className="max-w-2xl mx-auto mb-8 px-1">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-700/70 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("Pretraži lekcije po naslovu…")}
                className="w-full pl-9 pr-9 py-2.5 rounded-full bg-white/90 ring-1 ring-amber-200 focus:ring-2 focus:ring-amber-400 focus:outline-none text-sm sm:text-base text-amber-900 placeholder:text-amber-700/50 shadow-sm"
                data-testid="input-pretraga-lekcija"
                aria-label={t("Pretraga lekcija")}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-amber-100 text-amber-700"
                  aria-label={t("Obriši pretragu")}
                  data-testid="button-obrisi-pretragu"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="relative sm:w-56 flex-shrink-0">
              <Filter
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-700/70 pointer-events-none"
                aria-hidden="true"
              />
              <select
                value={predmet}
                onChange={(e) => setPredmet(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 rounded-full bg-white/90 ring-1 ring-amber-200 focus:ring-2 focus:ring-amber-400 focus:outline-none text-sm sm:text-base text-amber-900 shadow-sm appearance-none cursor-pointer"
                data-testid="select-predmet"
                aria-label={t("Filter po predmetu")}
              >
                <option value="">{t("Svi predmeti")}</option>
                {predmetiOptions.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label} ({p.count})
                  </option>
                ))}
              </select>
              <ChevronDown
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-700/70 pointer-events-none"
                aria-hidden="true"
              />
            </div>
          </div>
          {isSearching && (
            <div className="text-center text-xs text-amber-800/70 mt-2">
              {matchCount === 0
                ? t("Nema lekcija koje odgovaraju pretrazi")
                : t("Pronađeno {n} {rijec}", { n: String(matchCount), rijec: matchCount === 1 ? t("lekcija") : matchCount < 5 ? t("lekcije") : t("lekcija") })}
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center text-amber-800/70 py-10">{t("Učitavanje…")}</div>
        ) : total === 0 ? (
          <div className="text-center text-amber-800/70 py-10">
            {t("Trenutno nema dostupnih lekcija.")}
          </div>
        ) : (
          <div className="space-y-4">
            {[1, 2, 3].map((nivo) => {
              const allItems = groupedByNivo[nivo];
              const items = filteredByNivo[nivo];
              if (!allItems || allItems.length === 0) return null;
              // Pri aktivnoj pretrazi sakrij nivoe bez rezultata.
              if (isSearching && items.length === 0) return null;
              const info = NIVO_INFO[nivo];
              const nivoDone = allItems.filter((l) => l.zavrseno).length;
              // Pri pretrazi: forsiraj otvoren akordion da se rezultati vide.
              const isOpen = isSearching ? true : !!openNivoi[nivo];
              return (
                <section key={nivo} data-testid={`section-nivo-${nivo}`}>
                  <button
                    type="button"
                    onClick={() => !isSearching && toggleNivo(nivo)}
                    aria-expanded={isOpen}
                    aria-controls={`nivo-panel-${nivo}`}
                    className={`w-full flex items-center justify-between gap-3 px-3 sm:px-4 py-3 rounded-2xl bg-gradient-to-br ${info.bg} ring-1 ${info.ring} shadow-sm text-left transition-colors ${
                      isSearching ? "cursor-default" : "hover:brightness-95 active:brightness-90"
                    }`}
                    data-testid={`button-toggle-nivo-${nivo}`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                        {info.podnaslov}
                      </div>
                      <h2 className="text-xl sm:text-2xl font-extrabold text-amber-900 truncate">
                        {info.naslov}
                      </h2>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {token && (
                        <div className="text-xs sm:text-sm font-bold text-amber-800/80">
                          {nivoDone} / {allItems.length}
                        </div>
                      )}
                      {!isSearching && (
                        <ChevronDown
                          className={`w-5 h-5 text-amber-800/80 transition-transform ${
                            isOpen ? "rotate-180" : "rotate-0"
                          }`}
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  </button>

                  {isOpen && (
                  <div
                    id={`nivo-panel-${nivo}`}
                    className={`mt-2 rounded-2xl bg-gradient-to-br ${info.bg} ring-1 ${info.ring} shadow-sm p-2 sm:p-3`}
                  >
                    <ol className="divide-y divide-amber-200/60">
                      {(() => {
                        // Indeks prve nezavrsene lekcije u CIJELOM nivou (ne u
                        // filtriranoj listi) — to je "sljedeca dozvoljena".
                        // Sve poslije nje su locked (samo za ucenika/nelogovanog).
                        // Bitno: pretraga ne smije otključati zaključanu lekciju.
                        const firstUndoneAll = allItems.findIndex((x) => !x.zavrseno);
                        return items.map((l) => {
                          const realIdx = allItems.findIndex((x) => x.id === l.id);
                          const isDone = !!l.zavrseno;
                          const isNext = enforceProgress && realIdx === firstUndoneAll;
                          const isDodatak = l.slug.startsWith("dodatak-nivo");
                          const isLocked =
                            enforceProgress && !isDone && !isNext && !isDodatak;
                          const idx = realIdx;

                          const rowInner = (
                            <>
                              <div
                                className={`flex-shrink-0 w-9 h-9 rounded-full shadow-sm ring-2 flex items-center justify-center font-extrabold text-sm ${
                                  isLocked
                                    ? "bg-amber-100 ring-amber-200 text-amber-700/50"
                                    : "bg-white ring-amber-200 text-amber-900"
                                }`}
                              >
                                {idx + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div
                                  className={`font-bold text-sm sm:text-base truncate ${
                                    isLocked
                                      ? "text-amber-900/50"
                                      : "text-amber-900"
                                  }`}
                                >
                                  {l.naslov}
                                </div>
                                {isLocked && (
                                  <div className="text-[11px] text-amber-800/60 mt-0.5">
                                    {t("Zaključano — završi prethodnu lekciju")}
                                  </div>
                                )}
                              </div>
                              {isDone ? (
                                <CheckCircle2
                                  className="w-6 h-6 text-emerald-600 flex-shrink-0"
                                  aria-label={t("Završeno")}
                                />
                              ) : isLocked ? (
                                <Lock
                                  className="w-5 h-5 text-amber-700/50 flex-shrink-0"
                                  aria-label={t("Zaključano")}
                                />
                              ) : (
                                <BookOpen
                                  className="w-5 h-5 text-amber-700/80 flex-shrink-0"
                                  aria-hidden="true"
                                />
                              )}
                            </>
                          );

                          // Nakon svake 10. lekcije (po REALNOM redu u nivou,
                          // ne u filtriranom prikazu) ubacujemo "medaljon" red
                          // — prazan placeholder za sekciju ponavljanja koju
                          // admin kasnije popunjava akordionima i vježbama.
                          // Prikazuje se samo kad nije aktivna pretraga (da
                          // search rezultati ostanu kompaktni).
                          const showMedallionAfter =
                            !trimmedQuery && (idx + 1) % 10 === 0;

                          return (
                            <Fragment key={l.id}>
                              <li>
                                {isLocked ? (
                                  <div
                                    className="flex items-center gap-3 px-3 py-3 sm:py-3.5 rounded-xl opacity-70 cursor-not-allowed select-none"
                                    aria-disabled="true"
                                    data-testid={`locked-lekcija-${l.slug}`}
                                    title={t("Zaključano — završi prethodnu lekciju")}
                                  >
                                    {rowInner}
                                  </div>
                                ) : (
                                  <Link
                                    href={`/ilmihal/${l.slug}`}
                                    className="flex items-center gap-3 px-3 py-3 sm:py-3.5 rounded-xl hover:bg-white/60 active:bg-white/80 transition-colors"
                                    data-testid={`link-lekcija-${l.slug}`}
                                  >
                                    {rowInner}
                                  </Link>
                                )}
                              </li>
                              {showMedallionAfter && (
                                <li
                                  data-testid={`medaljon-${nivo}-${idx + 1}`}
                                  className="flex items-center gap-3 px-3 py-4 select-none"
                                >
                                  <div
                                    className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 ring-2 ring-amber-500 shadow-md"
                                    aria-label={t("Medaljon — sekcija ponavljanja")}
                                  >
                                    <Award className="w-5 h-5 text-amber-900" />
                                  </div>
                                  <div className="flex-1 h-px bg-gradient-to-r from-amber-400/60 via-amber-300/40 to-transparent" />
                                </li>
                              )}
                            </Fragment>
                          );
                        });
                      })()}
                    </ol>
                    {isAdmin && (
                      <button
                        onClick={() => createDodatak(nivo)}
                        className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 border-dashed border-amber-400 text-amber-800 font-bold text-sm hover:bg-white/60 active:bg-white/80 transition-colors"
                        data-testid={`button-add-dodatak-${nivo}`}
                      >
                        <Plus className="w-4 h-4" /> {t("Dodaj DODATAK lekciju")}
                      </button>
                    )}
                  </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
