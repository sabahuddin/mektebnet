import { useState, useEffect, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import {
  ArrowLeft, Users, UserPlus, Printer, ChevronRight, ArrowRightLeft,
  Loader2, GraduationCap, X, Plus, Trash2, Star, ClipboardList, KeyRound,
  AlertTriangle, BookOpen, Copy, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { isOnline, formatScreentime } from "@/lib/utils";

interface Grupa {
  id: number;
  naziv: string;
  skolskaGodina: string;
  daniNastave: string[];
  vrijemeNastave: string;
}

interface Ucenik {
  id: number;
  displayName: string;
  username: string;
  profil?: { grupaId?: number };
  lastSeenAt?: string | null;
  totalScreentimeSec?: number | null;
}

interface CreatedUcenik {
  id: number;
  displayName: string;
  username: string;
  generatedPassword: string;
  roditelj?: {
    id: number;
    displayName: string;
    username: string;
    generatedPassword: string;
  } | null;
}

interface IlmihalLekcija {
  id: number;
  naslov: string;
  nivo: number;
  slug?: string;
}

interface LekcijaStatus {
  ucenikId: number;
  zavrsenoLekcija: number;
  zadnjaLekcija: { id: number; naslov: string; slug: string; nivo: number } | null;
  zavrsenoAt: string | null;
}

interface RoditeljVeza {
  id: number;
  displayName: string;
  username: string;
  status: string;
}

export default function GrupaPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { token } = useAuth();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [printLoading, setPrintLoading] = useState(false);

  const [grupa, setGrupa] = useState<Grupa | null>(null);
  const [studentiGrupe, setStudentiGrupe] = useState<Ucenik[]>([]);
  const [sviStudenti, setSviStudenti] = useState<Ucenik[]>([]);
  const [sveGrupe, setSveGrupe] = useState<Grupa[]>([]);
  const [lekcijeStatus, setLekcijeStatus] = useState<Map<number, LekcijaStatus>>(new Map());
  const [ilmihalLekcije, setIlmihalLekcije] = useState<IlmihalLekcija[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkNames, setBulkNames] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [createdStudents, setCreatedStudents] = useState<CreatedUcenik[]>([]);

  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveStudent, setMoveStudent] = useState<Ucenik | null>(null);
  const [moveTargetGrupaId, setMoveTargetGrupaId] = useState<string>("");
  const [moveLoading, setMoveLoading] = useState(false);

  const [showAddExisting, setShowAddExisting] = useState(false);

  // Ocjena modal
  const [ocjenaTarget, setOcjenaTarget] = useState<Ucenik | null>(null);
  const [newOcjena, setNewOcjena] = useState({
    kategorija: "usmeno", ocjena: 5, lekcijaNaziv: "", napomena: "",
    datum: new Date().toISOString().split("T")[0],
  });
  const [savingOcjena, setSavingOcjena] = useState(false);

  // Zadaća modal — ako zadacaTarget=null → zadaća za cijelu grupu
  const [showZadacaModal, setShowZadacaModal] = useState(false);
  const [zadacaTarget, setZadacaTarget] = useState<Ucenik | null>(null);
  const [newZadaca, setNewZadaca] = useState({ naslov: "", opis: "", rokDo: "", lekcijaNaslov: "" });
  const [savingZadaca, setSavingZadaca] = useState(false);

  // Brisanje učenika (hard delete)
  const [deleteTarget, setDeleteTarget] = useState<Ucenik | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Reset šifre roditelja
  const [parentResetTarget, setParentResetTarget] = useState<Ucenik | null>(null);
  const [parentResetList, setParentResetList] = useState<RoditeljVeza[]>([]);
  const [parentResetLoading, setParentResetLoading] = useState(false);
  const [parentResetResult, setParentResetResult] = useState<{ id: number; password: string; displayName: string } | null>(null);
  const [parentResetWorking, setParentResetWorking] = useState<number | null>(null);

  const grupaId = parseInt(id || "0");

  useEffect(() => {
    if (!token || !grupaId) return;
    Promise.all([
      apiRequest<Grupa[]>("GET", "/muallim/grupe", undefined, token),
      apiRequest<Ucenik[]>("GET", "/muallim/ucenici", undefined, token),
      apiRequest<LekcijaStatus[]>("GET", `/muallim/grupa/${grupaId}/lekcije-status`, undefined, token).catch(() => []),
      apiRequest<IlmihalLekcija[]>("GET", "/muallim/lekcije-za-plan", undefined, token).catch(() => []),
    ]).then(([grupe, ucenici, status, lekcije]) => {
      const g = grupe.find(x => x.id === grupaId);
      setGrupa(g || null);
      setSveGrupe(grupe);
      setSviStudenti(ucenici);
      setStudentiGrupe(ucenici.filter(u => (u.profil as any)?.grupaId === grupaId || (u as any).grupaId === grupaId));
      setLekcijeStatus(new Map(status.map(s => [s.ucenikId, s])));
      setIlmihalLekcije(lekcije);
    }).catch(() => {}).finally(() => setIsLoading(false));
  }, [token, grupaId]);

  function refreshStudents() {
    if (!token) return;
    Promise.all([
      apiRequest<Ucenik[]>("GET", "/muallim/ucenici", undefined, token),
      apiRequest<LekcijaStatus[]>("GET", `/muallim/grupa/${grupaId}/lekcije-status`, undefined, token).catch(() => []),
    ]).then(([ucenici, status]) => {
      setSviStudenti(ucenici);
      setStudentiGrupe(ucenici.filter(u => (u.profil as any)?.grupaId === grupaId || (u as any).grupaId === grupaId));
      setLekcijeStatus(new Map(status.map(s => [s.ucenikId, s])));
    }).catch(() => {});
  }

  function parseBulkEntries(text: string) {
    return text.split("\n").map(line => {
      const [u, r] = line.split("|");
      return { ucenik: (u || "").trim(), roditelj: r ? r.trim() : null };
    }).filter(e => e.ucenik.length > 0);
  }

  async function handleBulkAdd() {
    if (!token || !bulkNames.trim()) return;
    setBulkLoading(true);
    try {
      const entries = parseBulkEntries(bulkNames);
      if (entries.length === 0) { toast({ title: "Unesite barem jedno ime" }); return; }
      const results = await apiRequest<CreatedUcenik[]>("POST", "/muallim/ucenici/bulk", {
        entries, grupaId
      }, token);
      setCreatedStudents(results);
      const sRoditelja = results.filter(r => r.roditelj).length;
      toast({
        title: `${results.length} učenika dodano!`,
        description: sRoditelja > 0 ? `${sRoditelja} sa nalogom za roditelja` : undefined,
      });
      refreshStudents();
    } catch (err: any) {
      toast({ title: "Greška", description: err?.message || "Neuspješno dodavanje", variant: "destructive" });
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleMove() {
    if (!token || !moveStudent) return;
    setMoveLoading(true);
    try {
      await apiRequest("PUT", `/muallim/ucenici/${moveStudent.id}/grupa`, {
        grupaId: moveTargetGrupaId ? parseInt(moveTargetGrupaId) : null,
      }, token);
      toast({ title: "Učenik prebačen!" });
      setShowMoveModal(false);
      setMoveStudent(null);
      refreshStudents();
    } catch {
      toast({ title: "Greška", description: "Nije moguće prebaciti učenika", variant: "destructive" });
    } finally {
      setMoveLoading(false);
    }
  }

  async function handleAddExisting(ucenikId: number) {
    if (!token) return;
    try {
      await apiRequest("PUT", `/muallim/ucenici/${ucenikId}/grupa`, { grupaId }, token);
      toast({ title: "Učenik dodan u grupu!" });
      refreshStudents();
      setShowAddExisting(false);
    } catch {
      toast({ title: "Greška", variant: "destructive" });
    }
  }

  function openOcjena(u: Ucenik) {
    setOcjenaTarget(u);
    setNewOcjena({
      kategorija: "usmeno", ocjena: 5, lekcijaNaziv: "", napomena: "",
      datum: new Date().toISOString().split("T")[0],
    });
  }

  async function saveOcjena() {
    if (!token || !ocjenaTarget) return;
    setSavingOcjena(true);
    try {
      await apiRequest("POST", "/muallim/ocjene", {
        ucenikId: ocjenaTarget.id,
        kategorija: newOcjena.kategorija,
        ocjena: parseInt(String(newOcjena.ocjena)),
        lekcijaNaziv: newOcjena.lekcijaNaziv || null,
        napomena: newOcjena.napomena,
        datum: newOcjena.datum,
      }, token);
      toast({ title: "Ocjena dodana!", description: `${ocjenaTarget.displayName} — ${newOcjena.ocjena}` });
      setOcjenaTarget(null);
    } catch {
      toast({ title: "Greška", description: "Nije moguće dodati ocjenu", variant: "destructive" });
    } finally {
      setSavingOcjena(false);
    }
  }

  function openZadacaForOne(u: Ucenik) {
    setZadacaTarget(u);
    setNewZadaca({ naslov: "", opis: "", rokDo: "", lekcijaNaslov: "" });
    setShowZadacaModal(true);
  }

  function openZadacaForGroup() {
    setZadacaTarget(null);
    setNewZadaca({ naslov: "", opis: "", rokDo: "", lekcijaNaslov: "" });
    setShowZadacaModal(true);
  }

  async function saveZadaca() {
    if (!token || !newZadaca.naslov.trim()) {
      toast({ title: "Naslov je obavezan", variant: "destructive" });
      return;
    }
    setSavingZadaca(true);
    try {
      await apiRequest("POST", "/muallim/zadace", {
        grupaId,
        naslov: newZadaca.naslov.trim(),
        opis: newZadaca.opis.trim() || null,
        rokDo: newZadaca.rokDo || null,
        lekcijaNaslov: newZadaca.lekcijaNaslov || null,
        ucenikIds: zadacaTarget ? [zadacaTarget.id] : [],
      }, token);
      toast({
        title: "Zadaća dodana!",
        description: zadacaTarget ? `Pojedinačna za ${zadacaTarget.displayName}` : `Za cijelu grupu (${studentiGrupe.length} učenika)`,
      });
      setShowZadacaModal(false);
      setZadacaTarget(null);
    } catch (e: any) {
      toast({ title: "Greška", description: e?.message || "Nije moguće dodati zadaću", variant: "destructive" });
    } finally {
      setSavingZadaca(false);
    }
  }

  async function openParentReset(u: Ucenik) {
    if (!token) return;
    setParentResetTarget(u);
    setParentResetList([]);
    setParentResetResult(null);
    setParentResetLoading(true);
    try {
      const list = await apiRequest<RoditeljVeza[]>("GET", `/muallim/ucenici/${u.id}/roditelji`, undefined, token);
      setParentResetList(list);
    } catch {
      toast({ title: "Greška", description: "Ne mogu učitati roditelje", variant: "destructive" });
    } finally {
      setParentResetLoading(false);
    }
  }

  async function doParentReset(roditeljId: number) {
    if (!token) return;
    setParentResetWorking(roditeljId);
    try {
      const res = await apiRequest<{ ok: boolean; newPassword: string; displayName: string; username: string }>(
        "POST", `/muallim/roditelj/${roditeljId}/reset-password`, {}, token,
      );
      setParentResetResult({ id: roditeljId, password: res.newPassword, displayName: res.displayName });
      toast({ title: "Šifra roditelja resetovana!" });
    } catch (e: any) {
      toast({ title: "Greška", description: e?.message || "Reset neuspješan", variant: "destructive" });
    } finally {
      setParentResetWorking(null);
    }
  }

  async function handleHardDelete() {
    if (!token || !deleteTarget) return;
    setDeleteLoading(true);
    try {
      await apiRequest("DELETE", `/muallim/ucenik/${deleteTarget.id}/hard`, undefined, token);
      toast({ title: "Učenik obrisan", description: `${deleteTarget.displayName} i svi podaci su trajno uklonjeni.` });
      setDeleteTarget(null);
      refreshStudents();
    } catch (e: any) {
      toast({ title: "Greška", description: e?.message || "Brisanje neuspješno", variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  }

  function openPrintWindow(cards: { displayName: string; username: string; generatedPassword: string }[]) {
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Kartice učenika</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;800&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Nunito', sans-serif; }
  @media print { @page { margin: 10mm; } }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
  .card {
    border: 2px solid #14b8a6; border-radius: 16px; padding: 20px;
    page-break-inside: avoid; background: #f0fdfa;
  }
  .logo { text-align: center; font-size: 18px; font-weight: 800; color: #0d9488; margin-bottom: 12px; }
  .name { font-size: 16px; font-weight: 800; color: #134e4a; margin-bottom: 8px; }
  .field { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; border-bottom: 1px dashed #99f6e4; }
  .label { color: #5eead4; font-weight: 600; }
  .value { color: #134e4a; font-weight: 800; font-family: monospace; }
  .grupa-info { text-align: center; color: #5eead4; font-size: 11px; margin-top: 8px; }
</style></head><body>
<div class="grid">${cards.map(c => `
  <div class="card">
    <div class="logo">MEKTEB</div>
    <div class="name">${c.displayName}</div>
    <div class="field"><span class="label">Korisničko ime:</span><span class="value">${c.username}</span></div>
    <div class="field"><span class="label">Lozinka:</span><span class="value">${c.generatedPassword}</span></div>
    <div class="grupa-info">${grupa?.naziv || ""} · mekteb.net</div>
  </div>`).join("")}
</div></body></html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 300);
    }
  }

  function printCards() {
    if (createdStudents.length > 0) {
      openPrintWindow(createdStudents);
      return;
    }
    if (studentiGrupe.length === 0) return;
    setPrintLoading(true);
    const ucenikIds = studentiGrupe.map(s => s.id);
    apiRequest<CreatedUcenik[]>("POST", "/muallim/print-kartice", { ucenikIds }, token!)
      .then(cards => {
        openPrintWindow(cards);
        toast({ title: "Lozinke resetirane", description: "Nove lozinke su na karticama. Stare lozinke više ne važe." });
      })
      .catch(() => {
        toast({ title: "Greška", description: "Nije moguće generisati kartice", variant: "destructive" });
      })
      .finally(() => setPrintLoading(false));
  }

  const bezGrupe = sviStudenti.filter(u => {
    const gId = (u.profil as any)?.grupaId || (u as any).grupaId;
    return !gId || gId !== grupaId;
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-muted/50 rounded-2xl animate-pulse" />)}
        </div>
      </Layout>
    );
  }

  if (!grupa) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-muted-foreground font-medium">Grupa nije pronađena</p>
          <Button className="mt-4" onClick={() => { if (typeof window !== "undefined" && window.history.length > 1) window.history.back(); else setLocation("/muallim"); }}>Nazad</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <button onClick={() => { if (typeof window !== "undefined" && window.history.length > 1) window.history.back(); else setLocation("/muallim"); }} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-medium mb-6 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Nazad na panel
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-secondary to-emerald-600 rounded-2xl flex items-center justify-center shadow-md">
            <GraduationCap className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold text-foreground">{grupa.naziv}</h1>
            <p className="text-muted-foreground text-sm">
              {grupa.skolskaGodina}
              {grupa.daniNastave?.length > 0 && ` · ${grupa.daniNastave.join(", ")}`}
              {grupa.vrijemeNastave && ` · ${grupa.vrijemeNastave}`}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black text-secondary">{studentiGrupe.length}</div>
            <div className="text-xs text-muted-foreground font-medium">učenika</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <Button onClick={() => { setShowBulkAdd(true); setCreatedStudents([]); setBulkNames(""); }}
            className="rounded-xl font-bold flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Dodaj učenike
          </Button>
          <Button variant="outline" onClick={() => setShowAddExisting(true)}
            className="rounded-xl font-bold flex items-center gap-2">
            <Plus className="w-4 h-4" /> Dodaj postojećeg
          </Button>
          {studentiGrupe.length > 0 && (
            <Button variant="outline" onClick={openZadacaForGroup}
              className="rounded-xl font-bold flex items-center gap-2"
              data-testid="btn-zadaca-grupa"
            >
              <ClipboardList className="w-4 h-4" /> Zadaća za sve
            </Button>
          )}
          {(studentiGrupe.length > 0 || createdStudents.length > 0) && (
            <Button variant="outline" onClick={printCards} disabled={printLoading} className="rounded-xl font-bold flex items-center gap-2">
              {printLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} Printaj kartice
            </Button>
          )}
        </div>

        {showBulkAdd && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-border/50 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-foreground flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" /> Dodaj više učenika odjednom
              </h3>
              <button onClick={() => setShowBulkAdd(false)} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            {createdStudents.length > 0 ? (
              <div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
                  <p className="font-bold text-emerald-800 mb-3">{createdStudents.length} učenika uspješno kreirano!</p>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {createdStudents.map(s => (
                      <div key={s.id} className="space-y-1">
                        <div className="bg-white rounded-lg p-3 flex items-center justify-between text-sm border border-emerald-100">
                          <div>
                            <span className="font-bold text-foreground">Učenik: {s.displayName}</span>
                            <span className="text-muted-foreground ml-2 font-mono text-xs">{s.username}</span>
                          </div>
                          <span className="font-mono font-bold text-primary">{s.generatedPassword}</span>
                        </div>
                        {s.roditelj && (
                          <div className="bg-blue-50 rounded-lg p-3 flex items-center justify-between text-sm border border-blue-200 ml-4">
                            <div>
                              <span className="font-bold text-blue-900">Roditelj: {s.roditelj.displayName}</span>
                              <span className="text-blue-700/70 ml-2 font-mono text-xs">{s.roditelj.username}</span>
                            </div>
                            <span className="font-mono font-bold text-blue-700">{s.roditelj.generatedPassword}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={printCards} className="flex-1 rounded-xl font-bold flex items-center justify-center gap-2">
                    <Printer className="w-4 h-4" /> Printaj kartice s lozinkama
                  </Button>
                  <Button variant="outline" onClick={() => { setCreatedStudents([]); setBulkNames(""); }}
                    className="rounded-xl">Dodaj još</Button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Unesite imena učenika, svako u novi red. Ako želite kreirati i nalog za roditelja,
                  upišite ga iza znaka <code className="bg-muted px-1.5 py-0.5 rounded text-xs">|</code>:
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-xs text-blue-900">
                  <div className="font-bold mb-1">Primjer:</div>
                  <code className="block whitespace-pre-wrap font-mono leading-relaxed">
                    Amina Hasić | Senad Hasić{"\n"}Ahmed Begović{"\n"}Merjem Hadžić | Edina Hadžić
                  </code>
                  <p className="mt-2 text-blue-800">Roditelj ne ulazi u kvotu licenci.</p>
                </div>
                <textarea value={bulkNames} onChange={e => setBulkNames(e.target.value)}
                  rows={8} placeholder={"Amina Hasić | Senad Hasić\nAhmed Begović\nMerjem Hadžić | Edina Hadžić"}
                  className="w-full border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 bg-muted/20 resize-none font-medium font-mono text-sm" />
                {(() => {
                  const entries = parseBulkEntries(bulkNames);
                  const sRoditelja = entries.filter(e => e.roditelj).length;
                  return (
                    <p className="text-xs text-muted-foreground mt-1 mb-4">
                      {entries.length} učenika{sRoditelja > 0 ? ` · ${sRoditelja} sa roditeljem` : ""}
                    </p>
                  );
                })()}
                <Button onClick={handleBulkAdd} disabled={bulkLoading || !bulkNames.trim()}
                  className="w-full rounded-xl font-bold py-3">
                  {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                  {bulkLoading ? "Kreiranje..." : `Kreiraj ${parseBulkEntries(bulkNames).length} učenika`}
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {showAddExisting && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-border/50 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-foreground">Dodaj postojećeg učenika u grupu</h3>
              <button onClick={() => setShowAddExisting(false)} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            {bezGrupe.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nema dostupnih učenika za dodavanje</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {bezGrupe.map(u => (
                  <div key={u.id} className="flex items-center justify-between bg-muted/20 rounded-xl px-4 py-3">
                    <div>
                      <span className="font-bold text-foreground">{u.displayName}</span>
                      <span className="text-muted-foreground text-xs ml-2">{u.username}</span>
                    </div>
                    <Button size="sm" onClick={() => handleAddExisting(u.id)}
                      className="rounded-lg text-xs font-bold">
                      <Plus className="w-3 h-3 mr-1" /> Dodaj
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        <div className="bg-white border border-border/50 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border/30">
            <h3 className="font-extrabold text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-secondary" /> Učenici u grupi ({studentiGrupe.length})
            </h3>
          </div>
          {studentiGrupe.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nema učenika u ovoj grupi</p>
              <p className="text-sm mt-1">Dodaj učenike koristeći dugme iznad</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {studentiGrupe.map((u, i) => {
                const status = lekcijeStatus.get(u.id);
                return (
                  <motion.div key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="relative shrink-0">
                        <div className="w-9 h-9 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full flex items-center justify-center text-sm font-extrabold text-primary">
                          {u.displayName.charAt(0)}
                        </div>
                        {isOnline(u.lastSeenAt) && (
                          <span
                            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-white"
                            title="Online"
                            data-testid={`online-dot-${u.id}`}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-foreground truncate">{u.displayName}</p>
                          {isOnline(u.lastSeenAt) && (
                            <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">online</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <span className="font-mono">{u.username}</span>
                          {(u.totalScreentimeSec ?? 0) > 0 && (
                            <span className="text-[10px] font-bold text-muted-foreground/80" title="Ukupno vrijeme na platformi">
                              ⏱ {formatScreentime(u.totalScreentimeSec)}
                            </span>
                          )}
                          {status?.zadnjaLekcija ? (
                            <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5 font-bold">
                              <BookOpen className="w-3 h-3" />
                              Nivo {status.zadnjaLekcija.nivo} · {status.zadnjaLekcija.naslov}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-muted-foreground/70">
                              <BookOpen className="w-3 h-3" /> Nema završenih lekcija
                            </span>
                          )}
                          {status && status.zavrsenoLekcija > 0 && (
                            <span className="text-[10px] font-extrabold text-secondary">{status.zavrsenoLekcija} završeno</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap justify-end">
                      <button onClick={() => openOcjena(u)}
                        className="p-2 hover:bg-amber-50 rounded-lg text-amber-600 transition-colors" title="Daj ocjenu"
                        data-testid={`btn-ocjena-${u.id}`}
                      >
                        <Star className="w-4 h-4" />
                      </button>
                      <button onClick={() => openZadacaForOne(u)}
                        className="p-2 hover:bg-violet-50 rounded-lg text-violet-600 transition-colors" title="Zadaća samo za ovog učenika"
                        data-testid={`btn-zadaca-ucenik-${u.id}`}
                      >
                        <ClipboardList className="w-4 h-4" />
                      </button>
                      <button onClick={() => openParentReset(u)}
                        className="p-2 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors" title="Resetuj šifru roditelja"
                        data-testid={`btn-roditelj-reset-${u.id}`}
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setMoveStudent(u); setMoveTargetGrupaId(""); setShowMoveModal(true); }}
                        className="p-2 hover:bg-cyan-50 rounded-lg text-cyan-500 transition-colors" title="Prebaci u drugu grupu">
                        <ArrowRightLeft className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteTarget(u)}
                        className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors" title="Obriši učenika trajno"
                        data-testid={`btn-delete-${u.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <Link href={`/muallim/ucenik/${u.id}`}>
                        <button className="p-2 hover:bg-muted rounded-lg text-primary transition-colors" title="Detalji">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </Link>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {showMoveModal && moveStudent && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
              <h3 className="font-extrabold text-foreground mb-1">Prebaci učenika</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {moveStudent.displayName} → odaberi novu grupu
              </p>
              <select value={moveTargetGrupaId} onChange={e => setMoveTargetGrupaId(e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 bg-muted/20 mb-4">
                <option value="">Bez grupe</option>
                {sveGrupe.filter(g => g.id !== grupaId).map(g => (
                  <option key={g.id} value={g.id}>{g.naziv}</option>
                ))}
              </select>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowMoveModal(false)} className="flex-1 rounded-xl">
                  Otkaži
                </Button>
                <Button onClick={handleMove} disabled={moveLoading} className="flex-1 rounded-xl font-bold">
                  {moveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Prebaci"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {ocjenaTarget && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !savingOcjena && setOcjenaTarget(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="font-extrabold text-foreground mb-1 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500" /> Ocjena za {ocjenaTarget.displayName}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">Unesi ocjenu i pripadajuću kategoriju.</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-1">Kategorija</label>
                    <select value={newOcjena.kategorija}
                      onChange={e => setNewOcjena(o => ({ ...o, kategorija: e.target.value }))}
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                      <option value="usmeno">Usmeno</option>
                      <option value="ucenje">Učenje</option>
                      <option value="prakticno">Praktično</option>
                      <option value="ponasanje">Ponašanje</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-1">Ocjena (1–5)</label>
                    <select value={newOcjena.ocjena}
                      onChange={e => setNewOcjena(o => ({ ...o, ocjena: parseInt(e.target.value) }))}
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white font-bold">
                      {[5,4,3,2,1].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">Lekcija (opciono)</label>
                  <select value={newOcjena.lekcijaNaziv}
                    onChange={e => setNewOcjena(o => ({ ...o, lekcijaNaziv: e.target.value }))}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                    <option value="">— bez lekcije —</option>
                    {ilmihalLekcije.map(l => (
                      <option key={l.id} value={l.naslov}>Nivo {l.nivo}: {l.naslov}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">Datum</label>
                  <input type="date" value={newOcjena.datum}
                    onChange={e => setNewOcjena(o => ({ ...o, datum: e.target.value }))}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">Napomena (opciono)</label>
                  <textarea value={newOcjena.napomena} rows={2}
                    onChange={e => setNewOcjena(o => ({ ...o, napomena: e.target.value }))}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <Button variant="outline" onClick={() => setOcjenaTarget(null)} disabled={savingOcjena} className="flex-1 rounded-xl">
                  Otkaži
                </Button>
                <Button onClick={saveOcjena} disabled={savingOcjena} className="flex-1 rounded-xl font-bold">
                  {savingOcjena ? <Loader2 className="w-4 h-4 animate-spin" /> : "Spremi"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {showZadacaModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !savingZadaca && setShowZadacaModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="font-extrabold text-foreground mb-1 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-violet-600" />
                {zadacaTarget ? `Zadaća za ${zadacaTarget.displayName}` : `Zadaća za cijelu grupu`}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {zadacaTarget
                  ? "Vidljivo samo ovom učeniku."
                  : `Vidljivo svim učenicima u grupi (${studentiGrupe.length}).`}
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">Naslov *</label>
                  <input type="text" value={newZadaca.naslov}
                    onChange={e => setNewZadaca(z => ({ ...z, naslov: e.target.value }))}
                    placeholder="Npr. Nauči Fatihu napamet"
                    className="w-full border border-border rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid="input-zadaca-naslov"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">Opis</label>
                  <textarea value={newZadaca.opis} rows={3}
                    onChange={e => setNewZadaca(z => ({ ...z, opis: e.target.value }))}
                    placeholder="Detalji zadaće (opciono)"
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-1">Rok do</label>
                    <input type="date" value={newZadaca.rokDo}
                      onChange={e => setNewZadaca(z => ({ ...z, rokDo: e.target.value }))}
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-1">Lekcija (opciono)</label>
                    <select value={newZadaca.lekcijaNaslov}
                      onChange={e => setNewZadaca(z => ({ ...z, lekcijaNaslov: e.target.value }))}
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                      <option value="">— bez lekcije —</option>
                      {ilmihalLekcije.map(l => (
                        <option key={l.id} value={l.naslov}>Nivo {l.nivo}: {l.naslov}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <Button variant="outline" onClick={() => setShowZadacaModal(false)} disabled={savingZadaca} className="flex-1 rounded-xl">
                  Otkaži
                </Button>
                <Button onClick={saveZadaca} disabled={savingZadaca || !newZadaca.naslov.trim()} className="flex-1 rounded-xl font-bold"
                  data-testid="btn-save-zadaca"
                >
                  {savingZadaca ? <Loader2 className="w-4 h-4 animate-spin" /> : "Dodaj zadaću"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {parentResetTarget && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !parentResetWorking && setParentResetTarget(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="font-extrabold text-foreground flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-blue-600" /> Šifra roditelja
                </h3>
                <button onClick={() => setParentResetTarget(null)} className="p-1 hover:bg-muted rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Resetuj šifru roditelju učenika {parentResetTarget.displayName}.</p>

              {parentResetLoading ? (
                <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : parentResetList.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                  Ovaj učenik nema povezanog roditelja. Roditelja možeš dodati iz profila učenika (klikni strelicu desno).
                </div>
              ) : (
                <div className="space-y-2">
                  {parentResetList.map(r => (
                    <div key={r.id} className="bg-muted/20 rounded-xl p-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-foreground truncate">{r.displayName}</p>
                          <p className="text-xs font-mono text-muted-foreground">{r.username}</p>
                        </div>
                        <Button size="sm" onClick={() => doParentReset(r.id)}
                          disabled={parentResetWorking === r.id}
                          className="rounded-lg text-xs font-bold flex items-center gap-1.5">
                          {parentResetWorking === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <KeyRound className="w-3 h-3" />}
                          Resetuj šifru
                        </Button>
                      </div>
                      {parentResetResult?.id === r.id && (
                        <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg p-2 flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold text-emerald-700">Nova šifra:</span>
                          <code className="bg-white border border-emerald-300 rounded px-2 py-1 text-xs font-mono font-bold text-emerald-800">{parentResetResult.password}</code>
                          <Button size="sm" variant="outline"
                            onClick={async () => { try { await navigator.clipboard.writeText(parentResetResult.password); toast({ title: "Kopirano!" }); } catch {} }}
                            className="rounded-lg text-[11px] h-6 px-2">
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}

        {deleteTarget && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !deleteLoading && setDeleteTarget(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="font-extrabold text-foreground">Obriši učenika trajno?</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                <strong className="text-foreground">{deleteTarget.displayName}</strong> i svi njegovi podaci (ocjene, prisustvo, napredak, zadaće, povezivanja s roditeljima) bit će <strong className="text-red-600">trajno obrisani</strong>. Ova akcija se ne može poništiti.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 mb-4">
                Ako želiš samo da ga ukloniš iz grupe (zadržavajući podatke), iskoristi dugme "Prebaci u drugu grupu" i odaberi "Bez grupe".
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteLoading} className="flex-1 rounded-xl">
                  Otkaži
                </Button>
                <Button onClick={handleHardDelete} disabled={deleteLoading}
                  className="flex-1 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white"
                  data-testid="btn-confirm-delete"
                >
                  {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Obriši trajno"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </Layout>
  );
}
