import { useEffect, useRef, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import type { NapametStavka } from "@/components/NapametPregled";

type ProgramStavka = NapametStavka & { isVisible?: boolean; sourceLessonSlug?: string | null };
type LessonOption = { id: number; slug: string; naslov: string; nivo: number; redoslijed: number };

export function NapametGlobalProgramEditor() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [katalog, setKatalog] = useState<ProgramStavka[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [naziv, setNaziv] = useState("");
  const [nivo, setNivo] = useState(1);
  const [lekcije, setLekcije] = useState<LessonOption[]>([]);
  const [sourceLessonSlug, setSourceLessonSlug] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingNivo, setDraggingNivo] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const katalogRef = useRef<ProgramStavka[]>([]);
  const dragRef = useRef<{ id: string; nivo: number; pointerId: number; cleanup: () => void } | null>(null);

  useEffect(() => {
    katalogRef.current = katalog;
  }, [katalog]);

  useEffect(() => () => dragRef.current?.cleanup(), []);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [data, lessonData] = await Promise.all([
        apiRequest<{ katalog: ProgramStavka[] }>("GET", "/admin/napamet-program", undefined, token),
        apiRequest<LessonOption[]>("GET", "/admin/ilmihal/lista", undefined, token),
      ]);
      setKatalog(data.katalog);
      setLekcije(lessonData);
    } catch (error: any) {
      toast({ title: t("Greška"), description: error?.message || t("Nije moguće učitati globalni Napamet katalog"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [token]);

  const update = async (item: ProgramStavka, patch: Record<string, unknown>) => {
    if (!token) return;
    setSaving(true);
    try {
      const updated = await apiRequest<ProgramStavka>("PUT", `/admin/napamet-program/${encodeURIComponent(item.id)}`, patch, token);
      setKatalog((items) => items.map((current) => current.id === item.id ? { ...current, ...updated } : current));
    } catch (error: any) {
      toast({ title: t("Greška"), description: error?.message || t("Nije moguće sačuvati stavku"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveOrder = async (next: ProgramStavka[]) => {
    if (!token) return;
    setSaving(true);
    try {
      const data = await apiRequest<{ katalog: ProgramStavka[] }>("PUT", "/admin/napamet-program-redoslijed", {
        stavke: next.map((item) => ({ id: item.id, nivo: item.nivo, redoslijed: item.redoslijed })),
      }, token);
      setKatalog(data.katalog);
    } catch (error: any) {
      toast({ title: t("Greška"), description: error?.message || t("Nije moguće sačuvati redoslijed"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const reorder = async (targetNivo: number, index: number, delta: -1 | 1) => {
    const section = katalog.filter((item) => item.nivo === targetNivo).sort((a, b) => a.redoslijed - b.redoslijed);
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= section.length) return;
    [section[index], section[nextIndex]] = [section[nextIndex], section[index]];
    const orders = new Map(section.map((item, order) => [item.id, order + 1]));
    const next = katalog.map((item) => orders.has(item.id) ? { ...item, redoslijed: orders.get(item.id)! } : item);
    await saveOrder(next);
  };

  const finishDrag = async (sourceId: string, sourceNivo: number, targetId: string | null) => {
    if (!targetId || targetId === sourceId) {
      setDraggingId(null);
      setDraggingNivo(null);
      setDragOverId(null);
      return;
    }
    const section = katalogRef.current.filter((item) => item.nivo === sourceNivo).sort((a, b) => a.redoslijed - b.redoslijed);
    const fromIndex = section.findIndex((item) => item.id === sourceId);
    const toIndex = section.findIndex((item) => item.id === targetId);
    if (fromIndex < 0 || toIndex < 0) {
      setDraggingId(null);
      setDraggingNivo(null);
      setDragOverId(null);
      return;
    }
    const [moved] = section.splice(fromIndex, 1);
    section.splice(fromIndex < toIndex ? toIndex - 1 : toIndex, 0, moved);
    const orders = new Map(section.map((item, order) => [item.id, order + 1]));
    const next = katalogRef.current.map((item) => orders.has(item.id) ? { ...item, redoslijed: orders.get(item.id)! } : item);
    setDraggingId(null);
    setDraggingNivo(null);
    setDragOverId(null);
    await saveOrder(next);
  };

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>, item: ProgramStavka, sectionNivo: number) => {
    if (saving || !event.isPrimary) return;
    event.preventDefault();
    dragRef.current?.cleanup();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingId(item.id);
    setDraggingNivo(sectionNivo);
    setDragOverId(item.id);

    const findTargetId = (clientX: number, clientY: number) => {
      const target = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-napamet-id]");
      return target?.dataset.napametNivo === String(sectionNivo) ? target.dataset.napametId || null : null;
    };
    const onMove = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== event.pointerId) return;
      const targetId = findTargetId(pointerEvent.clientX, pointerEvent.clientY);
      if (targetId) setDragOverId(targetId);
    };
    const complete = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== event.pointerId) return;
      const targetId = pointerEvent.type === "pointerup"
        ? findTargetId(pointerEvent.clientX, pointerEvent.clientY)
        : null;
      cleanup();
      void finishDrag(item.id, sectionNivo, targetId);
    };
    const cleanup = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", complete);
      document.removeEventListener("pointercancel", complete);
      if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
    };
    dragRef.current = { id: item.id, nivo: sectionNivo, pointerId: event.pointerId, cleanup };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", complete);
    document.addEventListener("pointercancel", complete);
  };

  const deleteItem = async (item: ProgramStavka) => {
    if (!token || !window.confirm(t('Obrisati Napamet stavku "{naziv}"?', { naziv: item.naziv }))) return;
    setSaving(true);
    try {
      await apiRequest("DELETE", `/admin/napamet-program/${encodeURIComponent(item.id)}`, undefined, token);
      setKatalog((items) => items.filter((current) => current.id !== item.id));
      toast({ title: t("Stavka obrisana"), description: item.naziv });
    } catch (error: any) {
      toast({ title: t("Greška"), description: error?.message || t("Nije moguće obrisati stavku"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const add = async () => {
    if (!token || (!naziv.trim() && !sourceLessonSlug)) return;
    setSaving(true);
    try {
      const selectedLesson = lekcije.find((lesson) => lesson.slug === sourceLessonSlug);
      await apiRequest("POST", "/admin/napamet-program", {
        naziv: naziv.trim() || selectedLesson?.naslov,
        nivo: selectedLesson?.nivo ?? nivo,
        sourceLessonSlug: sourceLessonSlug || undefined,
        redoslijed: 9999,
      }, token);
      setNaziv("");
      setSourceLessonSlug("");
      await load();
    } catch (error: any) {
      toast({ title: t("Greška"), description: error?.message || t("Nije moguće dodati stavku"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white border border-emerald-200 rounded-2xl p-5 space-y-4" data-testid="napamet-globalni-program">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700"><BookOpen className="w-5 h-5" /></div>
        <div>
          <h2 className="font-extrabold text-foreground">{t("Globalni Napamet katalog")}</h2>
          <p className="text-sm text-muted-foreground">{t("Admin priprema zajedničke sure i dove za sve mektebe. Muallimovi ručni dodaci ostaju lokalni njihovoj grupi.")}</p>
        </div>
      </div>
      {loading ? <div className="py-5 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div> : [1, 2, 3, 4].map((sectionNivo) => {
        const items = katalog.filter((item) => item.nivo === sectionNivo).sort((a, b) => a.redoslijed - b.redoslijed);
        return <div key={sectionNivo} className="space-y-2">
          <h3 className="text-xs font-black uppercase tracking-wide text-emerald-800">{sectionNivo === 4 ? t("Dodatak") : `${t("Napamet")} ${sectionNivo}. ${t("nivo")}`}</h3>
          {items.map((item, index) => <div key={item.id}
            data-napamet-id={item.id}
            data-napamet-nivo={sectionNivo}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${dragOverId === item.id ? "border-emerald-500 ring-2 ring-emerald-200" : ""} ${draggingId === item.id ? "opacity-50" : ""} ${item.isVisible === false ? "bg-slate-100 opacity-60" : "bg-white"}`}>
            <div className="flex flex-col">
              <button type="button" disabled={saving} aria-label={t("Povuci za promjenu redoslijeda")}
                onPointerDown={(event) => startDrag(event, item, sectionNivo)}
                className="touch-none select-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-emerald-700 p-1">
                <GripVertical className="w-4 h-4" />
              </button>
              <button type="button" disabled={saving || index === 0} aria-label={t("Pomjeri gore")} onClick={() => void reorder(sectionNivo, index, -1)} className="text-muted-foreground disabled:opacity-30"><ChevronUp className="w-3 h-3" /></button>
              <button type="button" disabled={saving || index === items.length - 1} aria-label={t("Pomjeri dolje")} onClick={() => void reorder(sectionNivo, index, 1)} className="text-muted-foreground disabled:opacity-30"><ChevronDown className="w-3 h-3" /></button>
            </div>
            <div className="min-w-0 flex-1">
              <input defaultValue={item.naziv} aria-label={t("Naziv stavke")} onBlur={(event) => {
                const value = event.target.value.trim();
                if (value && value !== item.naziv) void update(item, { naziv: value });
              }} className="w-full rounded-lg border border-border px-3 py-1.5 text-sm font-semibold" />
              {item.sourceLessonSlug && <p className="text-[11px] text-muted-foreground mt-1">/{item.sourceLessonSlug}</p>}
            </div>
            <select value={item.nivo} disabled={saving} onChange={(event) => void update(item, { nivo: Number(event.target.value) })} className="rounded-lg border border-border px-2 py-1.5 text-sm">
              {[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <button type="button" disabled={saving} onClick={() => void update(item, { isVisible: item.isVisible === false })} className={`rounded-lg px-2 py-1.5 text-xs font-bold ${item.isVisible === false ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
              {item.isVisible === false ? t("Prikaži") : t("Sakrij")}
            </button>
            <button type="button" disabled={saving} onClick={() => void deleteItem(item)} aria-label={t("Obriši stavku")} className="rounded-lg p-2 text-red-500 hover:bg-red-50 hover:text-red-700">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>)}
        </div>;
      })}
      <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-border">
        <select value={sourceLessonSlug} onChange={(event) => {
          const slug = event.target.value;
          const lesson = lekcije.find((item) => item.slug === slug);
          setSourceLessonSlug(slug);
          if (lesson) { setNaziv(lesson.naslov); setNivo(lesson.nivo); }
        }} className="flex-1 rounded-xl border border-border px-3 py-2 text-sm">
          <option value="">{t("Odaberi postojeću Ilmihal lekciju (opciono)")}</option>
          {lekcije.map((lesson) => <option key={lesson.id} value={lesson.slug}>{lesson.naslov} — {t("nivo")} {lesson.nivo}</option>)}
        </select>
        <input value={naziv} onChange={(event) => setNaziv(event.target.value)} placeholder={t("Ili upiši novu globalnu stavku")} className="flex-1 rounded-xl border border-border px-3 py-2 text-sm" />
        <select value={nivo} onChange={(event) => setNivo(Number(event.target.value))} className="rounded-xl border border-border px-3 py-2 text-sm">
          {[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value === 4 ? t("Dodatak") : `${t("Nivo")} ${value}`}</option>)}
        </select>
        <Button size="sm" onClick={() => void add()} disabled={saving || !naziv.trim()} className="rounded-xl"><Plus className="w-4 h-4 mr-1" /> {t("Dodaj")}</Button>
      </div>
    </section>
  );
}