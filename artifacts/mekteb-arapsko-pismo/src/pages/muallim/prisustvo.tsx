import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { ArrowLeft, CalendarCheck, Check, X, Clock, AlertCircle, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type Status = "prisutan" | "odsutan" | "zakasnio" | "opravdan";

interface Ucenik {
  id: number;
  displayName: string;
  username: string;
}

interface Grupa {
  id: number;
  naziv: string;
  skolskaGodina: string;
}

interface PrisustvoRecord {
  ucenikId: number;
  status: Status;
  napomena?: string;
}

const STATUS_OPTIONS: { value: Status; label: string; icon: React.ReactNode; color: string; bg: string; border: string }[] = [
  { value: "prisutan", label: "Prisutan", icon: <Check className="w-3.5 h-3.5" />, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-400" },
  { value: "odsutan", label: "Odsutan", icon: <X className="w-3.5 h-3.5" />, color: "text-red-700", bg: "bg-red-50", border: "border-red-400" },
  { value: "zakasnio", label: "Zakasnio", icon: <Clock className="w-3.5 h-3.5" />, color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-400" },
  { value: "opravdan", label: "Opravdan", icon: <AlertCircle className="w-3.5 h-3.5" />, color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-400" },
];

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

export default function PrisustvoPage() {
  const { grupaId } = useParams<{ grupaId: string }>();
  const [, setLocation] = useLocation();
  const { token } = useAuth();
  const { toast } = useToast();
  const [grupa, setGrupa] = useState<Grupa | null>(null);
  const [ucenici, setUcenici] = useState<Ucenik[]>([]);
  const [datum, setDatum] = useState(todayStr());
  const [statusi, setStatusi] = useState<Record<number, Status>>({});
  const [napomene, setNapomene] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!token || !grupaId) return;
    Promise.all([
      apiRequest<Grupa[]>("GET", "/muallim/grupe", undefined, token),
      apiRequest<Ucenik[]>("GET", "/muallim/ucenici", undefined, token),
    ]).then(([grupe, sviUcenici]) => {
      const g = grupe.find(g => g.id === parseInt(grupaId));
      setGrupa(g || null);
      const grupaUcenici = sviUcenici.filter((u: any) => (u.grupaId || u.profil?.grupaId) === parseInt(grupaId));
      setUcenici(grupaUcenici);
      const defaultStatusi: Record<number, Status> = {};
      grupaUcenici.forEach((u: Ucenik) => { defaultStatusi[u.id] = "prisutan"; });
      setStatusi(defaultStatusi);
    }).catch(() => {}).finally(() => setIsLoading(false));
  }, [token, grupaId]);

  useEffect(() => {
    if (!token || !grupaId || ucenici.length === 0) return;
    apiRequest<PrisustvoRecord[]>("GET", `/muallim/prisustvo?grupaId=${grupaId}&datum=${datum}`, undefined, token)
      .then(records => {
        if (records.length === 0) return;
        const newStatusi: Record<number, Status> = {};
        const newNapomene: Record<number, string> = {};
        for (const r of records) {
          newStatusi[r.ucenikId] = r.status as Status;
          if (r.napomena) newNapomene[r.ucenikId] = r.napomena;
        }
        setStatusi(prev => ({ ...prev, ...newStatusi }));
        setNapomene(prev => ({ ...prev, ...newNapomene }));
      }).catch(() => {});
  }, [datum, ucenici.length, token, grupaId]);

  async function handleSave() {
    if (!token || !grupaId) return;
    setIsSaving(true);
    try {
      const prisustvoData = ucenici.map(u => ({
        ucenikId: u.id,
        status: statusi[u.id] || "prisutan",
        napomena: napomene[u.id] || null,
      }));
      await apiRequest("POST", "/muallim/prisustvo", { grupaId: parseInt(grupaId), datum, prisustvo: prisustvoData }, token);
      toast({ title: "Prisustvo sačuvano!", description: `Evidentirano za ${datum}` });
    } catch {
      toast({ title: "Greška", description: "Nije moguće sačuvati prisustvo", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  const prisutnih = Object.values(statusi).filter(s => s === "prisutan").length;
  const odsutnih = Object.values(statusi).filter(s => s === "odsutan").length;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <button onClick={() => setLocation("/muallim")} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-medium mb-6 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Nazad na panel
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-md">
            <CalendarCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">
              {grupa ? `Prisustvo — ${grupa.naziv}` : "Prisustvo"}
            </h1>
            <p className="text-muted-foreground text-sm">{grupa?.skolskaGodina}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Datum</label>
            <input
              type="date"
              value={datum}
              onChange={e => setDatum(e.target.value)}
              className="border border-border rounded-xl px-4 py-2.5 font-bold text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          {ucenici.length > 0 && (
            <div className="flex gap-4 text-sm font-bold">
              <span className="text-emerald-600">✓ {prisutnih} prisutnih</span>
              <span className="text-red-600">✗ {odsutnih} odsutnih</span>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
        ) : ucenici.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-border/50 text-muted-foreground">
            <p className="font-bold text-foreground mb-1">Nema učenika u ovoj grupi</p>
            <p className="text-sm">Dodaj učenike i rasporedi ih u grupu</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {ucenici.map((u, i) => {
              const currentStatus = statusi[u.id] || "prisutan";
              return (
                <motion.div key={u.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className="bg-white border border-border/50 rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <div className="font-bold text-foreground">{u.displayName}</div>
                      <div className="text-xs text-muted-foreground font-mono">{u.username}</div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {STATUS_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setStatusi(prev => ({ ...prev, [u.id]: opt.value }))}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${
                            currentStatus === opt.value
                              ? `${opt.bg} ${opt.color} ${opt.border}`
                              : "bg-muted/50 text-muted-foreground border-transparent hover:border-border"
                          }`}
                        >
                          {opt.icon} {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {(currentStatus === "odsutan" || currentStatus === "opravdan" || currentStatus === "zakasnio") && (
                    <div className="mt-3">
                      <input
                        type="text"
                        placeholder="Napomena (opcionalno)"
                        value={napomene[u.id] || ""}
                        onChange={e => setNapomene(prev => ({ ...prev, [u.id]: e.target.value }))}
                        className="w-full border border-border rounded-xl px-3 py-2 text-sm text-foreground bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  )}
                </motion.div>
              );
            })}

            <div className="flex justify-end mt-4">
              <Button onClick={handleSave} disabled={isSaving} className="rounded-xl font-bold px-8 flex items-center gap-2">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Sačuvaj prisustvo
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
