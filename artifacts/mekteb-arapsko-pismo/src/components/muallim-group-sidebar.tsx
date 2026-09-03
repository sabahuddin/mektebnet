import { Link } from "wouter";
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  CalendarCheck,
  ClipboardList,
  FileText,
  Heart,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { useLanguage } from "@/context/language";

export type GroupModuleKey =
  | "ucenici"
  | "napamet"
  | "greske"
  | "plan"
  | "prisustvo"
  | "kalendar"
  | "statistika"
  | "zadace"
  | "izvjestaji"
  | "roditelji"
  | "h5p"
  | "podesavanja";

interface MuallimGroupSidebarProps {
  grupaId: number;
  activeModule?: GroupModuleKey;
  zadacaBadge?: number;
}

export function MuallimGroupSidebar({
  grupaId,
  activeModule,
  zadacaBadge = 0,
}: MuallimGroupSidebarProps) {
  const { t } = useLanguage();
  const modules = [
    { key: "ucenici" as const, label: t("Učenici"), icon: Users, href: `/muallim/grupa/${grupaId}` },
    { key: "napamet" as const, label: t("NAPAMET"), icon: BookOpen, href: `/muallim/grupa/${grupaId}?modul=napamet` },
    { key: "greske" as const, label: t("Gdje učenici griješe"), icon: AlertTriangle, href: `/muallim/grupa/${grupaId}?modul=greske` },
    { key: "plan" as const, label: t("Plan lekcija"), icon: BookOpen, href: `/muallim/grupa/${grupaId}?modul=plan` },
    { key: "prisustvo" as const, label: t("Prisustvo"), icon: CalendarCheck, href: `/muallim/prisustvo/${grupaId}` },
    { key: "kalendar" as const, label: t("Kalendar"), icon: Calendar, href: `/muallim?tab=kalendar&grupaId=${grupaId}` },
    { key: "statistika" as const, label: t("Statistika"), icon: TrendingUp, href: `/muallim?tab=statistika&grupaId=${grupaId}` },
    { key: "zadace" as const, label: t("Zadaća"), icon: ClipboardList, href: `/muallim?tab=zadace&grupaId=${grupaId}`, badge: zadacaBadge },
    { key: "izvjestaji" as const, label: t("Izvještaji"), icon: FileText, href: `/muallim/izvjestaj/grupa/${grupaId}` },
    { key: "roditelji" as const, label: t("Roditelji"), icon: Heart, href: `/muallim?tab=roditelji&grupaId=${grupaId}` },
    { key: "h5p" as const, label: t("H5P statistika"), icon: Sparkles, href: `/muallim/h5p-statistika?grupaId=${grupaId}` },
    { key: "podesavanja" as const, label: t("Podešavanja"), icon: Settings, href: `/muallim/grupa/${grupaId}/uredi` },
  ];

  return (
    <div className="rounded-2xl border border-border/50 bg-white/80 p-3">
      <p className="px-2 pb-2 text-xs font-black uppercase tracking-wide text-muted-foreground">{t("Moduli")}</p>
      <nav className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:gap-1.5 lg:overflow-visible lg:pb-0">
        {modules.map((module) => (
          <Link
            key={module.key}
            href={module.href}
            className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors lg:w-full ${
              activeModule === module.key
                ? "border-emerald-500 bg-emerald-100 text-emerald-900 shadow-sm"
                : "border-border/60 bg-white text-foreground hover:border-emerald-300 hover:bg-emerald-50"
            }`}
          >
            <module.icon className={`h-4 w-4 shrink-0 ${activeModule === module.key ? "text-emerald-700" : "text-muted-foreground"}`} />
            <span className="truncate">{module.label}</span>
            {(module.badge ?? 0) > 0 && (
              <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-black text-white shadow-md">
                {module.badge}
              </span>
            )}
          </Link>
        ))}
      </nav>
    </div>
  );
}