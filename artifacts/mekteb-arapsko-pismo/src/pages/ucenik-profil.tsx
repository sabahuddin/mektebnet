import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useLocation } from "wouter";
import {
  User, Star, CalendarCheck, ClipboardList, BookOpen, Calendar,
  ChevronLeft, ChevronRight, Award, GraduationCap, MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface ProfilData {
  user: { id: number; displayName: string; username: string; createdAt: string };
  profil: { grupaId: number; muallimId: number } | null;
  grupa: { id: number; naziv: string; skolskaGodina: string } | null;
  muallim: { id: number; displayName: string } | null;
  ocjene: { id: number; kategorija: string; ocjena: number; lekcijaNaziv?: string; napomena?: string; datum: string }[];
  prisustvo: { id: number; datum: string; status: string }[];
  kvizovi: { id: number; kvizNaslov: string; tacniOdgovori: number; ukupnoPitanja: number; procenat: number; bodovi: number; completedAt: string }[];
}

interface KalendarEntry {
  id: number; datum: string; tip: string; opis?: string;
}

interface PlanLekcija {
  id: number; datum: string; lekcijaNaslov: string; lekcijaTip: string;
}

const STATUS_COLORS: Record<string, string> = {
  prisutan: "bg-emerald-100 text-emerald-700",
  odsutan: "bg-red-100 text-red-700",
  zakasnio: "bg-amber-100 text-amber-700",
  opravdan: "bg-blue-100 text-blue-700",
};

const TIP_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  mekteb: { bg: "bg-emerald-100", border: "border-emerald-400", text: "text-emerald-700", label: "Mekteb" },
  ferije: { bg: "bg-red-100", border: "border-red-400", text: "text-red-700", label: "Ferije" },
  vazan_datum: { bg: "bg-blue-100", border: "border-blue-400", text: "text-blue-700", label: "Važan datum" },
};

const OCJENA_COLORS = ["", "bg-red-100 text-red-700", "bg-orange-100 text-orange-700", "bg-amber-100 text-amber-700", "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-emerald-200 text-emerald-800"];
const DAYS_BS = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];

export default function UcenikProfilPage() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const [profil, setProfil] = useState<ProfilData | null>(null);
  const [kalendar, setKalendar] = useState<KalendarEntry[]>([]);
  const [planLekcija, setPlanLekcija] = useState<PlanLekcija[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pregled" | "ocjene" | "kalendar" | "kvizovi">("pregled");
  const [currentMonth, setCurrentMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiRequest<ProfilData>("GET", "/ucenik/profil", undefined, token)
      .then(data => {
        setProfil(data);
        return Promise.all([
          apiRequest<KalendarEntry[]>("GET", "/ucenik/kalendar", undefined, token).catch(() => []),
          apiRequest<PlanLekcija[]>("GET", "/ucenik/plan-lekcija", undefined, token).catch(() => []),
        ]);
      })
      .then(([k, p]) => { setKalendar(k); setPlanLekcija(p); })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [token]);

  if (!user || user.role !== "ucenik") {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-muted-foreground font-medium">Pristup dozvoljen samo učenicima</p>
          <Button className="mt-4" onClick={() => setLocation("/")}>Nazad</Button>
        </div>
      </Layout>
    );
  }

  const monthNames = ["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"];

  function getDaysInMonth(year: number, month: number) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    let startWeekDay = firstDay.getDay();
    startWeekDay = startWeekDay === 0 ? 6 : startWeekDay - 1;
    const days: (number | null)[] = [];
    for (let i = 0; i < startWeekDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }

  function formatDate(year: number, month: number, day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const prisutnih = profil ? profil.prisustvo.filter(p => p.status === "prisutan").length : 0;
  const prosjecnaOcjena = profil && profil.ocjene.length ? (profil.ocjene.reduce((s, o) => s + o.ocjena, 0) / profil.ocjene.length).toFixed(1) : "—";

  const TABS = [
    { id: "pregled", label: "Pregled", icon: User },
    { id: "ocjene", label: "Ocjene", icon: Star },
    { id: "kalendar", label: "Kalendar", icon: Calendar },
    { id: "kvizovi", label: "Kvizovi", icon: ClipboardList },
  ] as const;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {isLoading ? (
          <div className="flex flex-col gap-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
        ) : !profil ? (
          <div className="text-center py-20 text-muted-foreground">Greška pri učitavanju profila</div>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-md">
                <User className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-extrabold text-foreground">{profil.user.displayName}</h1>
                <p className="text-muted-foreground text-sm">
                  {profil.grupa && <span className="font-medium">{profil.grupa.naziv}</span>}
                  {profil.muallim && <span> · Muallim: {profil.muallim.displayName}</span>}
                </p>
              </div>
              <Button variant="outline" className="rounded-xl" onClick={() => setLocation("/poruke")}>
                <MessageSquare className="w-4 h-4 mr-1" /> Poruke
              </Button>
            </div>

            <div className="flex gap-2 mb-6 flex-wrap">
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all border ${activeTab === tab.id ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-white border-border/60 text-muted-foreground hover:bg-muted"}`}>
                  <tab.icon className="w-4 h-4" /> {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "pregled" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: "Prosječna ocjena", value: prosjecnaOcjena, icon: Star, color: "text-amber-600", bg: "bg-amber-50" },
                    { label: "Prisustvo", value: profil.prisustvo.length ? `${prisutnih}/${profil.prisustvo.length}` : "—", icon: CalendarCheck, color: "text-emerald-600", bg: "bg-emerald-50" },
                    { label: "Kvizova završeno", value: profil.kvizovi.length, icon: ClipboardList, color: "text-primary", bg: "bg-primary/5" },
                    { label: "Ukupno ocjena", value: profil.ocjene.length, icon: BookOpen, color: "text-violet-600", bg: "bg-violet-50" },
                  ].map(stat => (
                    <div key={stat.label} className={`${stat.bg} border border-border/50 rounded-2xl p-4`}>
                      <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
                      <div className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</div>
                      <div className="text-xs text-muted-foreground font-medium mt-0.5">{stat.label}</div>
                    </div>
                  ))}
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white border border-border/50 rounded-2xl p-5">
                    <h3 className="font-extrabold text-foreground flex items-center gap-2 mb-3">
                      <Star className="w-4 h-4 text-amber-500" /> Posljednje ocjene
                    </h3>
                    {profil.ocjene.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Nema ocjena</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {profil.ocjene.slice(0, 8).map(o => (
                          <div key={o.id} className="flex items-center justify-between text-sm">
                            <div>
                              <span className="font-medium text-foreground capitalize">{o.kategorija}</span>
                              {o.lekcijaNaziv && <span className="text-primary text-xs ml-1">({o.lekcijaNaziv})</span>}
                              <div className="text-xs text-muted-foreground">{o.datum}</div>
                            </div>
                            <span className={`font-extrabold px-2.5 py-0.5 rounded-full text-sm ${OCJENA_COLORS[o.ocjena] || "bg-gray-100 text-gray-700"}`}>
                              {o.ocjena}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white border border-border/50 rounded-2xl p-5">
                    <h3 className="font-extrabold text-foreground flex items-center gap-2 mb-3">
                      <CalendarCheck className="w-4 h-4 text-primary" /> Posljednje prisustvo
                    </h3>
                    {profil.prisustvo.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Nema evidencije</p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {profil.prisustvo.slice(0, 10).map(p => (
                          <div key={p.id} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{p.datum}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status] || "bg-gray-100"}`}>{p.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "ocjene" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="bg-white border border-border/50 rounded-2xl p-5">
                  <h3 className="font-extrabold text-foreground flex items-center gap-2 mb-4">
                    <Star className="w-5 h-5 text-amber-500" /> Sve ocjene
                    <span className="ml-auto text-base font-medium text-muted-foreground">Prosjek: <span className="font-bold text-amber-600">{prosjecnaOcjena}</span></span>
                  </h3>
                  {profil.ocjene.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">Nema unesenih ocjena</p>
                  ) : (
                    <div className="space-y-2">
                      {profil.ocjene.map(o => (
                        <div key={o.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-xl">
                          <div>
                            <span className="font-bold text-foreground capitalize">{o.kategorija}</span>
                            {o.lekcijaNaziv && <span className="text-primary text-sm ml-2">({o.lekcijaNaziv})</span>}
                            {o.napomena && <span className="text-muted-foreground ml-2 text-sm">— {o.napomena}</span>}
                            <div className="text-xs text-muted-foreground mt-0.5">{o.datum}</div>
                          </div>
                          <span className={`text-lg font-extrabold px-3 py-1 rounded-full ${OCJENA_COLORS[o.ocjena] || "bg-gray-100 text-gray-700"}`}>
                            {o.ocjena}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === "kalendar" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="grid lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <div className="bg-white border border-border/50 rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <button onClick={() => setCurrentMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 })}
                          className="p-2 hover:bg-muted rounded-lg"><ChevronLeft className="w-5 h-5" /></button>
                        <h3 className="font-extrabold text-lg text-foreground">
                          {monthNames[currentMonth.month]} {currentMonth.year}
                        </h3>
                        <button onClick={() => setCurrentMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 })}
                          className="p-2 hover:bg-muted rounded-lg"><ChevronRight className="w-5 h-5" /></button>
                      </div>

                      <div className="grid grid-cols-7 gap-1">
                        {DAYS_BS.map(d => (
                          <div key={d} className="text-center text-xs font-extrabold text-muted-foreground py-2">{d}</div>
                        ))}
                        {getDaysInMonth(currentMonth.year, currentMonth.month).map((day, i) => {
                          if (day === null) return <div key={`e-${i}`} />;
                          const dateStr = formatDate(currentMonth.year, currentMonth.month, day);
                          const entry = kalendar.find(k => k.datum === dateStr);
                          const tipStyle = entry ? TIP_COLORS[entry.tip] : null;
                          const isSelected = selectedDate === dateStr;
                          const hasLekcije = planLekcija.some(p => p.datum === dateStr);

                          return (
                            <button key={dateStr} onClick={() => setSelectedDate(dateStr)}
                              className={`relative aspect-square rounded-xl text-sm font-bold transition-all flex flex-col items-center justify-center
                                ${isSelected ? "ring-2 ring-primary ring-offset-1" : ""}
                                ${tipStyle ? `${tipStyle.bg} ${tipStyle.text} border ${tipStyle.border}` : "hover:bg-muted/50 border border-transparent"}`}>
                              {day}
                              {hasLekcije && <div className="w-1.5 h-1.5 bg-violet-500 rounded-full absolute bottom-1" />}
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-200 border border-emerald-400" /> Mekteb</span>
                        <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-200 border border-red-400" /> Ferije</span>
                        <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-200 border border-blue-400" /> Važan datum</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    {selectedDate ? (
                      <div className="bg-white border border-border/50 rounded-2xl p-5">
                        <h4 className="font-extrabold text-foreground mb-3">{selectedDate}</h4>
                        {(() => {
                          const entry = kalendar.find(k => k.datum === selectedDate);
                          const lekcije = planLekcija.filter(p => p.datum === selectedDate);
                          return (
                            <div className="space-y-3">
                              {entry && (
                                <div className={`${TIP_COLORS[entry.tip]?.bg} rounded-lg px-3 py-2`}>
                                  <span className={`font-bold text-sm ${TIP_COLORS[entry.tip]?.text}`}>{TIP_COLORS[entry.tip]?.label}</span>
                                  {entry.opis && <p className="text-sm text-foreground mt-1">{entry.opis}</p>}
                                </div>
                              )}
                              {lekcije.length > 0 && (
                                <div>
                                  <h5 className="text-sm font-bold text-foreground mb-2 flex items-center gap-1">
                                    <BookOpen className="w-3.5 h-3.5 text-violet-500" /> Lekcije za ovaj dan
                                  </h5>
                                  <div className="space-y-1.5">
                                    {lekcije.map(l => (
                                      <div key={l.id} className="bg-violet-50 rounded-lg px-3 py-2 text-sm font-medium text-foreground">
                                        {l.lekcijaNaslov}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {!entry && lekcije.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-3">Nema informacija za ovaj dan</p>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="bg-white border border-border/50 rounded-2xl p-8 text-center">
                        <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">Klikni na dan za detalje</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "kvizovi" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="bg-white border border-border/50 rounded-2xl p-5">
                  <h3 className="font-extrabold text-foreground flex items-center gap-2 mb-4">
                    <ClipboardList className="w-5 h-5 text-primary" /> Historija kvizova
                  </h3>
                  {profil.kvizovi.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">Još nisi radio/la kvizove</p>
                  ) : (
                    <div className="space-y-2">
                      {profil.kvizovi.map(r => (
                        <div key={r.id} className="flex items-center gap-4 p-3 bg-muted/20 rounded-xl">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shrink-0 ${r.procenat >= 80 ? "bg-emerald-100 text-emerald-600" : r.procenat >= 50 ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-500"}`}>
                            {r.procenat}%
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-foreground truncate">{r.kvizNaslov}</p>
                            <p className="text-sm text-muted-foreground">
                              {r.tacniOdgovori}/{r.ukupnoPitanja} tačnih
                              {r.bodovi > 0 && <span className="ml-2 text-amber-600 font-bold">+{r.bodovi} hasanata</span>}
                            </p>
                          </div>
                          <div className="text-sm text-muted-foreground shrink-0">
                            {r.completedAt ? new Date(r.completedAt).toLocaleDateString("bs-BA") : "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
