import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import type { NapametStavka } from "@/components/NapametPregled";

type LokalnaStavka = NapametStavka & { isVisible?: boolean; canEdit?: boolean; canReorder?: boolean; canDelete?: boolean };

function NapametUceniciLinija({ item, compact = false }: { item: NapametStavka; compact?: boolean }) {
  const { t } = useLanguage();
  if (typeof item.ukupnoUcenika !== "number") return null;
  const ukupno = Math.max(0, item.ukupnoUcenika);
  const naucilo = Math.min(ukupno, Math.max(0, item.ocijenjenoUcenika ?? 0));
  const nijeNaucilo = Math.max(0, ukupno - naucilo);
  const procenat = ukupno ? (naucilo / ukupno) * 100 : 0;

  return <div className={compact ? "w-28 shrink-0" : "mt-2 w-full"}>
    <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-extrabold">
      <span className="text-emerald-700">{t("Naučeno")}: {naucilo}</span>
      <span className="text-red-600">{t("Još nije naučeno")}: {nijeNaucilo}</span>
    </div>
    <div
      className="flex h-2 w-full overflow-hidden rounded-full bg-red-500"
      role="img"
      aria-label={`${t("Naučeno")}: ${naucilo}. ${t("Još nije naučeno")}: ${nijeNaucilo}.`}
    >
      <div className="h-full bg-emerald-500" style={{ width: `${procenat}%` }} />
    </div>
  </div>;
}

export function NapametLokalniProgramEditor({
  grupaId,
  globalItems = [],
  onChanged,
  onItemClick,
}: {
  grupaId: number;
  globalItems?: NapametStavka[];
  onChanged?: () => void;
  onItemClick?: (item: NapametStavka) => void;
}) {
  const { token } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [globalOpen, setGlobalOpen] = useState<Record<number, boolean>>({
    1: true,
    2: false,
    3: false,
    4: false,
  });
  const [items, setItems] = useState<LokalnaStavka[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [naziv, setNaziv] = useState("");
  const [nivo, setNivo] = useState(4);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!token || !grupaId) return;
    try {
      const data = await apiRequest<{ katalog: LokalnaStavka[]; canManage?: boolean }>("GET", `/muallim/napamet-lokalno?grupaId=${grupaId}`, undefined, token);
      setItems(data.katalog);
      setCanManage(data.canManage === true);
    } catch (error: any) {
      toast({ title: t("Greška"), description: error?.message || t("Nije moguće učitati lokalne stavke"), variant: "destructive" });
    }
  };
  useEffect(() => { if (open) void load(); }, [token, grupaId, open]);

  const update = async (item: LokalnaStavka, patch: Record<string, unknown>) => {
    if (!token) return;
    setSaving(true);
    try {
      const result = await apiRequest<LokalnaStavka>("PUT", `/muallim/napamet-lokalno/${encodeURIComponent(item.id)}?grupaId=${grupaId}`, patch, token);
      setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, ...result } : candidate));
      onChanged?.();
    } catch (error: any) {
      toast({ title: t("Greška"), description: error?.message || t("Nije moguće sačuvati stavku"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const add = async () => {
    if (!token || !naziv.trim()) return;
    setSaving(true);
    try {
      const item = await apiRequest<LokalnaStavka>("POST", "/muallim/napamet-lokalno", { grupaId, naziv: naziv.trim(), nivo, redoslijed: 9999 }, token);
      setItems((current) => [...current, item]);
      setNaziv("");
      onChanged?.();
    } catch (error: any) {
      toast({ title: t("Greška"), description: error?.message || t("Nije moguće dodati stavku"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const reorder = async (sectionNivo: number, index: number, delta: -1 | 1) => {
    if (!token) return;
    const section = items.filter((item) => item.nivo === sectionNivo).sort((a, b) => a.redoslijed - b.redoslijed);
    const target = index + delta;
    if (target < 0 || target >= section.length) return;
    [section[index], section[target]] = [section[target], section[index]];
    const orders = new Map(section.map((item, position) => [item.id, position + 1]));
    setSaving(true);
    try {
      const result = await apiRequest<{ katalog: LokalnaStavka[] }>("PUT", "/muallim/napamet-lokalno-redoslijed", {
        grupaId, stavke: items.map((item) => ({ id: item.id, nivo: item.nivo, redoslijed: orders.get(item.id) ?? item.redoslijed })),
      }, token);
      setItems(result.katalog);
      onChanged?.();
    } catch (error: any) {
      toast({ title: t("Greška"), description: error?.message || t("Nije moguće sačuvati redoslijed"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: LokalnaStavka) => {
    if (!token || !item.canDelete) return;
    if (!window.confirm(t("Obrisati ovu Napamet stavku?"))) return;
    setSaving(true);
    try {
      await apiRequest("DELETE", `/muallim/napamet-lokalno/${encodeURIComponent(item.id)}?grupaId=${grupaId}`, undefined, token);
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
      onChanged?.();
      toast({ title: t("Stavka je obrisana") });
    } catch (error: any) {
      toast({ title: t("Greška"), description: error?.message || t("Nije moguće obrisati stavku"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return <section className="mb-6 space-y-3" data-testid="napamet-lokalne-stavke">
    {globalItems.length > 0 && [1, 2, 3, 4].map((sectionNivo) => {
      const section = globalItems.filter((item) => item.nivo === sectionNivo).sort((a, b) => a.redoslijed - b.redoslijed);
      if (!section.length) return null;
      const sectionOpen = !!globalOpen[sectionNivo];
      const title = sectionNivo === 4 ? `${t("Napamet")} – ${t("Dodatak")}` : `${t("Napamet")} – ${t("Nivo")} ${sectionNivo}`;
      return <div key={sectionNivo} className="overflow-hidden rounded-2xl border border-emerald-200 bg-white">
        <button
          type="button"
          className="flex w-full items-center justify-between bg-emerald-50/70 px-5 py-4 text-left transition-colors hover:bg-emerald-100/70"
          onClick={() => setGlobalOpen((current) => ({ ...current, [sectionNivo]: !sectionOpen }))}
          aria-expanded={sectionOpen}
        >
          <h2 className="text-lg font-extrabold text-emerald-950">{title}</h2>
          <ChevronDown className={`h-5 w-5 text-emerald-700 transition-transform ${sectionOpen ? "rotate-180" : ""}`} />
        </button>
        {sectionOpen && <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2">
          {section.map((item) => <button
            type="button"
            key={item.id}
            onClick={() => onItemClick?.(item)}
            className="min-w-0 rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-left text-sm font-semibold leading-snug text-emerald-950 transition-colors hover:border-emerald-300 hover:bg-emerald-100"
          >
            <span className="block text-base">{t(item.naziv)}</span>
            <NapametUceniciLinija item={item} />
          </button>)}
        </div>}
      </div>;
    })}

    <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white">
      <button type="button" className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-emerald-50/40" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <div><h3 className="font-extrabold text-emerald-950">{t("Stavke za ovaj mekteb")}</h3><p className="text-xs text-muted-foreground mt-1">{t("Dodane stavke vide muallimi, učenici i povezani roditelji ovog mekteba. Dodaje, uređuje i briše ih glavni imam.")}</p></div>
        <ChevronDown className={`w-5 h-5 text-emerald-700 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="space-y-4 border-t border-emerald-100 p-4">
        {[1, 2, 3, 4].map((sectionNivo) => {
          const section = items.filter((item) => item.nivo === sectionNivo).sort((a, b) => a.redoslijed - b.redoslijed);
          return section.length ? <div key={sectionNivo} className="space-y-2">
            <h3 className="text-sm font-black uppercase text-emerald-800">{sectionNivo === 4 ? t("Dodatak") : `${t("Napamet")} – ${t("Nivo")} ${sectionNivo}`}</h3>
            <div className="grid grid-cols-1 gap-2">
              {section.map((item, index) => <div key={item.id} onClick={(event) => {
                if ((event.target as HTMLElement).closest("button, input, select")) return;
                onItemClick?.(item);
              }} className={`flex w-full flex-wrap items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/40 px-4 py-3 sm:flex-nowrap ${item.isVisible === false ? "opacity-60 bg-slate-50" : ""}`}>
                <div className="flex flex-col">
                  <button disabled={saving || !item.canReorder || index === 0} onClick={() => void reorder(sectionNivo, index, -1)} aria-label={t("Pomjeri gore")}><ChevronUp className="w-4 h-4" /></button>
                  <button disabled={saving || !item.canReorder || index === section.length - 1} onClick={() => void reorder(sectionNivo, index, 1)} aria-label={t("Pomjeri dolje")}><ChevronDown className="w-4 h-4" /></button>
                </div>
                <input defaultValue={item.naziv} disabled={!item.canEdit} onClick={(event) => event.stopPropagation()} onBlur={(event) => { const value = event.target.value.trim(); if (item.canEdit && value && value !== item.naziv) void update(item, { naziv: value }); }} className="min-w-[12rem] flex-1 rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:bg-white" aria-label={t("Naziv mektebske stavke")} />
                <NapametUceniciLinija item={item} compact />
                <select value={item.nivo} disabled={saving || !item.canEdit} onChange={(event) => void update(item, { nivo: Number(event.target.value) })} className="rounded-lg border border-border px-2 py-2 text-sm">{[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value === 4 ? t("Dodatak") : value}</option>)}</select>
                {item.canEdit && <button disabled={saving} onClick={() => void update(item, { isVisible: item.isVisible === false })} className="rounded-lg bg-white px-3 py-2 text-xs font-bold">{item.isVisible === false ? t("Prikaži") : t("Sakrij")}</button>}
                {item.canDelete && <button disabled={saving} onClick={() => void remove(item)} className="rounded-lg bg-red-50 p-2 text-red-600 hover:bg-red-100" aria-label={t("Obriši stavku")} title={t("Obriši stavku")}><Trash2 className="h-4 w-4" /></button>}
              </div>)}
            </div>
          </div> : null;
        })}
        {canManage && <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row">
          <input value={naziv} onChange={(event) => setNaziv(event.target.value)} placeholder={t("Nova stavka za mekteb")} className="flex-1 rounded-xl border border-border px-3 py-2 text-sm" />
          <select value={nivo} onChange={(event) => setNivo(Number(event.target.value))} className="rounded-xl border border-border px-3 py-2 text-sm">{[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value === 4 ? t("Dodatak") : `${t("Nivo")} ${value}`}</option>)}</select>
          <Button size="sm" disabled={saving || !naziv.trim()} onClick={() => void add()} className="rounded-xl"><Plus className="w-4 h-4 mr-1" /> {t("Dodaj")}</Button>
        </div>}
      </div>}
    </div>
  </section>;
}