import { useState, useEffect, useRef, useMemo } from "react";
import { apiRequest, getApiBase } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/language";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Megaphone, Plus, Trash2, Edit3, Image, X, Loader2, Users,
  Send, Mail, User, Save, Heart, Clock, GraduationCap,
  CheckSquare, Square, MessageSquare,
} from "lucide-react";

interface Obavjestenje {
  id: number;
  naslov: string;
  sadrzaj: string;
  slikaUrl: string | null;
  grupaId: number | null;
  grupaNaziv: string | null;
  // Puni skup ciljanih grupa (join tabela na serveru). Prazno = svi roditelji.
  grupaIds?: number[];
  grupaNazivi?: string[];
  createdAt: string;
  updatedAt: string;
}

interface Grupa {
  id: number;
  naziv: string;
}

interface RoditeljEntry {
  roditelj: {
    id: number;
    displayName: string;
    username: string;
    email: string | null;
  };
  djeca: {
    id: number;
    displayName: string;
    grupaId: number | null;
    grupaNaziv: string | null;
    daniNastave: string[] | null;
    vrijemeNastave: string | null;
    muallimDisplayName: string | null;
  }[];
}

export default function RoditeljiTab({
  grupe,
  filterGrupaId = null,
  muallimId = null,
  readOnly = false,
}: {
  grupe: Grupa[];
  filterGrupaId?: number | null;
  muallimId?: number | null;
  readOnly?: boolean;
}) {
  const { token } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [obavjestenja, setObavjestenja] = useState<Obavjestenje[]>([]);
  const [roditelji, setRoditelji] = useState<RoditeljEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"obavjestenja" | "roditelji">(readOnly ? "roditelji" : "obavjestenja");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [naslov, setNaslov] = useState("");
  const [sadrzaj, setSadrzaj] = useState("");
  // Obavještenje može ciljati više grupa odjednom; prazan niz = svi roditelji.
  const [grupaIds, setGrupaIds] = useState<number[]>(filterGrupaId ? [filterGrupaId] : []);

  // Odabir roditelja + slanje poruka iz liste roditelja.
  const [odabraniRoditelji, setOdabraniRoditelji] = useState<number[]>([]);
  const [porukaOtvorena, setPorukaOtvorena] = useState(false);
  const [porukaNaslov, setPorukaNaslov] = useState("");
  const [porukaTekst, setPorukaTekst] = useState("");
  const [saljemPoruku, setSaljemPoruku] = useState(false);

  // Kad iz Grupa stranice dođe filterGrupaId, predefinisi novu objavu na tu
  // grupu i prebaci na roditelji listu (jer korisnik je tu radi te grupe).
  useEffect(() => {
    if (filterGrupaId) {
      setGrupaIds([filterGrupaId]);
    }
  }, [filterGrupaId]);

  function ciljaneGrupe(o: Obavjestenje): number[] {
    if (o.grupaIds?.length) return o.grupaIds;
    return o.grupaId ? [o.grupaId] : [];
  }

  const filteredRoditelji = filterGrupaId
    ? roditelji.filter(r => r.djeca.some(d => d.grupaId === filterGrupaId))
    : roditelji;
  const filteredObavjestenja = filterGrupaId
    ? obavjestenja.filter(o => {
        const ciljane = ciljaneGrupe(o);
        return ciljane.length === 0 || ciljane.includes(filterGrupaId);
      })
    : obavjestenja;

  // Roditelj s više djece pojavljuje se jednom — lista je već dedup po
  // roditelju sa servera, pa je dovoljno brojati jedinstvene ID-eve.
  const odabraniUVidljivima = useMemo(
    () => odabraniRoditelji.filter(id => filteredRoditelji.some(r => r.roditelj.id === id)),
    [odabraniRoditelji, filteredRoditelji],
  );
  const filterGrupaNaziv = filterGrupaId
    ? grupe.find(g => g.id === filterGrupaId)?.naziv
    : null;
  const [slikaUrl, setSlikaUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const query = muallimId ? `?muallimId=${encodeURIComponent(String(muallimId))}` : "";
    const roditeljiRequest = apiRequest<RoditeljEntry[]>("GET", `/muallim/roditelji-lista${query}`, undefined, token);
    if (readOnly) {
      roditeljiRequest.then(r => setRoditelji(r)).catch(() => {}).finally(() => setLoading(false));
      setView("roditelji");
      return;
    }
    Promise.all([
      apiRequest<Obavjestenje[]>("GET", "/muallim/obavjestenja", undefined, token),
      roditeljiRequest,
    ]).then(([o, r]) => {
      setObavjestenja(o);
      setRoditelji(r);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token, muallimId, readOnly]);

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setNaslov("");
    setSadrzaj("");
    setGrupaIds(filterGrupaId ? [filterGrupaId] : []);
    setSlikaUrl("");
  }

  function startEdit(o: Obavjestenje) {
    setEditingId(o.id);
    setNaslov(o.naslov);
    setSadrzaj(o.sadrzaj);
    setGrupaIds(ciljaneGrupe(o));
    setSlikaUrl(o.slikaUrl || "");
    setShowForm(true);
  }

  function toggleGrupa(id: number) {
    setGrupaIds(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  }

  function nazivGrupa(ids: number[]): string[] {
    return ids.map(id => grupe.find(g => g.id === id)?.naziv).filter((n): n is string => !!n);
  }

  async function handleUploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await apiRequest<{ url: string }>("POST", "/admin/upload", fd, token, true);
      setSlikaUrl(res.url);
      toast({ title: t("Slika uploadovana") });
    } catch {
      toast({ title: t("Greška pri uploadu slike"), variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSave() {
    if (!token || !naslov.trim() || !sadrzaj.trim()) return;
    setSaving(true);
    try {
      const nazivi = nazivGrupa(grupaIds);
      const body = {
        naslov: naslov.trim(),
        sadrzaj: sadrzaj.trim(),
        grupaIds,
        slikaUrl: slikaUrl || null,
      };
      if (editingId) {
        const updated = await apiRequest<Obavjestenje>("PUT", `/muallim/obavjestenja/${editingId}`, body, token);
        setObavjestenja(prev => prev.map(o => o.id === editingId
          ? { ...o, ...updated, grupaIds, grupaNazivi: nazivi, grupaNaziv: nazivi.length === 1 ? nazivi[0] : null }
          : o));
        toast({ title: t("Obavještenje ažurirano") });
      } else {
        const created = await apiRequest<Obavjestenje>("POST", "/muallim/obavjestenja", body, token);
        const withGrupa = { ...created, grupaIds, grupaNazivi: nazivi, grupaNaziv: nazivi.length === 1 ? nazivi[0] : null };
        setObavjestenja(prev => [withGrupa, ...prev]);
        toast({ title: t("Obavještenje objavljeno") });
      }
      resetForm();
    } catch {
      toast({ title: t("Greška"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function toggleRoditelj(id: number) {
    setOdabraniRoditelji(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  }

  function toggleSviRoditelji() {
    const vidljiviIds = filteredRoditelji.map(r => r.roditelj.id);
    const sviOdabrani = vidljiviIds.every(id => odabraniRoditelji.includes(id));
    setOdabraniRoditelji(sviOdabrani
      ? odabraniRoditelji.filter(id => !vidljiviIds.includes(id))
      : [...new Set([...odabraniRoditelji, ...vidljiviIds])]);
  }

  async function handleSendPoruka() {
    if (!token || odabraniUVidljivima.length === 0 || !porukaTekst.trim()) return;
    setSaljemPoruku(true);
    try {
      // Server dodatno provjerava opseg i dedupliku — ovdje šaljemo samo
      // jedinstvene ID-eve trenutno vidljivih roditelja.
      const res = await apiRequest<{ sent: number }>("POST", "/poruke/bulk", {
        primateljIds: odabraniUVidljivima,
        naslov: porukaNaslov.trim() || t("Poruka od muallima"),
        sadrzaj: porukaTekst.trim(),
      }, token);
      toast({ title: t("Poruka poslana"), description: t("Primatelja: {n}", { n: String(res.sent) }) });
      setPorukaOtvorena(false);
      setPorukaNaslov("");
      setPorukaTekst("");
      setOdabraniRoditelji([]);
    } catch {
      toast({ title: t("Greška"), variant: "destructive" });
    } finally {
      setSaljemPoruku(false);
    }
  }

  async function handleDelete(id: number) {
    if (!token || !confirm(t("Obrisati ovo obavještenje?"))) return;
    try {
      await apiRequest("DELETE", `/muallim/obavjestenja/${id}`, undefined, token);
      setObavjestenja(prev => prev.filter(o => o.id !== id));
      toast({ title: t("Obrisano") });
    } catch {
      toast({ title: t("Greška"), variant: "destructive" });
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("bs-BA", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {filterGrupaNaziv && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-800 font-medium flex items-center gap-2">
          <Heart className="w-4 h-4 shrink-0" />
          <span>
            {t("Prikazani su samo roditelji i obavještenja za grupu")} <strong>{filterGrupaNaziv}</strong>.{" "}
            {t("Nove objave će biti automatski usmjerene na ovu grupu.")}
          </span>
        </div>
      )}
      <div className="flex gap-2 mb-4">
        {!readOnly && (
          <button
            onClick={() => setView("obavjestenja")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all border ${view === "obavjestenja" ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-white border-border/60 text-muted-foreground hover:bg-muted"}`}
          >
            <Megaphone className="w-4 h-4" /> {t("Obavještenja ({n})", { n: String(filteredObavjestenja.length) })}
          </button>
        )}
        <button
          onClick={() => setView("roditelji")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all border ${view === "roditelji" ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-white border-border/60 text-muted-foreground hover:bg-muted"}`}
        >
          <Users className="w-4 h-4" /> {t("Roditelji ({n})", { n: String(filteredRoditelji.length) })}
        </button>
      </div>

      {view === "obavjestenja" && (
        <div className="space-y-4">
          {!showForm && (
            <Button onClick={() => { resetForm(); setShowForm(true); }} className="rounded-xl">
              <Plus className="w-4 h-4 mr-1" /> {t("Novo obavještenje")}
            </Button>
          )}

          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white border border-border/50 rounded-2xl p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-foreground flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-primary" />
                    {editingId ? t("Uredi obavještenje") : t("Novo obavještenje")}
                  </h3>
                  <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div>
                  <label className="text-sm font-bold text-muted-foreground block mb-1">{t("Naslov")}</label>
                  <input
                    type="text"
                    value={naslov}
                    onChange={e => setNaslov(e.target.value)}
                    placeholder={t("Npr: Raspored za ramazan")}
                    className="w-full border border-border rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div>
                  <label className="text-sm font-bold text-muted-foreground block mb-1">{t("Sadržaj")}</label>
                  <textarea
                    value={sadrzaj}
                    onChange={e => setSadrzaj(e.target.value)}
                    placeholder={t("Tekst obavještenja...")}
                    rows={5}
                    className="w-full border border-border rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
                  />
                </div>

                <div>
                  <label className="text-sm font-bold text-muted-foreground block mb-1">{t("Za koga?")}</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setGrupaIds([])}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold border transition ${grupaIds.length === 0 ? "bg-emerald-100 border-emerald-300 text-emerald-800" : "bg-white border-border/60 text-muted-foreground hover:bg-muted"}`}
                    >
                      {grupaIds.length === 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      {t("Svi roditelji")}
                    </button>
                    {grupe.map(g => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleGrupa(g.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold border transition ${grupaIds.includes(g.id) ? "bg-primary text-primary-foreground border-primary" : "bg-white border-border/60 text-muted-foreground hover:bg-muted"}`}
                      >
                        {grupaIds.includes(g.id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        {g.naziv}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {grupaIds.length === 0
                      ? t("Obavještenje ide svim roditeljima.")
                      : t("Odabrano grupa: {n}", { n: String(grupaIds.length) })}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-bold text-muted-foreground block mb-1">{t("Ilustracija (opciono)")}</label>
                  {slikaUrl ? (
                    <div className="relative inline-block">
                      <img
                        src={slikaUrl.startsWith("/") ? `${getApiBase().replace("/api", "")}${slikaUrl}` : slikaUrl}
                        alt={t("Priložena slika")}
                        className="max-h-40 rounded-xl border border-border/50"
                      />
                      <button
                        onClick={() => setSlikaUrl("")}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        onChange={handleUploadImage}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        className="rounded-xl"
                      >
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Image className="w-4 h-4 mr-1" />}
                        {t("Dodaj sliku")}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSave} disabled={saving || !naslov.trim() || !sadrzaj.trim()} className="rounded-xl">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : editingId ? <Save className="w-4 h-4 mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                    {editingId ? t("Sačuvaj izmjene") : t("Objavi")}
                  </Button>
                  <Button variant="outline" onClick={resetForm} className="rounded-xl">{t("Otkaži")}</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {filteredObavjestenja.length === 0 && !showForm ? (
            <div className="text-center py-12 text-muted-foreground">
              <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">{t("Nema obavještenja")}</p>
              <p className="text-sm mt-1">{t("Kreirajte prvo obavještenje za roditelje")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredObavjestenja.map(o => (
                <motion.div
                  key={o.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white border border-border/50 rounded-2xl p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="font-extrabold text-foreground text-base">{o.naslov}</h4>
                        {(() => {
                          const nazivi = o.grupaNazivi?.length ? o.grupaNazivi : nazivGrupa(ciljaneGrupe(o));
                          if (nazivi.length === 0) {
                            return (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                {t("Svi roditelji")}
                              </span>
                            );
                          }
                          return nazivi.map(n => (
                            <span key={n} className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                              {n}
                            </span>
                          ));
                        })()}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{formatDate(o.createdAt)}</p>
                      <p className="text-foreground whitespace-pre-wrap leading-relaxed">{o.sadrzaj}</p>
                      {o.slikaUrl && (
                        <img
                          src={o.slikaUrl.startsWith("/") ? `${getApiBase().replace("/api", "")}${o.slikaUrl}` : o.slikaUrl}
                          alt={t("Ilustracija")}
                          className="mt-3 max-h-48 rounded-xl border border-border/30"
                        />
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => startEdit(o)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(o.id)} className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "roditelji" && (
        <div className="space-y-3">
          {!readOnly && filteredRoditelji.length > 0 && (
            <div className="bg-white border border-border/50 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" onClick={toggleSviRoditelji} className="rounded-xl text-sm">
                  {filteredRoditelji.every(r => odabraniRoditelji.includes(r.roditelj.id))
                    ? t("Poništi sve")
                    : t("Odaberi sve")}
                </Button>
                <Button
                  onClick={() => setPorukaOtvorena(v => !v)}
                  disabled={odabraniUVidljivima.length === 0}
                  className="rounded-xl text-sm"
                >
                  <MessageSquare className="w-4 h-4 mr-1" />
                  {t("Poruke ({n})", { n: String(odabraniUVidljivima.length) })}
                </Button>
                {odabraniUVidljivima.length > 0 && (
                  <span className="text-xs font-bold text-primary bg-primary/10 rounded-full px-2.5 py-1">
                    {t("Jedinstvenih roditelja: {n}", { n: String(odabraniUVidljivima.length) })}
                  </span>
                )}
              </div>

              <AnimatePresence>
                {porukaOtvorena && odabraniUVidljivima.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden space-y-2"
                  >
                    <input
                      type="text"
                      value={porukaNaslov}
                      onChange={e => setPorukaNaslov(e.target.value)}
                      placeholder={t("Naslov (opciono)")}
                      className="w-full border border-border rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <textarea
                      value={porukaTekst}
                      onChange={e => setPorukaTekst(e.target.value)}
                      placeholder={t("Tekst poruke...")}
                      rows={4}
                      className="w-full border border-border rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleSendPoruka} disabled={saljemPoruku || !porukaTekst.trim()} className="rounded-xl">
                        {saljemPoruku ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                        {t("Pošalji ({n})", { n: String(odabraniUVidljivima.length) })}
                      </Button>
                      <Button variant="outline" onClick={() => setPorukaOtvorena(false)} className="rounded-xl">
                        {t("Otkaži")}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {filteredRoditelji.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">{t("Nema registrovanih roditelja")}{filterGrupaNaziv ? t(` u grupi "{ime}"`, { ime: filterGrupaNaziv }) : ""}</p>
              <p className="text-sm mt-1">{t("Roditelji se prikazuju nakon što povežu svoj nalog sa djetetom")}</p>
            </div>
          ) : (
            filteredRoditelji.map(r => (
              <div key={r.roditelj.id} className="bg-white border border-border/50 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => toggleRoditelj(r.roditelj.id)}
                      aria-label={t("Odaberi roditelja")}
                      className="shrink-0 text-muted-foreground hover:text-primary transition"
                    >
                      {odabraniRoditelji.includes(r.roditelj.id)
                        ? <CheckSquare className="w-5 h-5 text-primary" />
                        : <Square className="w-5 h-5" />}
                    </button>
                  )}
                  <div className="w-10 h-10 bg-gradient-to-br from-violet-400 to-purple-600 rounded-xl flex items-center justify-center shadow-sm">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-foreground">{r.roditelj.displayName}</div>
                    <div className="text-sm text-muted-foreground">@{r.roditelj.username}</div>
                  </div>
                  {r.roditelj.email && (
                    <a href={`mailto:${r.roditelj.email}`} className="text-primary hover:underline text-sm flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" /> {r.roditelj.email}
                    </a>
                  )}
                </div>
                <div className="pl-13 space-y-2">
                  {r.djeca.map(d => (
                    <div key={d.id} className="text-sm space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-muted-foreground">{t("Dijete")}:</span>
                        <span className="font-semibold text-foreground">{d.displayName}</span>
                        {d.grupaNaziv && (
                          <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{d.grupaNaziv}</span>
                        )}
                        {d.muallimDisplayName && (
                          <span className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <GraduationCap className="w-3 h-3" />{d.muallimDisplayName}
                          </span>
                        )}
                      </div>
                      {(d.daniNastave?.length || d.vrijemeNastave) && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground pl-1">
                          <Clock className="w-3 h-3 shrink-0" />
                          {Array.isArray(d.daniNastave) && d.daniNastave.length > 0 && (
                            <span>{d.daniNastave.join(", ")}</span>
                          )}
                          {d.vrijemeNastave && (
                            <span>{d.daniNastave?.length ? "·" : ""} {d.vrijemeNastave}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </motion.div>
  );
}
