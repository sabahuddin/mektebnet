import { useEffect, useState, useCallback } from "react";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, Trophy, Star, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

interface Misija {
  id: number;
  kod: string;
  naziv: string;
  opis: string;
  tip: "dnevna" | "sedmicna";
  ikona: string;
  cilj: number;
  trenutno: number;
  completed: boolean;
  claimedAt: string | null;
  nagradaAferim: number;
  nagradaMed: number;
  periodKey: string;
}

export default function MisijePage() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [misije, setMisije] = useState<Misija[] | null>(null);
  const [claiming, setClaiming] = useState<number | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    apiRequest<{ misije: Misija[] }>("GET", "/misije/aktivne", undefined, token)
      .then(r => setMisije(r.misije))
      .catch(() => setMisije([]));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const claim = async (m: Misija) => {
    if (!token || claiming === m.id) return;
    setClaiming(m.id);
    try {
      const resp = await apiRequest<{ ok: boolean; alreadyClaimed?: boolean; nagradaAferim: number; nagradaMed: number; message?: string }>(
        "POST", `/misije/${m.id}/claim`, {}, token,
      );
      if (resp.alreadyClaimed) {
        toast({ title: "Već preuzeto", description: resp.message ?? "Nagrada je već preuzeta." });
      } else {
        const parts: string[] = [];
        if (resp.nagradaAferim > 0) parts.push(`+${resp.nagradaAferim} Aferima ⭐`);
        if (resp.nagradaMed > 0) parts.push(`+${resp.nagradaMed} Med 🍯`);
        toast({ title: "Misija završena!", description: parts.join("  ·  ") || resp.message });
      }
      load();
    } catch {
      toast({ title: "Greška pri preuzimanju", variant: "destructive" });
    } finally {
      setClaiming(null);
    }
  };

  if (!user) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto text-center py-20">
          <p className="text-muted-foreground">Prijavi se da vidiš svoje misije.</p>
          <Link href="/login" className="text-primary font-bold underline">Prijava</Link>
        </div>
      </Layout>
    );
  }

  if (misije === null) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto">
          <Skeleton className="h-16 rounded-2xl mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
          </div>
        </div>
      </Layout>
    );
  }

  const dnevne = misije.filter(m => m.tip === "dnevna");
  const sedmicne = misije.filter(m => m.tip === "sedmicna");

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link href="/ucenik" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary text-sm font-medium mb-3">
            <ArrowLeft className="w-4 h-4" /> Nazad na profil
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-2xl flex items-center justify-center shadow-md">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-foreground">Misije</h1>
              <p className="text-sm text-muted-foreground">
                Završi izazove i preuzmi nagrade. Dnevne se resetuju u ponoć, sedmične u nedjelju.
              </p>
            </div>
          </div>
        </div>

        <Section naslov="Danas" misije={dnevne} claim={claim} claiming={claiming} />
        <div className="h-6" />
        <Section naslov="Ova sedmica" misije={sedmicne} claim={claim} claiming={claiming} />
      </div>
    </Layout>
  );
}

function Section({ naslov, misije, claim, claiming }: {
  naslov: string;
  misije: Misija[];
  claim: (m: Misija) => void;
  claiming: number | null;
}) {
  if (misije.length === 0) return null;
  return (
    <div>
      <h2 className="text-lg font-extrabold text-foreground mb-3">{naslov}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {misije.map(m => (
          <MisijaCard key={m.id} m={m} onClaim={() => claim(m)} loading={claiming === m.id} />
        ))}
      </div>
    </div>
  );
}

function MisijaCard({ m, onClaim, loading }: { m: Misija; onClaim: () => void; loading: boolean }) {
  const pct = Math.min(100, Math.round((m.trenutno / Math.max(1, m.cilj)) * 100));
  const claimed = m.claimedAt !== null;
  const ready = m.completed && !claimed;
  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`rounded-2xl border-2 p-4 flex flex-col gap-3 ${
        claimed ? "bg-emerald-50 border-emerald-200" :
        ready ? "bg-amber-50 border-amber-300 shadow-md" :
        "bg-white border-border/50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="text-3xl shrink-0">{m.ikona}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-extrabold text-foreground leading-tight">{m.naziv}</h3>
            {claimed && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
          </div>
          <p className="text-xs text-muted-foreground leading-snug">{m.opis}</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs font-bold mb-1">
          <span className="text-foreground/70">{m.trenutno} / {m.cilj}</span>
          <span className="text-muted-foreground">{pct}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className={`h-full ${claimed ? "bg-emerald-500" : ready ? "bg-amber-500" : "bg-primary"}`}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-xs font-bold">
          {m.nagradaAferim > 0 && (
            <span className="flex items-center gap-1 text-amber-700">
              <Star className="w-3.5 h-3.5 fill-current" /> +{m.nagradaAferim}
            </span>
          )}
          {m.nagradaMed > 0 && (
            <span className="flex items-center gap-1 text-orange-700">🍯 +{m.nagradaMed}</span>
          )}
        </div>
        {ready && (
          <Button size="sm" onClick={onClaim} disabled={loading} className="h-8 rounded-xl">
            <Trophy className="w-3.5 h-3.5 mr-1" /> {loading ? "..." : "Preuzmi"}
          </Button>
        )}
        {claimed && (
          <span className="text-xs font-bold text-emerald-700">Preuzeto</span>
        )}
      </div>
    </motion.div>
  );
}
