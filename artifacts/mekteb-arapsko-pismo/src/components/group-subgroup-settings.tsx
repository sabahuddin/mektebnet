import { useEffect, useState } from "react";
import { Loader2, Save, Users } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface Podgrupa {
  id?: number;
  naziv: string;
  ucenikIds: number[];
}

interface Ucenik {
  id: number;
  displayName: string;
}

interface GroupSubgroupSettingsProps {
  grupaId: number;
  refreshKey: number;
}

const praznePodgrupe: Podgrupa[] = [
  { naziv: "A", ucenikIds: [] },
  { naziv: "B", ucenikIds: [] },
];

export function GroupSubgroupSettings({ grupaId, refreshKey }: GroupSubgroupSettingsProps) {
  const { token } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [podgrupe, setPodgrupe] = useState<Podgrupa[]>(praznePodgrupe);
  const [ucenici, setUcenici] = useState<Ucenik[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    Promise.all([
      apiRequest<Podgrupa[]>("GET", `/muallim/grupe/${grupaId}/podgrupe`, undefined, token),
      apiRequest<Ucenik[]>("GET", `/muallim/grupa/${grupaId}/ucenici`, undefined, token),
    ]).then(([loadedPodgrupe, loadedUcenici]) => {
      if (!active) return;
      const configured = loadedPodgrupe.length === 2;
      setEnabled(configured);
      setPodgrupe(configured
        ? loadedPodgrupe.map((podgrupa, index) => ({
          ...podgrupa,
          naziv: podgrupa.naziv || (index === 0 ? "A" : "B"),
          ucenikIds: podgrupa.ucenikIds || [],
        }))
        : praznePodgrupe.map(podgrupa => ({ ...podgrupa, ucenikIds: [] })));
      setUcenici(loadedUcenici);
    }).catch(() => {
      if (active) toast({ title: t("Greška"), description: t("Nije moguće učitati podgrupe"), variant: "destructive" });
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [token, grupaId, refreshKey]);

  function setStudentPodgrupa(ucenikId: number, index: number | null) {
    setPodgrupe(current => current.map((podgrupa, podgrupaIndex) => ({
      ...podgrupa,
      ucenikIds: index === podgrupaIndex
        ? Array.from(new Set([...podgrupa.ucenikIds, ucenikId]))
        : podgrupa.ucenikIds.filter(id => id !== ucenikId),
    })));
  }

  async function save() {
    if (!token || !enabled) return;
    if (podgrupe.some(podgrupa => !podgrupa.naziv.trim())) {
      toast({ title: t("Unesite naziv za obje podgrupe"), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await apiRequest("PUT", `/muallim/grupe/${grupaId}/podgrupe`, {
        podgrupe: podgrupe.map(podgrupa => ({
          ...(podgrupa.id !== undefined ? { id: podgrupa.id } : {}),
          naziv: podgrupa.naziv.trim(),
          ucenikIds: podgrupa.ucenikIds,
        })),
      }, token);
      const saved = await apiRequest<Podgrupa[]>("GET", `/muallim/grupe/${grupaId}/podgrupe`, undefined, token);
      setPodgrupe(saved);
      toast({ title: t("Podgrupe su sačuvane") });
    } catch {
      toast({ title: t("Greška"), description: t("Nije moguće sačuvati podgrupe"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const subgroupForStudent = (studentId: number) => {
    const index = podgrupe.findIndex(podgrupa => podgrupa.ucenikIds.includes(studentId));
    return index < 0 ? "" : String(index);
  };

  return (
    <section className="bg-white border border-border/50 rounded-2xl p-4 sm:p-6 space-y-4">
      <div>
        <h2 className="font-extrabold text-foreground flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          {t("Podgrupe")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("Podijelite učenike ove grupe u dvije podgrupe za dodjelu zadaća.")}
        </p>
      </div>
      {loading ? (
        <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : !enabled ? (
        <Button type="button" variant="outline" onClick={() => setEnabled(true)} className="rounded-xl font-bold">
          {t("Omogući podgrupe A i B")}
        </Button>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            {podgrupe.map((podgrupa, index) => (
              <div key={podgrupa.id ?? index} className="rounded-xl border border-border/70 p-3 space-y-2">
                <label className="text-sm font-bold text-foreground block">
                  {t("Naziv podgrupe {n}", { n: String(index + 1) })}
                </label>
                <input
                  value={podgrupa.naziv}
                  onChange={event => setPodgrupe(current => current.map((item, i) => i === index ? { ...item, naziv: event.target.value } : item))}
                  maxLength={60}
                  className="w-full border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 bg-muted/20"
                  data-testid={`input-podgrupa-name-${index + 1}`}
                />
                <p className="text-xs font-bold text-muted-foreground">
                  {t("{n} učenika", { n: String(podgrupa.ucenikIds.length) })}
                </p>
              </div>
            ))}
          </div>
          {ucenici.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("U ovoj grupi nema učenika.")}</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-bold text-foreground">{t("Raspored učenika")}</p>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {ucenici.map(ucenik => (
                  <label key={ucenik.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/20 px-3 py-2">
                    <span className="text-sm font-medium text-foreground truncate">{ucenik.displayName}</span>
                    <select
                      value={subgroupForStudent(ucenik.id)}
                      onChange={event => setStudentPodgrupa(ucenik.id, event.target.value === "" ? null : Number(event.target.value))}
                      className="max-w-[55%] border border-border rounded-lg px-2 py-1.5 text-sm bg-white"
                      data-testid={`select-student-subgroup-${ucenik.id}`}
                    >
                      <option value="">{t("Neraspoređen")}</option>
                      {podgrupe.map((podgrupa, index) => (
                        <option key={podgrupa.id ?? index} value={index}>{podgrupa.naziv || t("Podgrupa {n}", { n: String(index + 1) })}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          )}
          <Button type="button" onClick={save} disabled={saving || podgrupe.some(podgrupa => !podgrupa.naziv.trim())} className="w-full rounded-xl font-bold">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {saving ? t("Spremanje...") : t("Sačuvaj podgrupe")}
          </Button>
        </>
      )}
    </section>
  );
}