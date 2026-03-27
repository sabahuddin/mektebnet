import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { ArrowLeft, User, CalendarCheck, Star, PlusCircle, Loader2, ClipboardList, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface Ucenik {
  id: number;
  displayName: string;
  username: string;
  role: string;
}

interface Prisustvo {
  id: number;
  datum: string;
  status: string;
  napomena?: string;
}

interface Ocjena {
  id: number;
  kategorija: string;
  ocjena: number;
  napomena?: string;
  datum: string;
}

interface Grupa {
  id: number;
  naziv: string;
}

interface KvizRezultat {
  id: number;
  kvizNaslov: string;
  tacniOdgovori: number;
  ukupnoPitanja: number;
  procenat: number;
  bodovi: number;
  completedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  prisutan: "bg-emerald-100 text-emerald-700",
  odsutan: "bg-red-100 text-red-700",
  zakasnio: "bg-amber-100 text-amber-700",
  opravdan: "bg-blue-100 text-blue-700",
};

const OCJENA_COLORS = ["", "bg-red-100 text-red-700", "bg-orange-100 text-orange-700", "bg-amber-100 text-amber-700", "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-emerald-200 text-emerald-800"];

export default function UcenikPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { token } = useAuth();
  const { toast } = useToast();
  const [ucenik, setUcenik] = useState<Ucenik | null>(null);
  const [prisustvo, setPrisustvo] = useState<Prisustvo[]>([]);
  const [ocjene, setOcjene] = useState<Ocjena[]>([]);
  const [grupe, setGrupe] = useState<Grupa[]>([]);
  const [kvizRezultati, setKvizRezultati] = useState<KvizRezultat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showOcjenaForm, setShowOcjenaForm] = useState(false);
  const [newOcjena, setNewOcjena] = useState({ kategorija: "usmeno", ocjena: 5, lekcijaNaziv: "", napomena: "", datum: new Date().toISOString().split("T")[0] });
  const [savingOcjena, setSavingOcjena] = useState(false);
  const [planLekcije, setPlanLekcije] = useState<{ id: number; lekcijaNaslov: string }[]>([]);

  useEffect(() => {
    if (!token || !id) return;
    const ucenikId = parseInt(id);
    Promise.all([
      apiRequest<Ucenik[]>("GET", "/muallim/ucenici", undefined, token),
      apiRequest<Ocjena[]>("GET", `/muallim/ocjene/${ucenikId}`, undefined, token),
      apiRequest<Prisustvo[]>("GET", `/muallim/prisustvo-ucenik/${ucenikId}`, undefined, token),
      apiRequest<Grupa[]>("GET", "/muallim/grupe", undefined, token),
      apiRequest<{ rezultati: KvizRezultat[] }>("GET", `/muallim/ucenik-rezultati/${ucenikId}`, undefined, token).catch(() => ({ rezultati: [] })),
    ]).then(([ucenici, oc, prs, g, kvizData]) => {
      const found = (ucenici as any[]).find(u => u.id === ucenikId);
      setUcenik(found || null);
      setOcjene(oc);
      setPrisustvo(prs);
      setGrupe(g);
      setKvizRezultati((kvizData as any).rezultati || []);
      const gId = found?.profil?.grupaId || found?.grupaId;
      if (gId) {
        apiRequest<{ id: number; lekcijaNaslov: string }[]>("GET", `/muallim/plan-lekcija?grupaId=${gId}`, undefined, token)
          .then(pl => {
            const unique = [...new Map(pl.map(l => [l.lekcijaNaslov, l])).values()];
            setPlanLekcije(unique);
          }).catch(() => {});
      }
    }).catch(() => {}).finally(() => setIsLoading(false));
  }, [token, id]);

  async function saveOcjena() {
    if (!token || !id) return;
    setSavingOcjena(true);
    try {
      const oc = await apiRequest<Ocjena>("POST", "/muallim/ocjene", {
        ucenikId: parseInt(id),
        kategorija: newOcjena.kategorija,
        ocjena: parseInt(String(newOcjena.ocjena)),
        lekcijaNaziv: newOcjena.lekcijaNaziv || null,
        napomena: newOcjena.napomena,
        datum: newOcjena.datum,
      }, token);
      setOcjene(prev => [oc, ...prev]);
      setShowOcjenaForm(false);
      setNewOcjena({ kategorija: "usmeno", ocjena: 5, lekcijaNaziv: "", napomena: "", datum: new Date().toISOString().split("T")[0] });
      toast({ title: "Ocjena dodana!" });
    } catch {
      toast({ title: "Greška", description: "Nije moguće dodati ocjenu", variant: "destructive" });
    } finally {
      setSavingOcjena(false);
    }
  }

  const prisutnih = prisustvo.filter(p => p.status === "prisutan").length;
  const prosjecnaOcjena = ocjene.length ? (ocjene.reduce((s, o) => s + o.ocjena, 0) / ocjene.length).toFixed(2) : null;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <button onClick={() => setLocation("/muallim")} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-medium mb-6 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Nazad na panel
        </button>

        {isLoading ? (
          <div className="flex flex-col gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
        ) : !ucenik ? (
          <div className="text-center py-20 text-muted-foreground">Učenik nije pronađen</div>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-md">
                <User className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-foreground">{ucenik.displayName}</h1>
                <p className="text-muted-foreground text-sm font-mono">{ucenik.username}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              {[
                { label: "Časova prisustvo", value: prisustvo.length || "—", icon: CalendarCheck, color: "text-primary" },
                { label: "Prisutnih", value: prisustvo.length ? `${prisutnih}/${prisustvo.length}` : "—", icon: CalendarCheck, color: "text-emerald-600" },
                { label: "Prosj. ocjena", value: prosjecnaOcjena || "—", icon: Star, color: "text-amber-600" },
              ].map(stat => (
                <div key={stat.label} className="bg-white border border-border/50 rounded-2xl p-4">
                  <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
                  <div className={`text-xl font-extrabold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-muted-foreground font-medium mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Kviz rezultati */}
              <div className="bg-white border border-border/50 rounded-2xl p-5 md:col-span-2 lg:col-span-1 lg:row-span-2">
                <h2 className="font-extrabold text-foreground flex items-center gap-2 mb-4">
                  <ClipboardList className="w-4 h-4 text-primary" /> Rezultati kvizova
                </h2>
                {kvizRezultati.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Učenik još nije radio kvizove</p>
                ) : (
                  <div className="space-y-2.5 max-h-80 overflow-y-auto">
                    {kvizRezultati.map(r => (
                      <div key={r.id} className="bg-muted/20 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-sm text-foreground truncate mr-2">{r.kvizNaslov}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${r.procenat >= 80 ? "bg-emerald-100 text-emerald-700" : r.procenat >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                            {r.procenat}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{r.tacniOdgovori}/{r.ukupnoPitanja} tačnih</span>
                          <div className="flex items-center gap-2">
                            {r.bodovi > 0 && (
                              <span className="flex items-center gap-0.5 text-amber-600 font-bold">
                                <Award className="w-3 h-3" /> {r.bodovi}
                              </span>
                            )}
                            <span>{r.completedAt ? new Date(r.completedAt).toLocaleDateString("bs-BA") : "-"}</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                          <div className={`h-1.5 rounded-full ${r.procenat >= 80 ? "bg-emerald-500" : r.procenat >= 50 ? "bg-amber-500" : "bg-red-400"}`}
                            style={{ width: `${r.procenat}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ocjene */}
              <div className="bg-white border border-border/50 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-extrabold text-foreground flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-500" /> Ocjene
                  </h2>
                  <button onClick={() => setShowOcjenaForm(!showOcjenaForm)}
                    className="flex items-center gap-1.5 text-primary hover:text-primary/80 text-sm font-bold">
                    <PlusCircle className="w-4 h-4" /> Dodaj
                  </button>
                </div>

                {showOcjenaForm && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    className="bg-muted/30 rounded-xl p-3 mb-4 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <select value={newOcjena.kategorija} onChange={e => setNewOcjena(p => ({ ...p, kategorija: e.target.value }))}
                        className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                        <option value="usmeno">Usmeno</option>
                        <option value="pismeno">Pismeno</option>
                        <option value="domaći">Domaći</option>
                        <option value="aktivnost">Aktivnost</option>
                        <option value="vladanje">Vladanje</option>
                      </select>
                      <select value={newOcjena.ocjena} onChange={e => setNewOcjena(p => ({ ...p, ocjena: parseInt(e.target.value) }))}
                        className="border border-border rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                        {[6, 5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    {planLekcije.length > 0 && (
                      <select value={newOcjena.lekcijaNaziv} onChange={e => setNewOcjena(p => ({ ...p, lekcijaNaziv: e.target.value }))}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                        <option value="">— Odaberi lekciju (opcionalno) —</option>
                        {planLekcije.map(l => <option key={l.id} value={l.lekcijaNaslov}>{l.lekcijaNaslov}</option>)}
                      </select>
                    )}
                    <input type="date" value={newOcjena.datum} onChange={e => setNewOcjena(p => ({ ...p, datum: e.target.value }))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white" />
                    <input type="text" placeholder="Napomena (opcionalno)" value={newOcjena.napomena}
                      onChange={e => setNewOcjena(p => ({ ...p, napomena: e.target.value }))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white" />
                    <Button onClick={saveOcjena} disabled={savingOcjena} className="w-full rounded-lg py-2 text-sm">
                      {savingOcjena ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Sačuvaj ocjenu"}
                    </Button>
                  </motion.div>
                )}

                {ocjene.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nema unesenih ocjena</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {ocjene.map(o => (
                      <div key={o.id} className="flex items-center justify-between text-sm">
                        <div>
                          <span className="font-medium text-foreground capitalize">{o.kategorija}</span>
                          {(o as any).lekcijaNaziv && <span className="text-primary ml-2 text-xs font-medium">({(o as any).lekcijaNaziv})</span>}
                          {o.napomena && <span className="text-muted-foreground ml-2">— {o.napomena}</span>}
                          <div className="text-xs text-muted-foreground">{o.datum}</div>
                        </div>
                        <span className={`text-sm font-extrabold px-2.5 py-0.5 rounded-full ${OCJENA_COLORS[o.ocjena] || "bg-gray-100 text-gray-700"}`}>
                          {o.ocjena}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Prisustvo */}
              <div className="bg-white border border-border/50 rounded-2xl p-5">
                <h2 className="font-extrabold text-foreground flex items-center gap-2 mb-4">
                  <CalendarCheck className="w-4 h-4 text-primary" /> Prisustvo
                </h2>
                {prisustvo.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nema evidencije prisustva</p>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {[...prisustvo].reverse().map(p => (
                      <div key={p.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{p.datum}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status] || "bg-gray-100 text-gray-700"}`}>
                          {p.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
