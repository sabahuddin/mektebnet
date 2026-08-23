import { useMemo, useState } from "react";
import { BookOpen, Check, ChevronDown, Circle, Search, SlidersHorizontal } from "lucide-react";

export interface NapametStavka {
  id: string;
  nivo: number;
  naziv: string;
  redoslijed: number;
  sourceLessonSlug?: string | null;
  scope?: "global" | "lokalno" | "legacy";
  assessedCount?: number;
  totalCount?: number;
  ukupnoUcenika?: number;
  ocijenjenoUcenika?: number;
}

export interface NapametOcjena {
  id: number;
  napametStavkaId: string | null;
  ocjena: number;
  datum: string;
  napomena?: string | null;
}

const NIVO_NAZIV: Record<number, string> = {
  1: "NAPAMET 1. nivo",
  2: "NAPAMET 2. nivo",
  3: "NAPAMET 3. nivo",
  4: "Dodatak",
};

const OCJENA_COLORS = ["", "bg-red-100 text-red-700", "bg-orange-100 text-orange-700", "bg-amber-100 text-amber-700", "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-emerald-100 text-emerald-700"];
const NIVO_COLORS: Record<number, { icon: string; text: string }> = {
  1: { icon: "bg-emerald-100 text-emerald-700", text: "text-emerald-800" },
  2: { icon: "bg-sky-100 text-sky-700", text: "text-sky-800" },
  3: { icon: "bg-amber-100 text-amber-700", text: "text-amber-800" },
  4: { icon: "bg-violet-100 text-violet-700", text: "text-violet-800" },
};

export function NapametPregled({ katalog, ocjene, loading = false }: {
  katalog: NapametStavka[];
  ocjene: NapametOcjena[];
  loading?: boolean;
}) {
  const [openNivo, setOpenNivo] = useState<number | null>(1);
  const [filter, setFilter] = useState<"all" | "graded" | "remaining">("all");
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState<Record<number, boolean>>({});

  // API vraća posljednje ocjene prve; zadrži prvu ocjenu po stavci da rezultat
  // pregleda uvijek bude isti kao ono što muallim vidi u najnovijem unosu.
  const gradeByItem = useMemo(() => {
    const map = new Map<string, NapametOcjena>();
    for (const ocjena of ocjene) {
      if (ocjena.napametStavkaId && !map.has(ocjena.napametStavkaId)) {
        map.set(ocjena.napametStavkaId, ocjena);
      }
    }
    return map;
  }, [ocjene]);

  const normalizedSearch = search.trim().toLocaleLowerCase("bs-BA");
  const totalCount = katalog.length;
  const gradedCount = katalog.filter((stavka) => gradeByItem.has(stavka.id)).length;
  const remainingCount = Math.max(0, totalCount - gradedCount);

  const levelItems = (nivo: number) => katalog
    .filter((stavka) => {
      if (stavka.nivo !== nivo) return false;
      if (normalizedSearch && !stavka.naziv.toLocaleLowerCase("bs-BA").includes(normalizedSearch)) return false;
      if (filter === "graded") return gradeByItem.has(stavka.id);
      if (filter === "remaining") return !gradeByItem.has(stavka.id);
      return true;
    })
    .sort((a, b) => a.redoslijed - b.redoslijed);

  const toggleNivo = (nivo: number) => {
    setOpenNivo((trenutno) => trenutno === nivo ? null : nivo);
  };

  return (
    <div className="grid grid-cols-1 gap-4 items-start" data-testid="napamet-pregled">
      {!loading && (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Odaberite nivo da vidite stavke i ocjene.</p>
            <div className="rounded-2xl bg-emerald-700 text-white px-3.5 py-2.5 text-right shrink-0">
              <p className="text-[10px] font-bold text-emerald-100">UKUPNO</p>
              <p className="text-xl font-black leading-none mt-1">{gradedCount}<span className="text-sm font-bold text-emerald-200"> / {totalCount}</span></p>
              <p className="text-[10px] text-emerald-100 mt-1">ocijenjeno</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {([
              ["all", "Sve", totalCount],
              ["graded", "Ocijenjeno", gradedCount],
              ["remaining", "Preostalo", remainingCount],
            ] as const).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
                className={`rounded-xl border px-2.5 py-2 text-left transition ${
                  filter === value
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                    : "border-border/70 bg-white text-muted-foreground hover:border-emerald-200"
                }`}
              >
                <span className="block text-[11px] font-bold">{label}</span>
                <span className="block text-lg font-black leading-none mt-1">{count}</span>
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Pretraži stavke Napamet</span>
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-xl border border-border/70 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                placeholder="Pretraži stavke..."
              />
            </label>
            <button
              type="button"
              onClick={() => setFilter("all")}
              aria-label="Poništi filter"
              title="Poništi filter"
              className="rounded-xl border border-border/70 bg-white px-3 text-muted-foreground hover:border-emerald-200 hover:text-emerald-700"
            >
              <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </>
      )}

      {[1, 2, 3, 4].map((nivo) => {
        const sveStavke = katalog.filter((stavka) => stavka.nivo === nivo).sort((a, b) => a.redoslijed - b.redoslijed);
        const stavke = levelItems(nivo);
        if (!sveStavke.length && !loading) return null;
        const ocijenjeno = sveStavke.filter((stavka) => gradeByItem.has(stavka.id)).length;
        const isOpen = openNivo === nivo;
        const visibleStavke = showAll[nivo] || normalizedSearch ? stavke : stavke.slice(0, 5);
        const colors = NIVO_COLORS[nivo];
        return (
          <section key={nivo} className="bg-white border border-border/70 rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(15,70,50,.04)]">
            <button
              type="button"
              onClick={() => !loading && toggleNivo(nivo)}
              aria-expanded={loading ? undefined : isOpen}
              aria-controls={`napamet-nivo-${nivo}`}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 disabled:hover:bg-white"
              disabled={loading}
            >
              <span className={`grid h-9 w-9 place-items-center rounded-xl shrink-0 ${colors?.icon || "bg-emerald-100 text-emerald-700"}`}>
                <BookOpen className="w-4 h-4" aria-hidden="true" />
              </span>
              <span className="flex-1 min-w-0">
                <span className={`block font-extrabold ${colors?.text || "text-emerald-800"}`}>{NIVO_NAZIV[nivo]}</span>
                {loading ? (
                  <span className="block h-3 w-32 mt-1.5 animate-pulse rounded bg-muted/60" />
                ) : (
                  <span className="block text-xs text-muted-foreground mt-0.5">{ocijenjeno} ocijenjeno <span className="text-slate-300">·</span> {sveStavke.length - ocijenjeno} čeka pregled</span>
                )}
              </span>
              {!loading && (
                <>
                  <span className="text-xs font-black text-muted-foreground mr-1">{sveStavke.length ? Math.round(ocijenjeno / sveStavke.length * 100) : 0}%</span>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                </>
              )}
            </button>
            <div id={`napamet-nivo-${nivo}`} hidden={!loading && !isOpen} className="border-t border-border/50">
              {loading ? (
                <div className="divide-y divide-border/50">
                  {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-14 animate-pulse bg-muted/30" />)}
                </div>
              ) : stavke.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nema stavki za izabrani filter.</p>
              ) : (
                <div className="divide-y divide-border/50">
                  <div className="px-4 py-2.5 bg-slate-50/70 flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
                      {filter === "graded" ? "Ocijenjeno" : filter === "remaining" ? "Čeka pregled" : "Sve stavke"}
                    </span>
                    <span className="text-xs text-muted-foreground">Nivo {nivo}</span>
                  </div>
                  {visibleStavke.map((stavka) => {
                    const ocjena = gradeByItem.get(stavka.id);
                    return (
                      <div key={stavka.id} className={`flex items-center gap-3 px-4 py-3 ${ocjena ? "bg-white" : "bg-slate-50/70"}`}>
                        <span className={`grid h-7 w-7 place-items-center rounded-full shrink-0 ${ocjena ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                          {ocjena ? <Check className="w-4 h-4" aria-hidden="true" /> : <Circle className="w-3 h-3" aria-hidden="true" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className={`block text-sm font-bold ${ocjena ? "text-foreground" : "text-slate-400"}`}>{stavka.naziv}</span>
                          {ocjena && (
                            <span className="block text-xs text-muted-foreground mt-0.5">
                              {ocjena.datum}{ocjena.napomena ? ` · ${ocjena.napomena}` : ""}
                            </span>
                          )}
                        </span>
                        {ocjena ? (
                          <span className={`font-extrabold rounded-full px-2.5 py-1 text-sm ${OCJENA_COLORS[ocjena.ocjena] || "bg-muted text-foreground"}`} title={`${ocjena.datum}${ocjena.napomena ? ` · ${ocjena.napomena}` : ""}`}>
                            {ocjena.ocjena}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Čeka pregled</span>
                        )}
                      </div>
                    );
                  })}
                  {stavke.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setShowAll((trenutno) => ({ ...trenutno, [nivo]: !trenutno[nivo] }))}
                      className="w-full py-3 text-sm font-extrabold text-emerald-700 hover:bg-emerald-50"
                    >
                      {showAll[nivo] ? "Prikaži manje" : `Prikaži svih ${stavke.length} stavki`}
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
