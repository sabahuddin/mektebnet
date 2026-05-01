import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { ArrowLeft, User, CalendarCheck, Star, PlusCircle, Loader2, ClipboardList, Award, KeyRound, FileText, Copy, Check, Sparkles, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface Ucenik {
  id: number;
  displayName: string;
  username: string;
  role: string;
}

interface Prisustvo {
  id: number;
  datum: string;
  status: string;
  napomena?: string;
}

interface Ocjena {
  id: number;
  kategorija: string;
  ocjena: number;
  lekcijaNaziv?: string;
  napomena?: string;
  datum: string;
}

interface Grupa {
  id: number;
  naziv: string;
}

interface IlmihalLekcija {
  id: number;
  naslov: string;
  nivo: number;
}

interface KvizRezultat {
  id: number;
  kvizNaslov: string;
  tacniOdgovori: number;
  ukupnoPitanja: number;
  procenat: number;
  bodovi: number;
  completedAt: string;
}

interface H5PPokusaj {
  id: number;
  priloziId: number;
  attemptNo: number;
  score: number;
  maxScore: number;
  procenat: number;
  hasanatGained: number;
  completedAt: string;
}

interface H5PPrilogInfo {
  id: number;
  originalName: string;
  lekcijaId: number;
  lekcijaNaslov: string | null;
  lekcijaSlug: string | null;
  lekcijaNivo: number | null;
}

const STATUS_COLORS: Record<string, string> = {
  prisutan: "bg-emerald-100 text-emerald-700",
  odsutan: "bg-red-100 text-red-700",
  zakasnio: "bg-amber-100 text-amber-700",
  opravdan: "bg-blue-100 text-blue-700",
};

const OCJENA_COLORS = ["", "bg-red-100 text-red-700", "bg-orange-100 text-orange-700", "bg-amber-100 text-amber-700", "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-emerald-200 text-emerald-800"];

export default function UcenikPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { token } = useAuth();
  const { toast } = useToast();
  const [ucenik, setUcenik] = useState<Ucenik | null>(null);
  const [prisustvo, setPrisustvo] = useState<Prisustvo[]>([]);
  const [ocjene, setOcjene] = useState<Ocjena[]>([]);
  const [grupe, setGrupe] = useState<Grupa[]>([]);
  const [kvizRezultati, setKvizRezultati] = useState<KvizRezultat[]>([]);
  const [h5pPokusaji, setH5pPokusaji] = useState<H5PPokusaj[]>([]);
  const [h5pPrilozi, setH5pPrilozi] = useState<H5PPrilogInfo[]>([]);
  const [h5pFilterPrilogId, setH5pFilterPrilogId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const sp = new URLSearchParams(window.location.search);
    const v = sp.get("h5pPrilogId");
    return v ? parseInt(v) : null;
  });
  const h5pSectionRef = useRef<HTMLDivElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showOcjenaForm, setShowOcjenaForm] = useState(false);
  const [newOcjena, setNewOcjena] = useState({ kategorija: "usmeno", ocjena: 5, lekcijaNaziv: "", napomena: "", datum: new Date().toISOString().split("T")[0] });
  const [savingOcjena, setSavingOcjena] = useState(false);
  const [planLekcije, setPlanLekcije] = useState<{ id: number; lekcijaNaslov: string }[]>([]);
  const [ilmihalLekcije, setIlmihalLekcije] = useState<IlmihalLekcija[]>([]);
  const [showResetForm, setShowResetForm] = useState(false);
  const [customPassword, setCustomPassword] = useState("");
  const [resettingPass, setResettingPass] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [copiedPass, setCopiedPass] = useState(false);

  useEffect(() => {
    if (!token || !id) return;
    const ucenikId = parseInt(id);
    Promise.all([
      apiRequest<Ucenik[]>("GET", "/muallim/ucenici", undefined, token),
      apiRequest<Ocjena[]>("GET", `/muallim/ocjene/${ucenikId}`, undefined, token),
      apiRequest<Prisustvo[]>("GET", `/muallim/prisustvo-ucenik/${ucenikId}`, undefined, token),
      apiRequest<Grupa[]>("GET", "/muallim/grupe", undefined, token),
      apiRequest<{ rezultati: KvizRezultat[] }>("GET", `/muallim/ucenik-rezultati/${ucenikId}`, undefined, token).catch(() => ({ rezultati: [] })),
      apiRequest<IlmihalLekcija[]>("GET", "/muallim/lekcije-za-plan", undefined, token).catch(() => []),
      apiRequest<{ pokusaji: H5PPokusaj[]; prilozi: H5PPrilogInfo[] }>("GET", `/muallim/ucenik/${ucenikId}/h5p-pokusaji`, undefined, token).catch(() => ({ pokusaji: [], prilozi: [] })),
    ]).then(([ucenici, oc, prs, g, kvizData, lekcije, h5pData]) => {
      const found = (ucenici as any[]).find(u => u.id === ucenikId);
      setUcenik(found || null);
      setOcjene(oc);
      setPrisustvo(prs);
      setGrupe(g);
      setKvizRezultati((kvizData as any).rezultati || []);
      setIlmihalLekcije(lekcije as IlmihalLekcija[]);
      setH5pPokusaji((h5pData as any).pokusaji || []);
      setH5pPrilozi((h5pData as any).prilozi || []);
      const gId = found?.profil?.grupaId || found?.grupaId;
      if (gId) {
        apiRequest<{ id: number; lekcijaNaslov: string }[]>("GET", `/muallim/plan-lekcija?grupaId=${gId}`, undefined, token)
          .then(pl => {
            const unique = [...new Map(pl.map(l => [l.lekcijaNaslov, l])).values()];
            setPlanLekcije(unique);
          }).catch(() => {});
      }
    }).catch(() => {}).finally(() => setIsLoading(false));
  }, [token, id]);

  async function saveOcjena() {
    if (!token || !id) return;
    setSavingOcjena(true);
    try {
      const oc = await apiRequest<Ocjena>("POST", "/muallim/ocjene", {
        ucenikId: parseInt(id),
        kategorija: newOcjena.kategorija,
        ocjena: parseInt(String(newOcjena.ocjena)),
        lekcijaNaziv: newOcjena.lekcijaNaziv || null,
        napomena: newOcjena.napomena,
        datum: newOcjena.datum,
      }, token);
      setOcjene(prev => [oc, ...prev]);
      setShowOcjenaForm(false);
      setNewOcjena({ kategorija: "usmeno", ocjena: 5, lekcijaNaziv: "", napomena: "", datum: new Date().toISOString().split("T")[0] });
      toast({ title: "Ocjena dodana!" });
    } catch {
      toast({ title: "Greška", description: "Nije moguće dodati ocjenu", variant: "destructive" });
    } finally {
      setSavingOcjena(false);
    }
  }

  async function resetPassword(forceGenerate: boolean = false) {
    if (!token || !id) return;
    setResettingPass(true);
    try {
      const body = !forceGenerate && customPassword.trim() ? { password: customPassword.trim() } : {};
      const res = await apiRequest<{ ok: boolean; newPassword: string; displayName: string; username: string }>(
        "POST",
        `/muallim/ucenik/${parseInt(id)}/reset-password`,
        body,
        token
      );
      setNewPassword(res.newPassword);
      setCopiedPass(false);
      toast({ title: "Šifra je promijenjena!", description: "Nova šifra je prikazana ispod." });
    } catch (e: any) {
      toast({ title: "Greška", description: e?.message || "Nije moguće resetovati šifru", variant: "destructive" });
    } finally {
      setResettingPass(false);
    }
  }

  async function copyPassword() {
    if (!newPassword) return;
    try {
      await navigator.clipboard.writeText(newPassword);
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    } catch {}
  }

  const prisutnih = prisustvo.filter(p => p.status === "prisutan").length;
  const odsutnih = prisustvo.filter(p => p.status === "odsutan").length;
  const zakasnio = prisustvo.filter(p => p.status === "zakasnio").length;
  const opravdano = prisustvo.filter(p => p.status === "opravdan").length;
  const prisustvoPct = prisustvo.length > 0 ? Math.round((prisutnih / prisustvo.length) * 100) : null;
  const prosjecnaOcjena = ocjene.length ? (ocjene.reduce((s, o) => s + o.ocjena, 0) / ocjene.length).toFixed(2) : null;
  const ukupnoBodova = kvizRezultati.reduce((s, r) => s + (r.bodovi || 0), 0);
  const kvizProsjek = kvizRezultati.length ? Math.round(kvizRezultati.reduce((s, r) => s + r.procenat, 0) / kvizRezultati.length) : null;

  const h5pPriloziMap = new Map<number, H5PPrilogInfo>(h5pPrilozi.map(p => [p.id, p]));
  const filteredH5pPokusaji = h5pFilterPrilogId
    ? h5pPokusaji.filter(p => p.priloziId === h5pFilterPrilogId)
    : h5pPokusaji;
  const h5pProsjek = filteredH5pPokusaji.length
    ? Math.round(filteredH5pPokusaji.reduce((s, p) => s + p.procenat, 0) / filteredH5pPokusaji.length)
    : null;
  const h5pHasanat = filteredH5pPokusaji.reduce((s, p) => s + (p.hasanatGained || 0), 0);

  useEffect(() => {
    if (h5pFilterPrilogId && !isLoading && h5pSectionRef.current) {
      h5pSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [h5pFilterPrilogId, isLoading]);

  const mjesecniPrisustvo = (() => {
    const map: Record<string, { prisutan: number; total: number }> = {};
    prisustvo.forEach(p => {
      const m = p.datum.substring(0, 7);
      if (!map[m]) map[m] = { prisutan: 0, total: 0 };
      map[m].total++;
      if (p.status === "prisutan") map[m].prisutan++;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([mjesec, v]) => ({
      mjesec,
      ...v,
      pct: Math.round((v.prisutan / v.total) * 100),
    }));
  })();

  const MJESEC_NAZIVI: Record<string, string> = {
    "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "Maj", "06": "Jun",
    "07": "Jul", "08": "Aug", "09": "Sep", "10": "Okt", "11": "Nov", "12": "Dec",
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <button onClick={() => setLocation("/muallim")} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-medium mb-6 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Nazad na panel
        </button>

        {isLoading ? (
          <div className="flex flex-col gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
        ) : !ucenik ? (
          <div className="text-center py-20 text-muted-foreground">Učenik nije pronađen</div>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-4 flex-wrap">
              <div className="w-14 h-14 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-md">
                <User className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-extrabold text-foreground">{ucenik.displayName}</h1>
                <p className="text-muted-foreground text-sm font-mono">{ucenik.username}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={() => { setShowResetForm(s => !s); setNewPassword(null); setCustomPassword(""); }}
                  variant="outline"
                  className="rounded-xl font-bold text-sm flex items-center gap-1.5"
                  data-testid="btn-toggle-reset-password"
                >
                  <KeyRound className="w-4 h-4" /> Šifra
                </Button>
                <Button
                  onClick={() => setLocation(`/muallim/izvjestaj/ucenik/${ucenik.id}`)}
                  variant="outline"
                  className="rounded-xl font-bold text-sm flex items-center gap-1.5"
                  data-testid="btn-izvjestaj-ucenik"
                >
                  <FileText className="w-4 h-4" /> Izvještaj
                </Button>
              </div>
            </div>

            {showResetForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="bg-white border border-border/50 rounded-2xl p-5 mb-6 shadow-sm"
                data-testid="form-reset-password"
              >
                <h3 className="font-extrabold text-foreground mb-2 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-primary" /> Promijeni šifru za {ucenik.displayName}
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Generiši automatsku šifru u formatu <strong>Mekteb####</strong> ili unesi vlastitu (najmanje 4 karaktera) i klikni "Postavi".
                </p>
                <div className="flex flex-col gap-3">
                  <Button
                    onClick={() => { setCustomPassword(""); resetPassword(true); }}
                    disabled={resettingPass}
                    className="rounded-xl font-bold flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/90 w-full sm:w-auto"
                    data-testid="btn-generate-mekteb-sifra"
                  >
                    {resettingPass ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                    Generiši Mekteb####
                  </Button>
                  <div className="flex gap-2 items-end flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <label className="text-xs font-bold text-muted-foreground block mb-1">Ili unesi vlastitu šifru</label>
                      <input
                        type="text"
                        value={customPassword}
                        onChange={e => setCustomPassword(e.target.value)}
                        placeholder="Npr. Mekteb2026"
                        className="w-full border border-border rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/30"
                        data-testid="input-nova-sifra"
                      />
                    </div>
                    <Button
                      onClick={() => resetPassword(false)}
                      disabled={resettingPass || customPassword.trim().length < 4}
                      variant="outline"
                      className="rounded-xl font-bold flex items-center gap-1.5"
                      data-testid="btn-confirm-reset-password"
                    >
                      {resettingPass ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                      Postavi
                    </Button>
                  </div>
                </div>
                {newPassword && (
                  <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4" data-testid="display-nova-sifra">
                    <p className="text-xs text-emerald-700 font-bold mb-1">Nova šifra je postavljena. Predajte je učeniku:</p>
                    <div className="flex gap-2 items-center flex-wrap">
                      <code className="bg-white border border-emerald-300 rounded-lg px-3 py-2 text-base font-mono font-bold text-emerald-800 flex-1">{newPassword}</code>
                      <Button
                        onClick={copyPassword}
                        variant="outline"
                        className="rounded-xl font-bold text-sm flex items-center gap-1.5"
                        data-testid="btn-copy-sifra"
                      >
                        {copiedPass ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        {copiedPass ? "Kopirano" : "Kopiraj"}
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              <div className={`border border-border/50 rounded-2xl p-4 ${prisustvoPct !== null && prisustvoPct >= 80 ? "bg-emerald-50" : prisustvoPct !== null && prisustvoPct >= 50 ? "bg-amber-50" : "bg-red-50"}`}>
                <CalendarCheck className="w-5 h-5 text-foreground/60 mb-2" />
                <div className={`text-2xl font-extrabold ${prisustvoPct !== null && prisustvoPct >= 80 ? "text-emerald-600" : prisustvoPct !== null && prisustvoPct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                  {prisustvoPct !== null ? `${prisustvoPct}%` : "—"}
                </div>
                <div className="text-sm text-muted-foreground font-medium">Prisustvo</div>
                {prisustvo.length > 0 && (
                  <div className="flex gap-2 mt-2 text-xs font-medium flex-wrap">
                    <span className="text-emerald-600">{prisutnih}P</span>
                    <span className="text-red-600">{odsutnih}O</span>
                    <span className="text-amber-600">{zakasnio}Z</span>
                    <span className="text-blue-600">{opravdano}OP</span>
                  </div>
                )}
              </div>
              <div className="bg-white border border-border/50 rounded-2xl p-4">
                <Star className="w-5 h-5 text-amber-500 mb-2" />
                <div className="text-2xl font-extrabold text-amber-600">{prosjecnaOcjena || "—"}</div>
                <div className="text-sm text-muted-foreground font-medium">Prosj. ocjena</div>
                {ocjene.length > 0 && <div className="text-xs text-muted-foreground mt-1">{ocjene.length} ocjena</div>}
              </div>
              <div className="bg-white border border-border/50 rounded-2xl p-4">
                <ClipboardList className="w-5 h-5 text-blue-600 mb-2" />
                <div className="text-2xl font-extrabold text-blue-600">{kvizRezultati.length || "—"}</div>
                <div className="text-sm text-muted-foreground font-medium">Kvizova</div>
                {kvizProsjek !== null && <div className="text-xs text-muted-foreground mt-1">Prosjek: {kvizProsjek}%</div>}
              </div>
              <div className="bg-white border border-border/50 rounded-2xl p-4">
                <Award className="w-5 h-5 text-amber-600 mb-2" />
                <div className="text-2xl font-extrabold text-amber-600">{ukupnoBodova || "—"}</div>
                <div className="text-sm text-muted-foreground font-medium">Bodova</div>
              </div>
              <div className="bg-white border border-border/50 rounded-2xl p-4 col-span-2">
                <CalendarCheck className="w-5 h-5 text-primary mb-2" />
                <div className="text-lg font-extrabold text-foreground">{prisustvo.length} časova evidentirano</div>
                {prisustvo.length > 0 && (
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden mt-2 flex">
                    {prisutnih > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${(prisutnih / prisustvo.length) * 100}%` }} title={`Prisutan: ${prisutnih}`} />}
                    {zakasnio > 0 && <div className="bg-amber-400 h-full" style={{ width: `${(zakasnio / prisustvo.length) * 100}%` }} title={`Zakasnio: ${zakasnio}`} />}
                    {opravdano > 0 && <div className="bg-blue-400 h-full" style={{ width: `${(opravdano / prisustvo.length) * 100}%` }} title={`Opravdan: ${opravdano}`} />}
                    {odsutnih > 0 && <div className="bg-red-500 h-full" style={{ width: `${(odsutnih / prisustvo.length) * 100}%` }} title={`Odsutan: ${odsutnih}`} />}
                  </div>
                )}
              </div>
            </div>

            {/* H5P pokušaji — drilldown sa /muallim/h5p-statistika */}
            <div
              ref={h5pSectionRef}
              className={`bg-white border rounded-2xl p-5 mb-6 ${h5pFilterPrilogId ? "border-primary/40 ring-2 ring-primary/15" : "border-border/50"}`}
              data-testid="section-h5p-pokusaji"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h2 className="font-extrabold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> H5P vježbe
                  {h5pPokusaji.length > 0 && (
                    <span className="text-xs font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded-full" data-testid="badge-h5p-broj-pokusaja">
                      {filteredH5pPokusaji.length}{h5pFilterPrilogId ? `/${h5pPokusaji.length}` : ""} pokušaja
                    </span>
                  )}
                </h2>
                {h5pProsjek !== null && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className={`font-extrabold px-2.5 py-0.5 rounded-full ${h5pProsjek >= 80 ? "bg-emerald-100 text-emerald-700" : h5pProsjek >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`} data-testid="stat-h5p-prosjek">
                      Ø {h5pProsjek}%
                    </span>
                    {h5pHasanat > 0 && (
                      <span className="flex items-center gap-1 text-amber-600 font-bold">
                        <Award className="w-3.5 h-3.5" /> {h5pHasanat}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {h5pPokusaji.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Učenik još nije radio nijednu H5P vježbu</p>
              ) : (
                <>
                  {(h5pPrilozi.length > 1 || h5pFilterPrilogId !== null) && (
                    <div className="flex flex-wrap items-center gap-1.5 mb-3" data-testid="filter-h5p-prilozi">
                      <Filter className="w-3.5 h-3.5 text-muted-foreground mr-1" />
                      <button
                        onClick={() => {
                          setH5pFilterPrilogId(null);
                          if (typeof window !== "undefined") {
                            const url = new URL(window.location.href);
                            url.searchParams.delete("h5pPrilogId");
                            window.history.replaceState({}, "", url.toString());
                          }
                        }}
                        className={`text-xs font-bold px-2.5 py-1 rounded-full border transition-colors ${h5pFilterPrilogId === null ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border hover:border-primary/40"}`}
                        data-testid="btn-h5p-filter-sve"
                      >
                        Sve
                      </button>
                      {h5pPrilozi.map(p => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setH5pFilterPrilogId(p.id);
                            if (typeof window !== "undefined") {
                              const url = new URL(window.location.href);
                              url.searchParams.set("h5pPrilogId", String(p.id));
                              window.history.replaceState({}, "", url.toString());
                            }
                          }}
                          className={`text-xs font-bold px-2.5 py-1 rounded-full border transition-colors max-w-[200px] truncate ${h5pFilterPrilogId === p.id ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border hover:border-primary/40"}`}
                          title={p.originalName}
                          data-testid={`btn-h5p-filter-prilog-${p.id}`}
                        >
                          {p.originalName.replace(/\.h5p$/i, "")}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2 max-h-96 overflow-y-auto" data-testid="list-h5p-pokusaji">
                    {filteredH5pPokusaji.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Nema pokušaja za odabranu vježbu</p>
                    ) : filteredH5pPokusaji.map(p => {
                      const info = h5pPriloziMap.get(p.priloziId);
                      return (
                        <div key={p.id} className="bg-muted/20 rounded-xl p-3" data-testid={`row-h5p-pokusaj-${p.id}`}>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-sm text-foreground truncate" title={info?.originalName}>
                                {info ? info.originalName.replace(/\.h5p$/i, "") : `Vježba #${p.priloziId}`}
                              </div>
                              {info?.lekcijaNaslov && (
                                <div className="text-xs text-muted-foreground truncate">
                                  Lekcija: {info.lekcijaNaslov}
                                  {info.lekcijaNivo != null && <span className="ml-1.5 inline-block bg-primary/10 text-primary px-1.5 rounded text-[10px] font-bold align-middle">Nivo {info.lekcijaNivo}</span>}
                                </div>
                              )}
                            </div>
                            <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full shrink-0 ${p.procenat >= 80 ? "bg-emerald-100 text-emerald-700" : p.procenat >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                              {p.procenat}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Pokušaj #{p.attemptNo} · {p.score}/{p.maxScore}</span>
                            <div className="flex items-center gap-2">
                              {p.hasanatGained > 0 && (
                                <span className="flex items-center gap-0.5 text-amber-600 font-bold">
                                  <Award className="w-3 h-3" /> {p.hasanatGained}
                                </span>
                              )}
                              <span>{p.completedAt ? new Date(p.completedAt).toLocaleDateString("bs-BA") : "-"}</span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                            <div className={`h-1.5 rounded-full ${p.procenat >= 80 ? "bg-emerald-500" : p.procenat >= 50 ? "bg-amber-500" : "bg-red-400"}`}
                              style={{ width: `${p.procenat}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Kviz rezultati */}
              <div className="bg-white border border-border/50 rounded-2xl p-5 md:col-span-2 lg:col-span-1 lg:row-span-2">
                <h2 className="font-extrabold text-foreground flex items-center gap-2 mb-4">
                  <ClipboardList className="w-4 h-4 text-primary" /> Rezultati kvizova
                </h2>
                {kvizRezultati.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Učenik još nije radio kvizove</p>
                ) : (
                  <div className="space-y-2.5 max-h-80 overflow-y-auto">
                    {kvizRezultati.map(r => (
                      <div key={r.id} className="bg-muted/20 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-sm text-foreground truncate mr-2">{r.kvizNaslov}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${r.procenat >= 80 ? "bg-emerald-100 text-emerald-700" : r.procenat >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                            {r.procenat}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{r.tacniOdgovori}/{r.ukupnoPitanja} tačnih</span>
                          <div className="flex items-center gap-2">
                            {r.bodovi > 0 && (
                              <span className="flex items-center gap-0.5 text-amber-600 font-bold">
                                <Award className="w-3 h-3" /> {r.bodovi}
                              </span>
                            )}
                            <span>{r.completedAt ? new Date(r.completedAt).toLocaleDateString("bs-BA") : "-"}</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                          <div className={`h-1.5 rounded-full ${r.procenat >= 80 ? "bg-emerald-500" : r.procenat >= 50 ? "bg-amber-500" : "bg-red-400"}`}
                            style={{ width: `${r.procenat}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ocjene */}
              <div className="bg-white border border-border/50 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-extrabold text-foreground flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-500" /> Ocjene
                  </h2>
                  <button onClick={() => setShowOcjenaForm(!showOcjenaForm)}
                    className="flex items-center gap-1.5 text-primary hover:text-primary/80 text-sm font-bold">
                    <PlusCircle className="w-4 h-4" /> Dodaj
                  </button>
                </div>

                {showOcjenaForm && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    className="bg-muted/30 rounded-xl p-3 mb-4 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <select value={newOcjena.kategorija} onChange={e => setNewOcjena(p => ({ ...p, kategorija: e.target.value }))}
                        className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                        <option value="usmeno">Usmeno</option>
                        <option value="pismeno">Pismeno</option>
                        <option value="napamet">Napamet</option>
                        <option value="domaći">Domaći</option>
                        <option value="zadaća">Zadaća</option>
                        <option value="aktivnost">Aktivnost</option>
                        <option value="vladanje">Vladanje</option>
                      </select>
                      <select value={newOcjena.ocjena} onChange={e => setNewOcjena(p => ({ ...p, ocjena: parseInt(e.target.value) }))}
                        className="border border-border rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                        {[6, 5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <select value={newOcjena.lekcijaNaziv} onChange={e => setNewOcjena(p => ({ ...p, lekcijaNaziv: e.target.value }))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                      <option value="">— Odaberi lekciju (opcionalno) —</option>
                      {[1, 2, 3, 4].map(nivo => {
                        const nivoLekcije = ilmihalLekcije.filter(l => l.nivo === nivo);
                        if (nivoLekcije.length === 0) return null;
                        return (
                          <optgroup key={nivo} label={`Nivo ${nivo}`}>
                            {nivoLekcije.map(l => (
                              <option key={l.id} value={l.naslov}>{l.naslov}</option>
                            ))}
                          </optgroup>
                        );
                      })}
                      {planLekcije.length > 0 && (
                        <optgroup label="Iz plana lekcija">
                          {planLekcije.map(l => (
                            <option key={`pl-${l.id}`} value={l.lekcijaNaslov}>{l.lekcijaNaslov}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <input type="date" value={newOcjena.datum} onChange={e => setNewOcjena(p => ({ ...p, datum: e.target.value }))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white" />
                    <input type="text" placeholder="Napomena (opcionalno)" value={newOcjena.napomena}
                      onChange={e => setNewOcjena(p => ({ ...p, napomena: e.target.value }))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white" />
                    <Button onClick={saveOcjena} disabled={savingOcjena} className="w-full rounded-lg py-2 text-sm">
                      {savingOcjena ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Sačuvaj ocjenu"}
                    </Button>
                  </motion.div>
                )}

                {ocjene.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nema unesenih ocjena</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {ocjene.map(o => (
                      <div key={o.id} className="flex items-center justify-between text-sm">
                        <div>
                          <span className="font-medium text-foreground capitalize">{o.kategorija}</span>
                          {o.lekcijaNaziv && <span className="text-primary ml-2 text-xs font-medium">({o.lekcijaNaziv})</span>}
                          {o.napomena && <span className="text-muted-foreground ml-2">— {o.napomena}</span>}
                          <div className="text-xs text-muted-foreground">{o.datum}</div>
                        </div>
                        <span className={`text-sm font-extrabold px-2.5 py-0.5 rounded-full ${OCJENA_COLORS[o.ocjena] || "bg-gray-100 text-gray-700"}`}>
                          {o.ocjena}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Prisustvo — mjesečno + detalji */}
              <div className="bg-white border border-border/50 rounded-2xl p-5 md:col-span-2 lg:col-span-2">
                <h2 className="font-extrabold text-foreground flex items-center gap-2 mb-4">
                  <CalendarCheck className="w-4 h-4 text-primary" /> Prisustvo — pregled
                </h2>
                {prisustvo.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nema evidencije prisustva</p>
                ) : (
                  <div className="space-y-4">
                    {mjesecniPrisustvo.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Po mjesecima</h3>
                        {mjesecniPrisustvo.map(m => {
                          const parts = m.mjesec.split("-");
                          const naziv = `${MJESEC_NAZIVI[parts[1]] || parts[1]} ${parts[0]}`;
                          return (
                            <div key={m.mjesec} className="flex items-center gap-3">
                              <span className="w-20 text-sm font-medium text-foreground">{naziv}</span>
                              <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden relative">
                                <div className={`h-full rounded-full ${m.pct >= 80 ? "bg-emerald-500" : m.pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                                  style={{ width: `${m.pct}%` }} />
                              </div>
                              <span className={`w-16 text-right text-sm font-bold ${m.pct >= 80 ? "text-emerald-600" : m.pct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                                {m.pct}% <span className="text-xs text-muted-foreground font-normal">({m.prisutan}/{m.total})</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div>
                      <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Svi datumi</h3>
                      <div className="space-y-1 max-h-52 overflow-y-auto">
                        {[...prisustvo].reverse().map(p => (
                          <div key={p.id} className="flex items-center justify-between text-sm py-1 border-b border-border/20 last:border-0">
                            <span className="text-foreground font-medium">{p.datum}</span>
                            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${STATUS_COLORS[p.status] || "bg-gray-100 text-gray-700"}`}>
                              {p.status === "prisutan" ? "Prisutan" : p.status === "odsutan" ? "Odsutan" : p.status === "zakasnio" ? "Zakasnio" : p.status === "opravdan" ? "Opravdan" : p.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
