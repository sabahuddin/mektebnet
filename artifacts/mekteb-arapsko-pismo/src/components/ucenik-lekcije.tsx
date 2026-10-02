import { useEffect, useState } from "react";
import { Link } from "wouter";
import { BookOpen, ClipboardList, Loader2, Search, Star } from "lucide-react";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Lesson {
  id: number;
  naslov: string;
  izvorniNaslov: string;
  nivo: number;
  slug: string;
  predmet?: string | null;
  dostupnost?: string;
}

interface Props {
  studentId: number;
  studentName: string;
  groupId: number | null;
  readOnly?: boolean;
  grades: Array<{ id: number; lekcijaNaziv?: string; ocjena: number | null; ocjenaOpisna?: "uradjeno" | "neuradjeno" | null; datum: string }>;
  onSaved: (kind: "grade" | "homework") => Promise<void>;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function UcenikLekcije({ studentId, studentName, groupId, readOnly = false, grades, onSaved }: Props) {
  const { token } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [level, setLevel] = useState(1);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<{ kind: "grade" | "homework"; lesson: Lesson } | null>(null);
  const [grade, setGrade] = useState("5");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setLessons([]);
    if (!token) return;
    apiRequest<Lesson[]>("GET", "/muallim/lekcije-za-plan", undefined, token)
      .then(data => { if (!cancelled) setLessons(data.filter(l => [1, 2, 3].includes(l.nivo) && Boolean(l.slug))); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, retry]);

  useEffect(() => {
    setAction(null);
    setLevel(1);
    setSearch("");
  }, [studentId]);

  const visible = lessons.filter(l => l.nivo === level && `${l.naslov} ${l.predmet ?? ""}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const canWrite = !readOnly && Boolean(groupId);

  function open(kind: "grade" | "homework", lesson: Lesson) {
    if (!canWrite) return;
    setGrade("5");
    setDate(today());
    setDeadline("");
    setNote("");
    setAction({ kind, lesson });
  }

  async function save() {
    if (!token || !action || !groupId || !canWrite || saving) return;
    const { kind, lesson } = action;
    const canonicalTitle = lesson.izvorniNaslov || lesson.naslov;
    setSaving(true);
    try {
      if (kind === "grade") {
        const descriptive = grade === "uradjeno" || grade === "neuradjeno";
        await apiRequest("POST", "/muallim/ocjene", {
          ucenikId: studentId, grupaId: groupId,
          lekcijaNaziv: canonicalTitle, lekcijaSlug: lesson.slug,
          ocjena: descriptive ? null : Number(grade),
          ocjenaOpisna: descriptive ? grade : null,
          datum: date, napomena: note.trim() || null,
        }, token);
      } else {
        await apiRequest("POST", "/muallim/zadace", {
          grupaId: groupId, ucenikIds: [studentId],
          naslov: canonicalTitle, lekcijaNaslov: canonicalTitle,
          lekcijaSlug: lesson.slug, lekcijaTip: "ilmihal",
          opis: note.trim() || null, rokDo: deadline || null, priloziIds: [],
        }, token);
      }
    } catch (err) {
      toast({ title: t("Greška"), description: err instanceof Error ? err.message : t("Nije moguće sačuvati"), variant: "destructive" });
      setSaving(false);
      return;
    }
    setAction(null);
    toast({ title: kind === "grade" ? t("Ocjena dodana!") : t("Zadaća dodana!") });
    try {
      await onSaved(kind);
    } catch {
      toast({ title: t("Podaci su sačuvani"), description: t("Prikaz nije osvježen. Ponovo otvorite profil učenika."), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="min-w-0 space-y-4 rounded-2xl border border-border/50 bg-white p-4 sm:p-5" data-testid="section-lekcije-ucenik">
      <h2 className="flex items-center gap-2 font-extrabold"><BookOpen className="h-5 w-5 text-primary" />{t("Lekcije")}</h2>
      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label={t("Nivoi lekcija")}>
        {[1, 2, 3].map(n => (
          <button key={n} type="button" role="tab" aria-selected={level === n} onClick={() => setLevel(n)}
            data-testid={`tab-lekcije-nivo-${n}`}
            className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors ${level === n ? "border-primary bg-primary text-primary-foreground" : "border-border/60 text-muted-foreground hover:bg-primary/5"}`}>
            {t("Nivo")} {n}
          </button>
        ))}
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} className="pl-9" placeholder={t("Pretraži lekcije")} aria-label={t("Pretraži lekcije")} />
      </div>
      {loading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        : error ? <div className="space-y-3 py-5 text-center"><p className="text-sm text-muted-foreground">{t("Lekcije nije moguće učitati.")}</p><Button variant="outline" onClick={() => setRetry(v => v + 1)}>{t("Pokušaj ponovo")}</Button></div>
        : visible.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{search.trim() ? t("Nema rezultata.") : t("Nema lekcija za ovaj nivo.")}</p>
        : <ul className="space-y-2">
          {visible.map(lesson => {
            const latestGrade = grades.filter(g => g.lekcijaNaziv?.trim() === (lesson.izvorniNaslov || lesson.naslov).trim())
              .sort((a, b) => b.datum.localeCompare(a.datum) || b.id - a.id)[0];
            const gradeLabel = latestGrade?.ocjena !== null && latestGrade?.ocjena !== undefined ? String(latestGrade.ocjena)
              : latestGrade?.ocjenaOpisna === "uradjeno" ? t("Urađeno") : latestGrade?.ocjenaOpisna === "neuradjeno" ? t("Neurađeno") : null;
            return (
            <li key={lesson.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/50 bg-muted/10 p-3" data-testid={`lesson-row-${lesson.id}`}>
              <div className="min-w-0 flex-1 basis-44">
                <Link href={`/ilmihal/${lesson.slug}`} className="block text-sm font-extrabold text-foreground hover:text-primary">{lesson.naslov}</Link>
                {lesson.predmet && <p className="mt-0.5 text-xs text-muted-foreground">{t(lesson.predmet)}</p>}
                {gradeLabel && <p className="mt-1 text-xs font-bold text-primary">{t("Posljednja ocjena")}: {gradeLabel}</p>}
                {lesson.dostupnost === "muallimi" && <p className="mt-0.5 text-xs text-muted-foreground">{t("Samo za muallime")}</p>}
              </div>
              {canWrite && <div className="flex shrink-0 items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => open("homework", lesson)} disabled={lesson.dostupnost === "muallimi"} data-testid={`btn-lekcija-zadaca-${lesson.id}`}>
                  <ClipboardList className="h-4 w-4" />{t("Zadaća")}
                </Button>
                <Button type="button" variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => open("grade", lesson)} data-testid={`btn-lekcija-ocjena-${lesson.id}`}>
                  <Star className="h-4 w-4" />{t("Ocjena")}
                </Button>
              </div>}
            </li>
            );
          })}
        </ul>}
      {!groupId && <p className="text-center text-xs text-muted-foreground">{t("Za dodavanje zadaće ili ocjene učenik mora pripadati grupi.")}</p>}
      <Dialog open={Boolean(action)} onOpenChange={open => { if (!open && !saving) setAction(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{action?.kind === "grade" ? t("Dodaj ocjenu") : t("Dodaj zadaću")}</DialogTitle>
            <DialogDescription className="sr-only">{studentName} · {action?.lesson.naslov}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); void save(); }}>
            <div className="rounded-xl bg-primary/5 p-3"><p className="text-sm font-extrabold">{studentName}</p><p className="mt-1 text-sm text-muted-foreground">{action?.lesson.naslov}</p></div>
            {action?.kind === "grade" ? <>
              <div className="space-y-1.5"><Label htmlFor="lesson-grade">{t("Ocjena")}</Label>
                <select id="lesson-grade" value={grade} onChange={e => setGrade(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                  <option value="uradjeno">{t("Urađeno")}</option><option value="neuradjeno">{t("Neurađeno")}</option>
                </select>
              </div>
              <div className="space-y-1.5"><Label htmlFor="lesson-grade-date">{t("Datum")}</Label><Input id="lesson-grade-date" type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
            </> : <div className="space-y-1.5"><Label htmlFor="lesson-homework-date">{t("Rok (opcionalno)")}</Label><Input id="lesson-homework-date" type="date" min={today()} value={deadline} onChange={e => setDeadline(e.target.value)} /></div>}
            <div className="space-y-1.5"><Label htmlFor="lesson-action-note">{action?.kind === "grade" ? t("Napomena") : t("Opis zadaće")}</Label><textarea id="lesson-action-note" rows={3} value={note} onChange={e => setNote(e.target.value)} className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
            <DialogFooter className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" disabled={saving} onClick={() => setAction(null)}>{t("Odustani")}</Button>
              <Button type="submit" disabled={saving || !canWrite}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("Sačuvaj")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}