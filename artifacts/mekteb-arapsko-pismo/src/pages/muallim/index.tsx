import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import {
  Users, GraduationCap, CalendarCheck, BookMarked, ChevronRight, Plus,
  BarChart3, Clock, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Stats {
  ukupnoUcenika: number;
  ukupnoGrupa: number;
  danasnjePrisustvo?: number;
}

interface Ucenik {
  id: number;
  displayName: string;
  username: string;
  grupaId?: number;
  grupaIme?: string;
  aktivanStatus: boolean;
}

interface Grupa {
  id: number;
  ime: string;
  razred: number;
  brUcenika: number;
}

export default function MuallimPanel() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"pregled" | "ucenici" | "grupe" | "prisustvo">("pregled");
  const [ucenici, setUcenici] = useState<Ucenik[]>([]);
  const [grupe, setGrupe] = useState<Grupa[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiRequest<Ucenik[]>("GET", "/muallim/ucenici", undefined, token),
      apiRequest<Grupa[]>("GET", "/muallim/grupe", undefined, token),
    ]).then(([u, g]) => {
      setUcenici(u);
      setGrupe(g);
    }).catch(() => {}).finally(() => setIsLoading(false));
  }, [token]);

  if (!user || user.role !== "muallim") {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-muted-foreground font-medium">Pristup dozvoljen samo muallimima</p>
          <Button className="mt-4" onClick={() => setLocation("/")}>Nazad</Button>
        </div>
      </Layout>
    );
  }

  const TABS = [
    { id: "pregled", label: "Pregled", icon: BarChart3 },
    { id: "ucenici", label: `Učenici (${ucenici.length})`, icon: Users },
    { id: "grupe", label: `Grupe (${grupe.length})`, icon: GraduationCap },
    { id: "prisustvo", label: "Prisustvo", icon: CalendarCheck },
  ] as const;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-secondary to-emerald-600 rounded-2xl flex items-center justify-center shadow-md">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">Muallim panel</h1>
            <p className="text-muted-foreground text-sm">Dobrodošao/la, {user.displayName}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all border ${activeTab === tab.id ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20" : "bg-white border-border/60 text-muted-foreground hover:bg-muted"}`}>
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
        ) : (
          <>
            {/* PREGLED */}
            {activeTab === "pregled" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Ukupno učenika", value: ucenici.length, icon: Users, color: "text-primary", bg: "bg-primary/5" },
                  { label: "Aktivnih grupa", value: grupe.length, icon: GraduationCap, color: "text-secondary", bg: "bg-secondary/5" },
                  { label: "Aktivnih učenika", value: ucenici.filter(u => u.aktivanStatus).length, icon: BookMarked, color: "text-emerald-600", bg: "bg-emerald-50" },
                  { label: "Školska godina", value: "2024/25", icon: Clock, color: "text-violet-600", bg: "bg-violet-50" },
                ].map(stat => (
                  <div key={stat.label} className={`${stat.bg} border border-border/50 rounded-2xl p-5`}>
                    <stat.icon className={`w-6 h-6 ${stat.color} mb-3`} />
                    <div className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</div>
                    <div className="text-sm text-muted-foreground font-medium mt-1">{stat.label}</div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* UČENICI */}
            {activeTab === "ucenici" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex justify-end mb-4">
                  <Link href="/muallim/dodaj-ucenika">
                    <Button className="rounded-xl font-bold flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Dodaj učenika
                    </Button>
                  </Link>
                </div>
                <div className="bg-white border border-border/50 rounded-2xl overflow-hidden">
                  {ucenici.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">Nema učenika. Dodaj prvog učenika.</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="border-b border-border/50">
                        <tr>
                          {["Ime i prezime", "Korisničko ime", "Grupa", "Status", ""].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ucenici.map((u, i) => (
                          <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                            className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-bold text-foreground">{u.displayName}</td>
                            <td className="px-4 py-3 text-muted-foreground font-mono text-sm">{u.username}</td>
                            <td className="px-4 py-3 text-muted-foreground text-sm">{u.grupaIme || "—"}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-bold px-2 py-1 rounded-full ${u.aktivanStatus ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                                {u.aktivanStatus ? "Aktivan" : "Arhiviran"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <Link href={`/muallim/ucenik/${u.id}`}>
                                <button className="text-primary hover:underline font-bold text-sm flex items-center gap-1">
                                  Detalji <ChevronRight className="w-3 h-3" />
                                </button>
                              </Link>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </motion.div>
            )}

            {/* GRUPE */}
            {activeTab === "grupe" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex justify-end mb-4">
                  <Link href="/muallim/dodaj-grupu">
                    <Button className="rounded-xl font-bold flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Nova grupa
                    </Button>
                  </Link>
                </div>
                {grupe.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground bg-white rounded-2xl border border-border/50">
                    <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">Nema grupa. Kreiraj prvu grupu (razred).</p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {grupe.map((g, i) => (
                      <motion.div key={g.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                        <Link href={`/muallim/grupa/${g.id}`}>
                          <div className="bg-white border-2 border-secondary/20 rounded-2xl p-5 cursor-pointer hover:border-secondary hover:shadow-md transition-all group">
                            <GraduationCap className="w-8 h-8 text-secondary mb-3" />
                            <h3 className="font-extrabold text-foreground text-lg">{g.ime}</h3>
                            <p className="text-sm text-muted-foreground mt-1">Razred {g.razred} · {g.brUcenika} učenika</p>
                            <div className="flex items-center gap-1 text-secondary font-bold text-sm mt-3">
                              Otvori <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* PRISUSTVO */}
            {activeTab === "prisustvo" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center py-16 text-muted-foreground bg-white rounded-2xl border border-border/50">
                <CalendarCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-bold text-foreground mb-2">Evidencija prisustva</p>
                <p className="text-sm">Odaberi grupu da uneseš prisustvo za danas</p>
                <div className="flex flex-wrap gap-3 justify-center mt-6">
                  {grupe.map(g => (
                    <Link key={g.id} href={`/muallim/prisustvo/${g.id}`}>
                      <button className="bg-primary/10 text-primary border border-primary/20 rounded-xl px-5 py-3 font-bold hover:bg-primary hover:text-primary-foreground transition-all">
                        {g.ime}
                      </button>
                    </Link>
                  ))}
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
