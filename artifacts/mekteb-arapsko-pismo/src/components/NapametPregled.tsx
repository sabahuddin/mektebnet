import { BookOpen, CheckCircle2, Circle } from "lucide-react";

export interface NapametStavka {
  id: string;
  nivo: number;
  naziv: string;
  redoslijed: number;
  sourceLessonSlug?: string | null;
  scope?: "global" | "lokalno" | "legacy";
  assessedCount?: number;
  totalCount?: number;
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

export function NapametPregled({ katalog, ocjene, loading = false }: {
  katalog: NapametStavka[];
  ocjene: NapametOcjena[];
  loading?: boolean;
}) {
  const gradeByItem = new Map(ocjene.filter((o) => o.napametStavkaId).map((o) => [o.napametStavkaId!, o]));
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start" data-testid="napamet-pregled">
      {[1, 2, 3, 4].map((nivo) => {
        const stavke = katalog.filter((s) => s.nivo === nivo).sort((a, b) => a.redoslijed - b.redoslijed);
        if (!stavke.length && !loading) return null;
        return (
          <section key={nivo} className="bg-white border border-border/50 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-700" />
              <h3 className="font-extrabold text-emerald-900">{NIVO_NAZIV[nivo]}</h3>
            </div>
            <div className="divide-y divide-border/50">
              {loading ? Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-14 animate-pulse bg-muted/30" />
              )) : stavke.map((stavka) => {
                const ocjena = gradeByItem.get(stavka.id);
                return (
                  <div key={stavka.id} className={`flex items-center gap-3 px-4 py-3 ${ocjena ? "bg-white" : "bg-slate-50/70 text-slate-400"}`}>
                    {ocjena ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <Circle className="w-5 h-5 text-slate-300 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className={`font-bold ${ocjena ? "text-foreground" : "text-slate-400"}`}>{stavka.naziv}</p>
                      {ocjena ? (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {ocjena.datum}{ocjena.napomena ? ` · ${ocjena.napomena}` : ""}
                        </p>
                      ) : <p className="text-xs text-slate-400 mt-0.5">Još nije ocijenjeno</p>}
                    </div>
                    {ocjena && <span className={`font-extrabold rounded-full px-2.5 py-1 text-sm ${OCJENA_COLORS[ocjena.ocjena] || "bg-muted text-foreground"}`}>{ocjena.ocjena}</span>}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}