import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface KalendarEntry {
  id: number;
  grupaId: number;
  datum: string;
  tip: string;
  opis?: string;
  grupaNaziv?: string | null;
}

const TIP_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  mekteb: { bg: "bg-emerald-100", border: "border-emerald-400", text: "text-emerald-700", label: "Mekteb" },
  ferije: { bg: "bg-red-100", border: "border-red-400", text: "text-red-700", label: "Ferije" },
  vazan_datum: { bg: "bg-blue-100", border: "border-blue-400", text: "text-blue-700", label: "Važan datum" },
  ramazan: { bg: "bg-purple-100", border: "border-purple-400", text: "text-purple-700", label: "Ramazan" },
};

const DAYS_BS = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];
const MJESEC_NAZIVI = ["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"];

export default function RoditeljKalendarPage() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [entries, setEntries] = useState<KalendarEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setIsLoading(true);
    apiRequest<KalendarEntry[]>("GET", "/roditelj/kalendar", undefined, token)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setIsLoading(false));
  }, [token]);

  // Group entries by date
  const entriesByDate = useMemo(() => {
    const map: Record<string, KalendarEntry[]> = {};
    entries.forEach(e => {
      if (!map[e.datum]) map[e.datum] = [];
      map[e.datum].push(e);
    });
    return map;
  }, [entries]);

  // Calendar grid
  const grid = useMemo(() => {
    const firstDay = new Date(viewDate.year, viewDate.month, 1);
    const lastDay = new Date(viewDate.year, viewDate.month + 1, 0);
    const dayOfWeek = (firstDay.getDay() + 6) % 7; // Pon=0..Ned=6
    const days: (string | null)[] = [];
    for (let i = 0; i < dayOfWeek; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${viewDate.year}-${String(viewDate.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push(dateStr);
    }
    return days;
  }, [viewDate]);

  function navigateMonth(delta: number) {
    setViewDate(v => {
      const newMonth = v.month + delta;
      if (newMonth < 0) return { year: v.year - 1, month: 11 };
      if (newMonth > 11) return { year: v.year + 1, month: 0 };
      return { year: v.year, month: newMonth };
    });
    setSelectedDate(null);
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const selectedEntries = selectedDate ? entriesByDate[selectedDate] || [] : [];

  // Upcoming events (next 30 days)
  const upcoming = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30 = new Date(today);
    in30.setDate(today.getDate() + 30);
    return entries
      .filter(e => {
        const d = new Date(e.datum);
        return d >= today && d <= in30;
      })
      .sort((a, b) => a.datum.localeCompare(b.datum))
      .slice(0, 8);
  }, [entries]);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => setLocation("/roditelj")}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-medium mb-6 text-sm transition-colors"
          data-testid="link-nazad"
        >
          <ArrowLeft className="w-4 h-4" /> {t("Nazad na panel")}
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-md">
            <Calendar className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">{t("Kalendar mekteba")}</h1>
            <p className="text-sm text-muted-foreground">{t("Datumi nastave, ferija i važnih dana za grupe vaše djece")}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-white border border-border/50 rounded-2xl p-8 text-center">
            <Calendar className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-bold text-foreground mb-1">{t("Nema unesenih datuma")}</p>
            <p className="text-sm text-muted-foreground">{t("Muallim još nije unio kalendar za grupe vaše djece.")}</p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Calendar grid */}
            <div className="bg-white border border-border/50 rounded-2xl p-4 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => navigateMonth(-1)}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  data-testid="btn-prev-month"
                  aria-label={t("Prethodni mjesec")}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="font-extrabold text-lg text-foreground">
                  {MJESEC_NAZIVI[viewDate.month]} {viewDate.year}
                </h3>
                <button
                  onClick={() => navigateMonth(1)}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  data-testid="btn-next-month"
                  aria-label={t("Sljedeći mjesec")}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAYS_BS.map(d => (
                  <div key={d} className="text-center text-xs font-bold text-muted-foreground py-1">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {grid.map((dateStr, i) => {
                  if (!dateStr) return <div key={i} className="aspect-square" />;
                  const dayEntries = entriesByDate[dateStr] || [];
                  const firstEntry = dayEntries[0];
                  const tipStyle = firstEntry ? TIP_COLORS[firstEntry.tip] : null;
                  const isToday = dateStr === todayStr;
                  const isSelected = dateStr === selectedDate;
                  const day = parseInt(dateStr.split("-")[2]);
                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                      data-testid={`day-${dateStr}`}
                      className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all ${
                        tipStyle
                          ? `${tipStyle.bg} ${tipStyle.text} font-bold border-2 ${tipStyle.border} hover:scale-105 cursor-pointer`
                          : "hover:bg-muted text-foreground/70"
                      } ${isToday ? "ring-2 ring-primary ring-offset-1" : ""} ${isSelected ? "ring-2 ring-foreground ring-offset-1" : ""}`}
                    >
                      <span>{day}</span>
                      {dayEntries.length > 1 && (
                        <span className="text-[9px] opacity-70">+{dayEntries.length - 1}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center flex-wrap gap-3 mt-4 pt-4 border-t border-border/40">
                {Object.entries(TIP_COLORS).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded ${val.bg} border-2 ${val.border}`} />
                    <span className="text-xs text-muted-foreground font-medium">{val.label}</span>
                  </div>
                ))}
              </div>

              {/* Selected date detail */}
              {selectedDate && selectedEntries.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/40 space-y-2">
                  <p className="text-xs text-muted-foreground font-bold mb-2">
                    {new Date(selectedDate).toLocaleDateString("bs-BA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </p>
                  {selectedEntries.map(entry => (
                    <div key={entry.id} className={`${TIP_COLORS[entry.tip]?.bg} rounded-lg px-3 py-2 border ${TIP_COLORS[entry.tip]?.border}`} data-testid={`entry-${entry.id}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className={`font-bold text-sm ${TIP_COLORS[entry.tip]?.text}`}>{TIP_COLORS[entry.tip]?.label}</span>
                        {entry.grupaNaziv && (
                          <span className="text-xs text-muted-foreground bg-white/60 rounded px-2 py-0.5 font-medium">{entry.grupaNaziv}</span>
                        )}
                      </div>
                      {entry.opis && <p className={`text-sm ${TIP_COLORS[entry.tip]?.text} mt-1`}>{entry.opis}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming */}
            {upcoming.length > 0 && (
              <div className="bg-white border border-border/50 rounded-2xl p-4 sm:p-6 shadow-sm">
                <h3 className="font-extrabold text-lg text-foreground mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" /> {t("Nadolazeći datumi")}
                </h3>
                <div className="space-y-2">
                  {upcoming.map(entry => {
                    const d = new Date(entry.datum);
                    const tipStyle = TIP_COLORS[entry.tip];
                    return (
                      <div key={entry.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 transition-colors" data-testid={`upcoming-${entry.id}`}>
                        <div className={`w-12 h-12 rounded-lg ${tipStyle?.bg} border ${tipStyle?.border} flex flex-col items-center justify-center flex-shrink-0`}>
                          <span className={`text-xs ${tipStyle?.text} font-bold leading-tight`}>{d.toLocaleDateString("bs-BA", { month: "short" })}</span>
                          <span className={`text-base ${tipStyle?.text} font-extrabold leading-tight`}>{d.getDate()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-bold ${tipStyle?.text}`}>{tipStyle?.label}</span>
                            {entry.grupaNaziv && (
                              <span className="text-xs text-muted-foreground bg-muted/60 rounded px-2 py-0.5 font-medium">{entry.grupaNaziv}</span>
                            )}
                          </div>
                          {entry.opis && <p className="text-xs text-muted-foreground truncate">{entry.opis}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
