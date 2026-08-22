import { useEffect, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import type { NapametStavka } from "@/components/NapametPregled";

type ProgramStavka = NapametStavka & { isVisible?: boolean };

/**
 * The NAPAMET programme belongs to the mekteb, not to a group or a teacher.
 * This control is deliberately rendered only in the main teacher's settings.
 */
export function NapametProgramEditor() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [katalog, setKatalog] = useState<ProgramStavka[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [noviNaziv, setNoviNaziv] = useState("");
  const [noviNivo, setNoviNivo] = useState(1);

  const ucitaj = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiRequest<{ katalog: ProgramStavka[] }>("GET", "/muallim/napamet-program", undefined, token);
      setKatalog(data.katalog);
    } catch (error: any) {
      toast({ title: t("Greška"), description: error?.message || t("Nije moguće učitati NAPAMET program"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void ucitaj(); }, [token]);

  const izmijeni = async (stavka: ProgramStavka, patch: Record<string, unknown>) => {
    if (!token) return;
    setSaving(true);
    try {
      const updated = await apiRequest<ProgramStavka>(
        "PUT",
        `/muallim/napamet-program/${encodeURIComponent(stavka.id)}`,
        patch,
        token,
      );
      setKatalog((trenutni) => trenutni.map((item) => item.id === stavka.id ? { ...item, ...updated } : item));
    } catch (error: any) {
      toast({ title: t("Greška"), description: error?.message || t("Nije moguće sačuvati stavku"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const promijeniRedoslijed = async (nivo: number, index: number, pomak: -1 | 1) => {
    if (!token) return;
    const istogNivoa = katalog.filter((item) => item.nivo === nivo).sort((a, b) => a.redoslijed - b.redoslijed);
    const cilj = index + pomak;
    if (cilj < 0 || cilj >= istogNivoa.length) return;
    [istogNivoa[index], istogNivoa[cilj]] = [istogNivoa[cilj], istogNivoa[index]];
    const redoslijedPoId = new Map(istogNivoa.map((item, itemIndex) => [item.id, itemIndex + 1]));
    const sljedeci = katalog.map((item) => redoslijedPoId.has(item.id)
      ? { ...item, redoslijed: redoslijedPoId.get(item.id)! }
      : item);

    setSaving(true);
    try {
      const data = await apiRequest<{ katalog: ProgramStavka[] }>(
        "PUT",
        "/muallim/napamet-program-reorder",
        { stavke: sljedeci.map((item) => ({ id: item.id, nivo: item.nivo, redoslijed: item.redoslijed })) },
        token,
      );
      setKatalog(data.katalog);
    } catch (error: any) {
      toast({ title: t("Greška"), description: error?.message || t("Nije moguće sačuvati redoslijed"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const dodaj = async () => {
    if (!token || !noviNaziv.trim()) return;
    setSaving(true);
    try {
      await apiRequest("POST", "/muallim/napamet-program", { naziv: noviNaziv.trim(), nivo: noviNivo, redoslijed: 9999 }, token);
      setNoviNaziv("");
      await ucitaj();
    } catch (error: any) {
      toast({ title: t("Greška"), description: error?.message || t("Nije moguće dodati stavku"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white border border-emerald-200 rounded-2xl p-5 space-y-4" data-testid="napamet-program-mekteba">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700"><BookOpen className="w-5 h-5" /></div>
        <div>
          <h3 className="font-extrabold text-foreground">{t("NAPAMET program mekteba")}</h3>
          <p className="text-sm text-muted-foreground">{t("Ovaj program je zajednički svim muallimima, učenicima i roditeljima u vašem mektebu.")}</p>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">{t("Učitavanje...")}</p> : [1, 2, 3, 4].map((nivo) => {
        const stavke = katalog.filter((item) => item.nivo === nivo).sort((a, b) => a.redoslijed - b.redoslijed);
        return (
          <div key={nivo} className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wide text-emerald-800">{nivo === 4 ? t("Dodatak") : `${t("NAPAMET")} ${nivo}. ${t("nivo")}`}</h4>
            {stavke.map((stavka, index) => (
              <div key={stavka.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${stavka.isVisible === false ? "bg-slate-100 opacity-60" : "bg-white"}`}>
                <div className="flex flex-col">
                  <button type="button" disabled={saving || index === 0} aria-label={t("Pomjeri gore")} onClick={() => void promijeniRedoslijed(nivo, index, -1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp className="w-3 h-3" /></button>
                  <button type="button" disabled={saving || index === stavke.length - 1} aria-label={t("Pomjeri dolje")} onClick={() => void promijeniRedoslijed(nivo, index, 1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="w-3 h-3" /></button>
                </div>
                <input defaultValue={stavka.naziv} aria-label={t("Naziv stavke")} onBlur={(event) => {
                  const naziv = event.target.value.trim();
                  if (naziv && naziv !== stavka.naziv) void izmijeni(stavka, { naziv });
                }} className="min-w-0 flex-1 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold" />
                <select value={stavka.nivo} disabled={saving} onChange={(event) => void izmijeni(stavka, { nivo: Number(event.target.value) })} className="rounded-lg border border-border px-2 py-1.5 text-sm">
                  {[1, 2, 3, 4].map((broj) => <option key={broj} value={broj}>{broj}</option>)}
                </select>
                <button type="button" disabled={saving} onClick={() => void izmijeni(stavka, { isVisible: stavka.isVisible === false })} className={`rounded-lg px-2 py-1.5 text-xs font-bold ${stavka.isVisible === false ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                  {stavka.isVisible === false ? t("Prikaži") : t("Sakrij")}
                </button>
              </div>
            ))}
          </div>
        );
      })}

      <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-border">
        <input value={noviNaziv} onChange={(event) => setNoviNaziv(event.target.value)} placeholder={t("Nova stavka programa")} className="flex-1 rounded-xl border border-border px-3 py-2 text-sm" />
        <select value={noviNivo} onChange={(event) => setNoviNivo(Number(event.target.value))} className="rounded-xl border border-border px-3 py-2 text-sm">
          {[1, 2, 3, 4].map((nivo) => <option key={nivo} value={nivo}>{nivo === 4 ? t("Dodatak") : `${t("Nivo")} ${nivo}`}</option>)}
        </select>
        <Button size="sm" onClick={() => void dodaj()} disabled={saving || !noviNaziv.trim()} className="rounded-xl"><Plus className="w-4 h-4 mr-1" /> {t("Dodaj")}</Button>
      </div>
    </section>
  );
}