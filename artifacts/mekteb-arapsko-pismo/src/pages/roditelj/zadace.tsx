import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { ArrowLeft, ClipboardList, Clock, BookOpen, Users, User as UserIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ZadacaRoditelj {
  id: number;
  grupaId: number;
  naslov: string;
  opis?: string | null;
  rokDo?: string | null;
  lekcijaNaslov?: string | null;
  lekcijaTip?: string | null;
  isActive: boolean;
  createdAt: string;
  grupaNaziv?: string | null;
  djecaIds: number[];
  djecaImena: string[];
}

export default function RoditeljZadacePage() {
  const { token } = useAuth();
  const [, setLocation] = useLocation();
  const [zadace, setZadace] = useState<ZadacaRoditelj[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterDijete, setFilterDijete] = useState<string>("");

  useEffect(() => {
    if (!token) return;
    setIsLoading(true);
    apiRequest<ZadacaRoditelj[]>("GET", "/roditelj/zadace", undefined, token)
      .then(setZadace)
      .catch(() => setZadace([]))
      .finally(() => setIsLoading(false));
  }, [token]);

  const svaDjeca = useMemo(() => {
    const map = new Map<number, string>();
    for (const z of zadace) {
      z.djecaIds.forEach((id, idx) => {
        if (!map.has(id)) map.set(id, z.djecaImena[idx] || `#${id}`);
      });
    }
    return Array.from(map.entries()).map(([id, ime]) => ({ id, ime }));
  }, [zadace]);

  const filtered = useMemo(() => {
    if (!filterDijete) return zadace;
    const id = parseInt(filterDijete);
    return zadace.filter(z => z.djecaIds.includes(id));
  }, [zadace, filterDijete]);

  const aktivne = filtered.filter(z => !z.rokDo || new Date(z.rokDo) >= new Date(new Date().toDateString()));
  const istekle = filtered.filter(z => z.rokDo && new Date(z.rokDo) < new Date(new Date().toDateString()));

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => setLocation("/roditelj")}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-medium mb-6 text-sm transition-colors"
          data-testid="link-nazad"
        >
          <ArrowLeft className="w-4 h-4" /> Nazad na panel
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-md">
            <ClipboardList className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">Zadaće</h1>
            <p className="text-sm text-muted-foreground">Aktivne zadaće za vašu djecu</p>
          </div>
        </div>

        {svaDjeca.length > 1 && (
          <div className="mb-5 flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-muted-foreground">Filter:</span>
            <button
              onClick={() => setFilterDijete("")}
              className={`text-sm font-bold rounded-full px-4 py-1.5 border transition-all ${
                filterDijete === "" ? "bg-primary text-primary-foreground border-primary" : "bg-white text-foreground border-border hover:border-primary/40"
              }`}
              data-testid="filter-all"
            >
              Sva djeca
            </button>
            {svaDjeca.map(d => (
              <button
                key={d.id}
                onClick={() => setFilterDijete(String(d.id))}
                className={`text-sm font-bold rounded-full px-4 py-1.5 border transition-all ${
                  filterDijete === String(d.id) ? "bg-primary text-primary-foreground border-primary" : "bg-white text-foreground border-border hover:border-primary/40"
                }`}
                data-testid={`filter-dijete-${d.id}`}
              >
                {d.ime}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        ) : zadace.length === 0 ? (
          <div className="bg-white border border-border/50 rounded-2xl p-8 text-center">
            <ClipboardList className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-bold text-foreground mb-1">Nema aktivnih zadaća</p>
            <p className="text-sm text-muted-foreground">Trenutno nema zadaća za vašu djecu.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-border/50 rounded-2xl p-8 text-center">
            <p className="font-bold text-foreground mb-1">Nema zadaća za odabrano dijete</p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {aktivne.length > 0 && (
              <section>
                <h2 className="text-sm font-extrabold text-muted-foreground uppercase tracking-wider mb-3">Aktivne ({aktivne.length})</h2>
                <div className="space-y-3">
                  {aktivne.map((z, i) => <ZadacaCard key={z.id} z={z} index={i} expired={false} />)}
                </div>
              </section>
            )}
            {istekle.length > 0 && (
              <section>
                <h2 className="text-sm font-extrabold text-muted-foreground uppercase tracking-wider mb-3">Istekle ({istekle.length})</h2>
                <div className="space-y-3">
                  {istekle.map((z, i) => <ZadacaCard key={z.id} z={z} index={i} expired={true} />)}
                </div>
              </section>
            )}
          </motion.div>
        )}
      </div>
    </Layout>
  );
}

function ZadacaCard({ z, index, expired }: { z: ZadacaRoditelj; index: number; expired: boolean }) {
  const isIndividualna = z.djecaImena.length === 1;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`bg-white border rounded-2xl p-5 shadow-sm ${expired ? "border-red-200 bg-red-50/30" : "border-border/50"}`}
      data-testid={`zadaca-${z.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-extrabold text-foreground text-base">{z.naslov}</h3>
            {expired && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Isteklo</span>}
          </div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${isIndividualna ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
              {isIndividualna ? <UserIcon className="w-3 h-3" /> : <Users className="w-3 h-3" />}
              {z.djecaImena.join(", ")}
            </span>
            {z.grupaNaziv && (
              <span className="text-xs text-muted-foreground bg-muted/60 rounded-full px-2 py-0.5 font-medium">{z.grupaNaziv}</span>
            )}
          </div>
          {z.opis && <p className="text-sm text-muted-foreground mb-2 whitespace-pre-wrap">{z.opis}</p>}
          <div className="flex items-center gap-4 flex-wrap">
            {z.rokDo && (
              <span className={`text-xs flex items-center gap-1 ${expired ? "text-red-600 font-bold" : "text-muted-foreground"}`}>
                <Clock className="w-3 h-3" /> Rok: {new Date(z.rokDo).toLocaleDateString("bs-BA")}
              </span>
            )}
            {z.lekcijaNaslov && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <BookOpen className="w-3 h-3" /> {z.lekcijaNaslov}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              Kreirano: {new Date(z.createdAt).toLocaleDateString("bs-BA")}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
