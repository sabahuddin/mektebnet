import { useState, useEffect, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import {
  ArrowLeft, Users, UserPlus, Printer, ChevronRight, ArrowRightLeft,
  Loader2, GraduationCap, X, Plus, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

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
}

interface CreatedUcenik {
  id: number;
  displayName: string;
  username: string;
  generatedPassword: string;
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

  const grupaId = parseInt(id || "0");

  useEffect(() => {
    if (!token || !grupaId) return;
    Promise.all([
      apiRequest<Grupa[]>("GET", "/muallim/grupe", undefined, token),
      apiRequest<Ucenik[]>("GET", "/muallim/ucenici", undefined, token),
    ]).then(([grupe, ucenici]) => {
      const g = grupe.find(x => x.id === grupaId);
      setGrupa(g || null);
      setSveGrupe(grupe);
      setSviStudenti(ucenici);
      setStudentiGrupe(ucenici.filter(u => (u.profil as any)?.grupaId === grupaId || (u as any).grupaId === grupaId));
    }).catch(() => {}).finally(() => setIsLoading(false));
  }, [token, grupaId]);

  function refreshStudents() {
    if (!token) return;
    apiRequest<Ucenik[]>("GET", "/muallim/ucenici", undefined, token).then(ucenici => {
      setSviStudenti(ucenici);
      setStudentiGrupe(ucenici.filter(u => (u.profil as any)?.grupaId === grupaId || (u as any).grupaId === grupaId));
    }).catch(() => {});
  }

  async function handleBulkAdd() {
    if (!token || !bulkNames.trim()) return;
    setBulkLoading(true);
    try {
      const imena = bulkNames.split("\n").map(n => n.trim()).filter(Boolean);
      if (imena.length === 0) { toast({ title: "Unesite barem jedno ime" }); return; }
      const results = await apiRequest<CreatedUcenik[]>("POST", "/muallim/ucenici/bulk", {
        imena, grupaId
      }, token);
      setCreatedStudents(results);
      toast({ title: `${results.length} učenika dodano!` });
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

  async function handleRemoveFromGroup(ucenikId: number) {
    if (!token) return;
    try {
      await apiRequest("PUT", `/muallim/ucenici/${ucenikId}/grupa`, { grupaId: null }, token);
      toast({ title: "Učenik uklonjen iz grupe" });
      refreshStudents();
    } catch {
      toast({ title: "Greška", variant: "destructive" });
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
          <Button className="mt-4" onClick={() => setLocation("/muallim")}>Nazad</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <button onClick={() => setLocation("/muallim")} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-medium mb-6 text-sm transition-colors">
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
            <UserPlus className="w-4 h-4" /> Dodaj više učenika
          </Button>
          <Button variant="outline" onClick={() => setShowAddExisting(true)}
            className="rounded-xl font-bold flex items-center gap-2">
            <Plus className="w-4 h-4" /> Dodaj postojećeg
          </Button>
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
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {createdStudents.map(s => (
                      <div key={s.id} className="bg-white rounded-lg p-3 flex items-center justify-between text-sm border border-emerald-100">
                        <div>
                          <span className="font-bold text-foreground">{s.displayName}</span>
                          <span className="text-muted-foreground ml-2 font-mono text-xs">{s.username}</span>
                        </div>
                        <span className="font-mono font-bold text-primary">{s.generatedPassword}</span>
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
                <p className="text-sm text-muted-foreground mb-3">
                  Unesite imena učenika, svako ime u novi red:
                </p>
                <textarea value={bulkNames} onChange={e => setBulkNames(e.target.value)}
                  rows={8} placeholder={"Amina Hasić\nAhmed Begović\nMerjem Hadžić\n..."}
                  className="w-full border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 bg-muted/20 resize-none font-medium" />
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  {bulkNames.split("\n").filter(n => n.trim()).length} imena uneseno
                </p>
                <Button onClick={handleBulkAdd} disabled={bulkLoading || !bulkNames.trim()}
                  className="w-full rounded-xl font-bold py-3">
                  {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                  {bulkLoading ? "Kreiranje..." : `Kreiraj ${bulkNames.split("\n").filter(n => n.trim()).length} učenika`}
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
              {studentiGrupe.map((u, i) => (
                <motion.div key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-muted/20 transition-colors">
                  <div className="w-9 h-9 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full flex items-center justify-center text-sm font-extrabold text-primary">
                    {u.displayName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground truncate">{u.displayName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{u.username}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setMoveStudent(u); setMoveTargetGrupaId(""); setShowMoveModal(true); }}
                      className="p-2 hover:bg-blue-50 rounded-lg text-blue-500 transition-colors" title="Prebaci u drugu grupu">
                      <ArrowRightLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleRemoveFromGroup(u.id)}
                      className="p-2 hover:bg-red-50 rounded-lg text-red-400 transition-colors" title="Ukloni iz grupe">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <Link href={`/muallim/ucenik/${u.id}`}>
                      <button className="p-2 hover:bg-muted rounded-lg text-primary transition-colors" title="Detalji">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </Link>
                  </div>
                </motion.div>
              ))}
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
      </div>
    </Layout>
  );
}
