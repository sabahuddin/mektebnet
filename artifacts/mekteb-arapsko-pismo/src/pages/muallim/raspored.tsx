import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import {
  ArrowLeft, ListOrdered, Loader2, ChevronUp, ChevronDown,
  RotateCcw, Save, Info, GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Grupa {
  id: number;
  naziv: string;
}

interface RasporedLekcija {
  lekcijaId: number;
  slug: string;
  naslov: string;
  globalniRedoslijed: number;
  pozicija: number;
}

interface RasporedResponse {
  grupaId: number;
  nivo: number;
  imaRaspored: boolean;
  lekcije: RasporedLekcija[];
}

const NIVOI = [1, 2, 3];

export default function MuallimRasporedPage() {
  const { grupaId: grupaIdParam } = useParams<{ grupaId: string }>();
  const grupaId = parseInt(grupaIdParam);
  const [, setLocation] = useLocation();
  const { token } = useAuth();
  const { toast } = useToast();

  const [grupaNaziv, setGrupaNaziv] = useState<string>("");
  const [nivo, setNivo] = useState<number>(1);
  const [lekcije, setLekcije] = useState<RasporedLekcija[]>([]);
  const [imaRaspored, setImaRaspored] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Naziv grupe (za zaglavlje).
  useEffect(() => {
    if (!token) return;
    apiRequest<Grupa[]>("GET", "/muallim/grupe", undefined, token)
      .then(gs => {
        const g = gs.find(x => x.id === grupaId);
        setGrupaNaziv(g?.naziv || `Grupa ${grupaId}`);
      })
      .catch(() => setGrupaNaziv(`Grupa ${grupaId}`));
  }, [token, grupaId]);

  const loadRaspored = useCallback(
    (nv: number) => {
      if (!token) return;
      setLoading(true);
      apiRequest<RasporedResponse>("GET", `/muallim/grupa/${grupaId}/raspored?nivo=${nv}`, undefined, token)
        .then(res => {
          setLekcije(res.lekcije);
          setImaRaspored(res.imaRaspored);
          setDirty(false);
        })
        .catch((err: any) => {
          toast({ title: "Greška", description: err.message || "Ne mogu učitati raspored", variant: "destructive" });
          setLekcije([]);
        })
        .finally(() => setLoading(false));
    },
    [token, grupaId, toast],
  );

  useEffect(() => {
    loadRaspored(nivo);
  }, [nivo, loadRaspored]);

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= lekcije.length) return;
    setLekcije(prev => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setDirty(true);
  }

  function reorder(from: number, to: number) {
    if (from === to) return;
    setLekcije(prev => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setDirty(true);
  }

  async function handleSave() {
    if (!token || lekcije.length === 0) return;
    setSaving(true);
    try {
      await apiRequest("PUT", `/muallim/grupa/${grupaId}/raspored`, {
        nivo,
        lekcijaIds: lekcije.map(l => l.lekcijaId),
      }, token);
      setImaRaspored(true);
      setDirty(false);
      toast({ title: "Spremljeno", description: `Raspored za nivo ${nivo} je sačuvan.` });
    } catch (err: any) {
      toast({ title: "Greška", description: err.message || "Spremanje nije uspjelo", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!token) return;
    setResetting(true);
    try {
      await apiRequest("DELETE", `/muallim/grupa/${grupaId}/raspored?nivo=${nivo}`, undefined, token);
      toast({ title: "Vraćeno na zadano", description: `Nivo ${nivo} koristi globalni redoslijed.` });
      loadRaspored(nivo);
    } catch (err: any) {
      toast({ title: "Greška", description: err.message || "Reset nije uspio", variant: "destructive" });
    } finally {
      setResetting(false);
    }
  }

  return (
    <Layout>
      <div className="sticky top-16 z-30 -mx-4 px-4 py-2.5 bg-gradient-to-r from-violet-50 via-white to-violet-50 border-b border-violet-200/70 shadow-sm mb-6">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button
            onClick={() => setLocation(`/muallim/grupa/${grupaId}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-violet-200 text-violet-700 hover:bg-violet-100 font-bold text-sm transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" /> Nazad
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <ListOrdered className="w-4 h-4 text-violet-700 shrink-0" />
            <span className="font-extrabold text-foreground truncate">Raspored lekcija · {grupaNaziv}</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="flex items-start gap-3 bg-violet-50 border border-violet-200 rounded-2xl p-4 mb-5">
          <Info className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
          <p className="text-sm text-violet-900/90 leading-relaxed">
            Posloži lekcije onim redoslijedom kojim ih obrađuješ sa ovom grupom. Učenici
            ove grupe će lekcije otključavati po tvom redoslijedu. Ako ne sačuvaš vlastiti
            raspored, koristi se zadani (globalni) redoslijed. Mijenjanje rasporeda ne briše
            napredak učenika.
          </p>
        </div>

        {/* Nivo tabovi */}
        <div className="flex gap-2 mb-5">
          {NIVOI.map(n => (
            <button
              key={n}
              onClick={() => {
                if (dirty && !window.confirm("Imaš nesačuvane izmjene. Promijeniti nivo bez spremanja?")) return;
                setNivo(n);
              }}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors border-2 ${
                nivo === n
                  ? "bg-violet-600 border-violet-600 text-white"
                  : "bg-white border-violet-200 text-violet-700 hover:bg-violet-50"
              }`}
            >
              Nivo {n}
            </button>
          ))}
          <div className="ml-auto flex items-center">
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${imaRaspored ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {imaRaspored ? "Vlastiti raspored" : "Zadani redoslijed"}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 bg-muted/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : lekcije.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground font-medium">
            Nema lekcija za nivo {nivo}.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {lekcije.map((l, i) => (
              <motion.div
                key={l.lekcijaId}
                layout
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) reorder(dragIndex, i);
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
                className={`flex items-center gap-3 bg-white border rounded-xl px-3 py-2.5 shadow-sm ${
                  dragIndex === i ? "border-violet-400 ring-2 ring-violet-200" : "border-border/60"
                }`}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground/50 cursor-grab shrink-0" />
                <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg bg-violet-100 text-violet-700 font-black text-sm">
                  {i + 1}
                </span>
                <span className="flex-1 min-w-0 font-semibold text-foreground truncate">{l.naslov}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="p-1.5 rounded-lg hover:bg-violet-50 text-violet-700 disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Pomjeri gore"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === lekcije.length - 1}
                    className="p-1.5 rounded-lg hover:bg-violet-50 text-violet-700 disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Pomjeri dolje"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {!loading && lekcije.length > 0 && (
          <div className="sticky bottom-4 mt-6 flex flex-wrap gap-3 bg-white/80 backdrop-blur border border-border/50 rounded-2xl p-3 shadow-lg">
            <Button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="rounded-xl font-bold flex items-center gap-2 flex-1 min-w-[140px]"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {dirty ? "Sačuvaj raspored" : "Sačuvano"}
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={resetting || !imaRaspored}
              className="rounded-xl font-bold flex items-center gap-2"
            >
              {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Vrati na zadano
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
