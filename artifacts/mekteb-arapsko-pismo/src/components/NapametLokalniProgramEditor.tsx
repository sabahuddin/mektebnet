import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Users } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import type { NapametStavka } from "@/components/NapametPregled";

type LokalnaStavka = NapametStavka & { isVisible?: boolean };
type NapametBrojac = Pick<NapametStavka, "assessedCount" | "totalCount">;

export function NapametLokalniProgramEditor({
  grupaId,
  globalItems = [],
  itemCounts = {},
  onItemClick,
  onChanged,
}: {
  grupaId: number;
  globalItems?: NapametStavka[];
  itemCounts?: Record<string, NapametBrojac>;
  onItemClick?: (item: NapametStavka) => void;
  onChanged?: () => void;
}) {
  const { token } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<LokalnaStavka[]>([]);
  const [naziv, setNaziv] = useState("");
  const [nivo, setNivo] = useState(4);
  const [saving, setSaving] = useState(false);
  const countLabel = (item: NapametStavka) => {
    const count = itemCounts[item.id] ?? item;
    return typeof count.totalCount === "number" ? `${count.assessedCount ?? 0}/${count.totalCount}` : null;
  };

  const load = async () => {
    if (!token || !grupaId) return;
    try {
      const data = await apiRequest<{ katalog: LokalnaStavka[] }>("GET", `/muallim/napamet-lokalno?grupaId=${grupaId}`, undefined, token);
      setItems(data.katalog);
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

  return <section className="bg-white border border-emerald-200 rounded-2xl overflow-hidden mb-6" data-testid="napamet-lokalne-stavke">
    <div className="px-5 py-4 bg-emerald-50/70">
      <h2 className="font-extrabold text-emerald-950">{t("NAPAMET program")}</h2>
      <p className="text-xs text-emerald-800 mt-1">{t("Globalne stavke koje je dodao admin dostupne su svim muallimima.")}</p>
    </div>
    {globalItems.length > 0 && <div className="p-4 border-b border-emerald-100 space-y-3">
      <h3 className="text-xs font-black uppercase text-emerald-800">{t("Globalne stavke")}</h3>
      {[1, 2, 3, 4].map((sectionNivo) => {
        const section = globalItems.filter((item) => item.nivo === sectionNivo).sort((a, b) => a.redoslijed - b.redoslijed);
        return section.length ? <div key={sectionNivo} className="space-y-1.5">
          <p className="text-[11px] font-bold text-muted-foreground">{sectionNivo === 4 ? t("Dodatak") : `NAPAMET ${sectionNivo}. ${t("nivo")}`}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {section.map((item) => <button type="button" key={item.id} onClick={() => onItemClick?.(item)} className="flex min-w-0 items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-left text-sm font-semibold leading-snug text-emerald-950 transition hover:border-emerald-300 hover:bg-emerald-100/70"><span className="min-w-0 flex-1">{item.naziv}</span>{countLabel(item) && <span className="shrink-0 rounded-full bg-emerald-200 px-2 py-0.5 text-xs font-black text-emerald-900" title={t("Ocijenjeni učenici / ukupno učenika")}>{countLabel(item)}</span>}<Users className="h-4 w-4 shrink-0 text-emerald-700" /></button>)}
          </div>
        </div> : null;
      })}
    </div>}
    <button type="button" className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-emerald-50/40 transition-colors" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
      <div><h3 className="font-extrabold text-emerald-950">{t("Lokalne stavke za ovu grupu")}</h3><p className="text-xs text-muted-foreground mt-1">{t("Dodaj ručnu stavku samo za ovu grupu. Ne prikazuje se drugim muallimima.")}</p></div>
      <ChevronDown className={`w-5 h-5 text-emerald-700 transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
    {open && <div className="p-4 space-y-3">
      {[1, 2, 3, 4].map((sectionNivo) => {
        const section = items.filter((item) => item.nivo === sectionNivo).sort((a, b) => a.redoslijed - b.redoslijed);
        return section.length ? <div key={sectionNivo} className="space-y-2">
          <h3 className="text-xs font-black uppercase text-emerald-800">{sectionNivo === 4 ? t("Dodatak") : `NAPAMET ${sectionNivo}. ${t("nivo")}`}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {section.map((item, index) => <div key={item.id} className={`flex gap-2 items-center rounded-xl border px-3 py-2 ${item.isVisible === false ? "opacity-60 bg-slate-50" : ""}`}>
            <div className="flex flex-col"><button disabled={saving || index === 0} onClick={() => void reorder(sectionNivo, index, -1)} aria-label={t("Pomjeri gore")}><ChevronUp className="w-3 h-3" /></button><button disabled={saving || index === section.length - 1} onClick={() => void reorder(sectionNivo, index, 1)} aria-label={t("Pomjeri dolje")}><ChevronDown className="w-3 h-3" /></button></div>
            <input defaultValue={item.naziv} onBlur={(event) => { const value = event.target.value.trim(); if (value && value !== item.naziv) void update(item, { naziv: value }); }} className="min-w-0 flex-1 rounded-lg border border-border px-2 py-1.5 text-sm font-semibold" aria-label={t("Naziv lokalne stavke")} />
            {countLabel(item) && <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-800" title={t("Ocijenjeni učenici / ukupno učenika")}>{countLabel(item)}</span>}
            <button type="button" onClick={() => onItemClick?.(item)} className="rounded-lg border border-emerald-200 px-2 py-1.5 text-emerald-700 hover:bg-emerald-50" aria-label={t("Prikaži učenike i ocjene")}><Users className="h-4 w-4" /></button>
            <select value={item.nivo} disabled={saving} onChange={(event) => void update(item, { nivo: Number(event.target.value) })} className="rounded-lg border border-border px-2 py-1.5 text-sm">{[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value}</option>)}</select>
            <button disabled={saving} onClick={() => void update(item, { isVisible: item.isVisible === false })} className="rounded-lg px-2 py-1.5 text-xs font-bold bg-slate-100">{item.isVisible === false ? t("Prikaži") : t("Sakrij")}</button>
          </div>)}
          </div>
        </div> : null;
      })}
      <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-border">
        <input value={naziv} onChange={(event) => setNaziv(event.target.value)} placeholder={t("Nova lokalna stavka")} className="flex-1 rounded-xl border border-border px-3 py-2 text-sm" />
        <select value={nivo} onChange={(event) => setNivo(Number(event.target.value))} className="rounded-xl border border-border px-3 py-2 text-sm">{[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value === 4 ? t("Dodatak") : `${t("Nivo")} ${value}`}</option>)}</select>
        <Button size="sm" disabled={saving || !naziv.trim()} onClick={() => void add()} className="rounded-xl"><Plus className="w-4 h-4 mr-1" /> {t("Dodaj")}</Button>
      </div>
    </div>}
  </section>;
}