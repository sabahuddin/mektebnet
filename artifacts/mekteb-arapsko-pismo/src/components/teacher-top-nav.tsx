import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { BookOpen, ChevronRight, LayoutDashboard, Search, Users, Building2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";

export interface NavPupil { id: number; displayName: string; username: string; grupaIme?: string | null }
export interface NavLesson { id: number; naslov: string; slug?: string | null; nivo: number | string }

export interface TeacherTopNavProps {
  /** Ako je zadano, komponenta ne dohvaća meta podatke. */
  isGlavni?: boolean;
  scope?: "moje" | "mekteb";
  pupils?: NavPupil[];
  lessons?: NavLesson[];
  /** Zamjena za default navigaciju (index.tsx resetira stanje). */
  onMoje?: () => void;
  onMekteb?: () => void;
  /** Sakrij ako je muallim preview (glavni gleda drugog muallima). */
  hideMekteb?: boolean;
}

export function PanelGrupeLink({ grupaId }: { grupaId: number }) {
  const { t } = useLanguage();
  return (
    <Link
      href={`/muallim/grupa/${grupaId}`}
      className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 text-sm font-extrabold text-emerald-800 hover:bg-emerald-100"
      data-testid="link-panel-grupe"
    >
      <LayoutDashboard className="h-4 w-4 shrink-0" />
      <span className="truncate">{t("Panel grupe")}</span>
    </Link>
  );
}

export function TeacherTopNav(props: TeacherTopNavProps) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const [, setLocation] = useLocation();
  const [meta, setMeta] = useState<boolean | null>(null);
  const [pupils, setPupils] = useState<NavPupil[]>([]);
  const [lessons, setLessons] = useState<NavLesson[]>([]);
  const [q, setQ] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const standalone = props.pupils === undefined;

  useEffect(() => {
    if (!token || !standalone) return;
    let cancelled = false;
    setLoading(true); setLoadError(false); setMeta(null); setPupils([]); setLessons([]);
    Promise.all([
      apiRequest<{ isGlavni: boolean }>("GET", "/muallim/info", undefined, token),
      apiRequest<NavPupil[]>("GET", "/muallim/ucenici", undefined, token),
      apiRequest<NavLesson[]>("GET", "/muallim/lekcije-za-plan", undefined, token),
    ]).then(([info, studentRows, lessonRows]) => {
      if (!cancelled) { setMeta(!!info.isGlavni); setPupils(studentRows); setLessons(lessonRows); }
    }).catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, standalone, retry]);

  const isGlavni = props.isGlavni ?? meta ?? false;
  const showMekteb = isGlavni && !props.hideMekteb;
  const allPupils = props.pupils ?? pupils;
  const allLessons = props.lessons ?? lessons;
  const qq = q.trim().toLocaleLowerCase();
  const rp = qq.length < 2 ? [] : allPupils.filter(u => `${u.displayName} ${u.username} ${u.grupaIme || ""}`.toLocaleLowerCase().includes(qq)).slice(0, 8);
  const rl = qq.length < 2 ? [] : allLessons.filter(l => `${l.naslov} ${l.slug || ""}`.toLocaleLowerCase().includes(qq)).slice(0, 8);

  const goMoje = () => (props.onMoje ? props.onMoje() : setLocation("/muallim?tab=pregled"));
  const goMekteb = () => (props.onMekteb ? props.onMekteb() : setLocation("/muallim?tab=ucenici"));
  const btn = (active: boolean) =>
    `flex h-10 min-w-0 items-center justify-center gap-2 rounded-xl border px-2 text-sm font-extrabold transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-border/60 bg-white text-foreground hover:bg-muted"}`;

  return (
    <div className="mb-2 space-y-1.5 rounded-2xl border border-border/50 bg-white/80 p-2" data-testid="teacher-top-nav">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={t("Pretraga učenika i lekcija")}
          aria-label={t("Pretraži učenike i lekcije")}
          className="h-10 w-full min-w-0 rounded-xl border border-border/60 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          data-testid="muallim-brza-pretraga"
        />
        {qq.length >= 2 && (
          <div className="absolute left-0 right-0 z-40 mt-1 overflow-hidden rounded-xl border border-border bg-white shadow-xl">
            {standalone && loading ? <p className="px-3 py-3 text-sm text-muted-foreground">{t("Učitavanje...")}</p> : loadError ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">{t("Pretragu nije moguće učitati.")}</p>
            ) : rp.length === 0 && rl.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">{t("Nema rezultata.")}</p>
            ) : (
              <div className="max-h-[min(60vh,24rem)] overflow-y-auto p-1.5">
                {rp.map(u => (
                  <button key={`u-${u.id}`} type="button" onClick={() => { setQ(""); setLocation(`/muallim/ucenik/${u.id}`); }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-primary/5">
                    <Users className="h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{u.displayName}</span>
                      <span className="block truncate text-xs text-muted-foreground">@{u.username}{u.grupaIme ? ` · ${u.grupaIme}` : ""}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
                {rl.map(l => (
                  <button key={`l-${l.id}`} type="button" onClick={() => { setQ(""); if (l.slug) setLocation(`/ilmihal/${l.slug}`); }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-primary/5">
                    <BookOpen className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{l.naslov}</span>
                      <span className="block text-xs text-muted-foreground">{t("Nivo")} {l.nivo}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {loadError && <button type="button" onClick={() => setRetry(v => v + 1)} className="w-full text-center text-xs font-bold text-primary">{t("Pokušaj ponovo")}</button>}
      <div className={`grid gap-1.5 ${showMekteb ? "grid-cols-2" : "grid-cols-1"}`}>
        <button type="button" onClick={goMoje} className={btn(props.scope === "moje")} data-testid="nav-moje-grupe">
          <Users className="h-4 w-4 shrink-0" /><span className="truncate">{t("Moje grupe")}</span>
        </button>
        {showMekteb && (
          <button type="button" onClick={goMekteb} className={btn(props.scope === "mekteb")} data-testid="nav-mekteb">
            <Building2 className="h-4 w-4 shrink-0" /><span className="truncate">{t("Mekteb")}</span>
          </button>
        )}
      </div>
    </div>
  );
}
