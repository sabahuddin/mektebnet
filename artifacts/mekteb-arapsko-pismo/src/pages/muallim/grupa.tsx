import { useState, useEffect, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import {
  ArrowLeft, Users, UserPlus, Printer, ChevronRight, ArrowRightLeft,
  Loader2, GraduationCap, X, Plus, Trash2, Star, ClipboardList, KeyRound,
  AlertTriangle, BookOpen, Copy, Check,
  CalendarCheck, Calendar, TrendingUp, FileText, Heart, Sparkles, ListOrdered, Pencil,
  User, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/language";
import { isOnline, formatScreentime } from "@/lib/utils";
import { LekcijaPicker } from "@/components/LekcijaPicker";

interface Grupa {
  id: number;
  muallimId?: number;
  naziv: string;
  skolskaGodina: string;
  datumPocetka?: string | null;
  datumKraja?: string | null;
  daniNastave: string[];
  vrijemeNastave: string;
  isArchived?: boolean;
  archivedAt?: string | null;
  muallimDisplayName?: string | null;
  sekundarniMuallimi?: { id: number; displayName: string }[];
}

interface ArhivaClan {
  ucenikId: number;
  displayName: string;
  username: string;
  archivedAt: string;
}

function fmtDatum(s?: string | null) {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("bs-BA", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface Ucenik {
  id: number;
  displayName: string;
  username: string;
  profil?: { grupaId?: number };
  lastSeenAt?: string | null;
  totalScreentimeSec?: number | null;
  roditeljPovezan?: boolean;
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
  roditelji?: Array<{
    username: string;
    displayName: string | null;
    password: string;
  }>;
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
  const { t } = useLanguage();
  const printRef = useRef<HTMLDivElement>(null);
  const [printLoading, setPrintLoading] = useState(false);

  const [grupa, setGrupa] = useState<Grupa | null>(null);
  const [zadacaBadge, setZadacaBadge] = useState(0);
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
  const [arhivaClanovi, setArhivaClanovi] = useState<ArhivaClan[]>([]);

  // Ocjena modal
  const [ocjenaTarget, setOcjenaTarget] = useState<Ucenik | null>(null);
  const [newOcjena, setNewOcjena] = useState({
    kategorija: "usmeno", ocjena: 6, lekcijaNaziv: "", napomena: "",
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

  // Promjena muallima grupe (samo za glavnog)
  const [isGlavni, setIsGlavni] = useState(false);
  const [mektebMuallimi, setMektebMuallimi] = useState<{ userId: number; displayName: string; isGlavni: boolean }[]>([]);
  const [showChangeMuallim, setShowChangeMuallim] = useState(false);
  const [changeMuallimId, setChangeMuallimId] = useState<number | null>(null);
  const [changingMuallim, setChangingMuallim] = useState(false);

  // Sekundarni muallimi grupe
  const [sekundarniMuallimi, setSekundarniMuallimi] = useState<{ id: number; displayName: string }[]>([]);
  const [showAddSecMuallim, setShowAddSecMuallim] = useState(false);
  const [addSecMuallimId, setAddSecMuallimId] = useState<number | "">("");
  const [addingSecMuallim, setAddingSecMuallim] = useState(false);

  // Reset šifre roditelja
  const [parentResetTarget, setParentResetTarget] = useState<Ucenik | null>(null);
  const [parentResetList, setParentResetList] = useState<RoditeljVeza[]>([]);
  const [parentResetLoading, setParentResetLoading] = useState(false);
  const [parentResetResult, setParentResetResult] = useState<{ id: number; password: string; displayName: string } | null>(null);
  const [parentResetWorking, setParentResetWorking] = useState<number | null>(null);

  const grupaId = parseInt(id || "0");

  // Učitaj muallime mekteba (403 = korisnik nije glavni → nema modal za promjenu)
  useEffect(() => {
    if (!token) return;
    apiRequest<{ userId: number; displayName: string; isGlavni: boolean }[]>("GET", "/muallim/mekteb/muallimi", undefined, token)
      .then(lista => { setMektebMuallimi(lista); setIsGlavni(true); })
      .catch(() => { setIsGlavni(false); });
  }, [token]);

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
      setSekundarniMuallimi(g?.sekundarniMuallimi ?? []);
      if (g?.isArchived) {
        apiRequest<ArhivaClan[]>("GET", `/muallim/grupe/${grupaId}/arhiva-clanovi`, undefined, token)
          .then(setArhivaClanovi).catch(() => {});
      }
      setSveGrupe(grupe);
      setSviStudenti(ucenici);
      setStudentiGrupe(ucenici.filter(u => (u.profil as any)?.grupaId === grupaId || (u as any).grupaId === grupaId));
      setLekcijeStatus(new Map(status.map(s => [s.ucenikId, s])));
      setIlmihalLekcije(lekcije);
    }).catch(() => {}).finally(() => setIsLoading(false));
    apiRequest<{ count: number }>("GET", `/muallim/zadace-pregled-badge?grupaId=${grupaId}`, undefined, token)
      .then(r => setZadacaBadge(r?.count ?? 0)).catch(() => {});
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
      if (entries.length === 0) { toast({ title: t("Unesite barem jedno ime") }); return; }
      const results = await apiRequest<CreatedUcenik[]>("POST", "/muallim/ucenici/bulk", {
        entries, grupaId
      }, token);
      setCreatedStudents(results);
      const sRoditelja = results.filter(r => r.roditelj).length;
      toast({
        title: t("{n} učenika dodano!", { n: String(results.length) }),
        description: sRoditelja > 0 ? t("{n} sa nalogom za roditelja", { n: String(sRoditelja) }) : undefined,
      });
      refreshStudents();
    } catch (err: any) {
      toast({ title: t("Greška"), description: err?.message || t("Neuspješno dodavanje"), variant: "destructive" });
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
      toast({ title: t("Učenik prebačen!") });
      setShowMoveModal(false);
      setMoveStudent(null);
      refreshStudents();
    } catch {
      toast({ title: t("Greška"), description: t("Nije moguće prebaciti učenika"), variant: "destructive" });
    } finally {
      setMoveLoading(false);
    }
  }

  async function handleAddExisting(ucenikId: number) {
    if (!token) return;
    try {
      await apiRequest("PUT", `/muallim/ucenici/${ucenikId}/grupa`, { grupaId }, token);
      toast({ title: t("Učenik dodan u grupu!") });
      refreshStudents();
      setShowAddExisting(false);
    } catch {
      toast({ title: t("Greška"), variant: "destructive" });
    }
  }

  function openOcjena(u: Ucenik) {
    setOcjenaTarget(u);
    setNewOcjena({
      kategorija: "usmeno", ocjena: 6, lekcijaNaziv: "", napomena: "",
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
      toast({ title: t("Ocjena dodana!"), description: `${ocjenaTarget.displayName} — ${newOcjena.ocjena}` });
      setOcjenaTarget(null);
    } catch {
      toast({ title: t("Greška"), description: t("Nije moguće dodati ocjenu"), variant: "destructive" });
    } finally {
      setSavingOcjena(false);
    }
  }

  function openZadacaForOne(u: Ucenik) {
    setZadacaTarget(u);
    setNewZadaca({ naslov: "", opis: "", rokDo: "", lekcijaNaslov: "" });
    setShowZadacaModal(true);
  }

  async function saveZadaca() {
    if (!token || !newZadaca.naslov.trim()) {
      toast({ title: t("Naslov je obavezan"), variant: "destructive" });
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
        title: t("Zadaća dodana!"),
        description: zadacaTarget ? t("Pojedinačna za {ime}", { ime: zadacaTarget.displayName }) : t("Za cijelu grupu ({n} učenika)", { n: String(studentiGrupe.length) }),
      });
      setShowZadacaModal(false);
      setZadacaTarget(null);
    } catch (e: any) {
      toast({ title: t("Greška"), description: e?.message || t("Nije moguće dodati zadaću"), variant: "destructive" });
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
      toast({ title: t("Greška"), description: t("Ne mogu učitati roditelje"), variant: "destructive" });
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
      toast({ title: t("Šifra roditelja vraćena na standardnu!") });
    } catch (e: any) {
      toast({ title: t("Greška"), description: e?.message || t("Reset neuspješan"), variant: "destructive" });
    } finally {
      setParentResetWorking(null);
    }
  }

  async function handleHardDelete() {
    if (!token || !deleteTarget) return;
    setDeleteLoading(true);
    try {
      await apiRequest("DELETE", `/muallim/ucenik/${deleteTarget.id}/hard`, undefined, token);
      toast({ title: t("Učenik obrisan"), description: t("{ime} i svi podaci su trajno uklonjeni.", { ime: deleteTarget.displayName }) });
      setDeleteTarget(null);
      refreshStudents();
    } catch (e: any) {
      toast({ title: t("Greška"), description: e?.message || t("Brisanje neuspješno"), variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  }

  function openPrintWindow(cards: CreatedUcenik[]) {
    const esc = (s: string) => s.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!));
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${t("Kartice učenika")}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;800&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Nunito', sans-serif; }
  @media print { @page { margin: 8mm; } }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .card {
    border: 2px solid #14b8a6; border-radius: 12px; padding: 10px;
    page-break-inside: avoid; background: #f0fdfa;
  }
  .logo { text-align: center; font-size: 14px; font-weight: 800; color: #0d9488; margin-bottom: 5px; }
  .name { font-size: 13px; font-weight: 800; color: #134e4a; margin-bottom: 3px; }
  .section-title { font-size: 10px; font-weight: 800; color: #0d9488; text-transform: uppercase; letter-spacing: 0.5px; margin: 6px 0 2px; }
  .field { display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0; border-bottom: 1px dashed #99f6e4; gap: 6px; }
  .label { color: #5eead4; font-weight: 600; flex-shrink: 0; }
  .value { color: #134e4a; font-weight: 800; font-family: monospace; text-align: right; word-break: break-all; }
  .parent-block { background: #fef3c7; border: 1px dashed #f59e0b; border-radius: 8px; padding: 5px 8px; margin-top: 5px; }
  .parent-block .field { border-bottom-color: #fde68a; }
  .parent-block .label { color: #b45309; }
  .parent-block .value { color: #78350f; }
  .grupa-info { text-align: center; color: #5eead4; font-size: 9px; margin-top: 5px; }
</style></head><body>
<div class="grid">${cards.map(c => `
  <div class="card">
    <div class="logo">MEKTEB</div>
    <div class="name">${esc(c.displayName)}</div>
    <div class="field"><span class="label">${t("Korisničko ime:")}</span><span class="value">${esc(c.username)}</span></div>
    <div class="field"><span class="label">${t("Lozinka:")}</span><span class="value">${esc(c.generatedPassword)}</span></div>
    ${((): string => {
      // Normalizuj: singular c.roditelj (generatedPassword) i plural c.roditelji (password)
      // u jedinstven niz da print window uvijek prikaže roditelja bez obzira na izvor.
      const rods: Array<{username: string; displayName: string | null; password: string}> =
        c.roditelji && c.roditelji.length > 0
          ? c.roditelji.map(r => ({ username: r.username, displayName: r.displayName ?? null, password: r.password }))
          : c.roditelj
            ? [{ username: c.roditelj.username, displayName: c.roditelj.displayName, password: c.roditelj.generatedPassword }]
            : [];
      return rods.map((r, idx) => `
    <div class="parent-block">
      <div class="section-title">${t("Roditelj")}${rods.length > 1 ? ` ${idx + 1}` : ""}${r.displayName ? ` — ${esc(r.displayName)}` : ""}</div>
      <div class="field"><span class="label">${t("Korisničko ime:")}</span><span class="value">${esc(r.username)}</span></div>
      <div class="field"><span class="label">${t("Lozinka:")}</span><span class="value">${esc(r.password)}</span></div>
    </div>`).join("");
    })()}
    <div class="grupa-info">${esc(grupa?.naziv || "")} · mekteb.net</div>
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
    if (studentiGrupe.length === 0) return;
    setPrintLoading(true);
    const ucenikIds = studentiGrupe.map(s => s.id);
    apiRequest<CreatedUcenik[]>("POST", "/muallim/print-kartice", { ucenikIds }, token!)
      .then(cards => {
        openPrintWindow(cards);
        toast({ title: t("Kartice su spremne za štampu"), description: t("Prikazane su trenutne standardne lozinke — štampanje ne mijenja i ne resetuje nijednu šifru.") });
      })
      .catch(() => {
        toast({ title: t("Greška"), description: t("Nije moguće generisati kartice"), variant: "destructive" });
      })
      .finally(() => setPrintLoading(false));
  }

  async function confirmChangeMuallim() {
    if (!token || !grupa || changeMuallimId === null) return;
    setChangingMuallim(true);
    try {
      const updated = await apiRequest<Grupa>("PUT", `/muallim/grupe/${grupa.id}`, { muallimId: changeMuallimId }, token);
      setGrupa(prev => prev ? { ...prev, muallimId: updated.muallimId, muallimDisplayName: updated.muallimDisplayName } : prev);
      setShowChangeMuallim(false);
      toast({ title: t("Muallim grupe promijenjen") });
    } catch {
      toast({ title: t("Greška"), variant: "destructive" });
    } finally {
      setChangingMuallim(false);
    }
  }

  async function addSekundarniMuallim() {
    if (!token || !grupa || !addSecMuallimId) return;
    setAddingSecMuallim(true);
    try {
      const res = await apiRequest<{ ok: boolean; muallim: { id: number; displayName: string } }>(
        "POST", `/muallim/grupe/${grupa.id}/muallimi`, { muallimId: Number(addSecMuallimId) }, token,
      );
      setSekundarniMuallimi(prev => [...prev.filter(m => m.id !== res.muallim.id), res.muallim]);
      setShowAddSecMuallim(false);
      setAddSecMuallimId("");
      toast({ title: t("Muallim dodan grupi!") });
    } catch (e: any) {
      toast({ title: t("Greška"), description: e?.message, variant: "destructive" });
    } finally {
      setAddingSecMuallim(false);
    }
  }

  async function removeSekundarniMuallim(muallimId: number) {
    if (!token || !grupa) return;
    try {
      await apiRequest("DELETE", `/muallim/grupe/${grupa.id}/muallimi/${muallimId}`, undefined, token);
      setSekundarniMuallimi(prev => prev.filter(m => m.id !== muallimId));
      toast({ title: t("Muallim uklonjen iz grupe") });
    } catch {
      toast({ title: t("Greška"), variant: "destructive" });
    }
  }

  // Učenici bez ikakve grupe — mogu se dodati u ovu grupu.
  // Za glavnog muallima: svi slobodni učenici džemata.
  const bezGrupe = sviStudenti.filter(u => {
    const gId = (u.profil as any)?.grupaId || (u as any).grupaId;
    return !gId;
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
          <p className="text-muted-foreground font-medium">{t("Grupa nije pronađena")}</p>
          <Button className="mt-4" onClick={() => { if (typeof window !== "undefined" && window.history.length > 1) window.history.back(); else setLocation("/muallim"); }}>{t("Nazad")}</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Sticky traka na vrhu — uvijek vidljiva pri skrolu, jasno pokazuje
          u kojoj smo grupi i kako izaći nazad na panel. Header layout-a je
          h-16 (top-16), pa naša traka sjeda odmah ispod njega. */}
      <div className="sticky top-16 z-30 -mx-4 px-4 py-2.5 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 border-b border-emerald-200/70 shadow-sm mb-6">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button
            onClick={() => setLocation("/muallim?tab=grupe")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-bold text-sm transition-colors shrink-0"
            data-testid="btn-nazad-na-panel"
          >
            <ArrowLeft className="w-4 h-4" /> {t("Nazad")}
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <GraduationCap className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="font-extrabold text-foreground truncate">{grupa.naziv}</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">· {t("{n} učenika", { n: String(studentiGrupe.length) })}</span>
          </div>
          <button
            onClick={() => setLocation(`/muallim/grupa/${grupa.id}/uredi`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-bold text-sm transition-colors shrink-0"
            data-testid="btn-uredi-grupu"
          >
            <Pencil className="w-4 h-4" /> <span className="hidden sm:inline">{t("Uredi")}</span>
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
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
            {(grupa.datumPocetka || grupa.datumKraja) && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("Mektebska godina: {od} – {do}", { od: fmtDatum(grupa.datumPocetka) || "—", do: fmtDatum(grupa.datumKraja) || "—" })}
              </p>
            )}
            {/* Muallim(i) grupe */}
            <div className="mt-1.5 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground">
                  {t("Muallim:")} <span className="font-semibold text-foreground">{grupa.muallimDisplayName || t("—")}</span>
                </span>
                {isGlavni && (
                  <button
                    onClick={() => { setChangeMuallimId(grupa.muallimId ?? null); setShowChangeMuallim(true); }}
                    className="ml-1 flex items-center gap-0.5 text-xs text-emerald-600 hover:text-emerald-800 font-bold transition-colors"
                    title={t("Promijeni muallima grupe")}
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {/* Sekundarni muallimi */}
              {sekundarniMuallimi.map(sm => (
                <div key={sm.id} className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="text-xs text-blue-700 font-semibold">{sm.displayName}</span>
                  {isGlavni && (
                    <button
                      onClick={() => removeSekundarniMuallim(sm.id)}
                      className="ml-0.5 text-red-400 hover:text-red-600 transition-colors"
                      title={t("Ukloni muallima iz grupe")}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              {/* Dugme za dodavanje sekundarnog muallima */}
              {isGlavni && !showAddSecMuallim && (
                <button
                  onClick={() => setShowAddSecMuallim(true)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-blue-600 transition-colors mt-0.5"
                >
                  <Plus className="w-3 h-3" /> {t("Dodaj muallima grupi")}
                </button>
              )}
              {isGlavni && showAddSecMuallim && (
                <div className="flex items-center gap-1.5 mt-1">
                  <select
                    value={addSecMuallimId}
                    onChange={e => setAddSecMuallimId(e.target.value ? Number(e.target.value) : "")}
                    className="text-xs border border-border rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">{t("— odaberi muallima —")}</option>
                    {mektebMuallimi
                      .filter(m => m.userId !== grupa.muallimId && !sekundarniMuallimi.find(s => s.id === m.userId))
                      .map(m => <option key={m.userId} value={m.userId}>{m.displayName}</option>)
                    }
                  </select>
                  <Button size="sm" className="h-7 px-2 text-xs rounded-lg" disabled={!addSecMuallimId || addingSecMuallim} onClick={addSekundarniMuallim}>
                    {addingSecMuallim ? <Loader2 className="w-3 h-3 animate-spin" /> : t("Dodaj")}
                  </Button>
                  <button onClick={() => { setShowAddSecMuallim(false); setAddSecMuallimId(""); }} className="text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black text-secondary">{studentiGrupe.length}</div>
            <div className="text-xs text-muted-foreground font-medium">{t("učenika")}</div>
          </div>
        </div>

        {/* Modul kartice za ovu grupu — vode na odgovarajuće stranice/tabove
            sa pre-selektovanom grupom (preko ?grupaId=… za panel-tabove). */}
        {grupa && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-6">
            {[
              { label: t("Prisustvo"), icon: CalendarCheck, href: `/muallim/prisustvo/${grupa.id}`, color: "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100" },
              { label: t("Plan lekcija"), icon: BookOpen, href: `/muallim?tab=plan&grupaId=${grupa.id}`, color: "bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100" },
              { label: t("Raspored lekcija"), icon: ListOrdered, href: `/muallim/raspored/${grupa.id}`, color: "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100" },
              { label: t("Kalendar"), icon: Calendar, href: `/muallim?tab=kalendar&grupaId=${grupa.id}`, color: "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100" },
              { label: t("Statistika"), icon: TrendingUp, href: `/muallim?tab=statistika&grupaId=${grupa.id}`, color: "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100" },
              { label: t("Zadaća"), icon: ClipboardList, href: `/muallim?tab=zadace&grupaId=${grupa.id}`, color: "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100", badge: zadacaBadge },
              { label: t("Izvještaji"), icon: FileText, href: `/muallim/izvjestaj/grupa/${grupa.id}`, color: "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100" },
              { label: t("Roditelji"), icon: Heart, href: `/muallim?tab=roditelji&grupaId=${grupa.id}`, color: "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100" },
              { label: t("H5P statistika"), icon: Sparkles, href: `/muallim/h5p-statistika?grupaId=${grupa.id}`, color: "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700 hover:bg-fuchsia-100" },
            ].map(card => (
              <Link
                key={card.label}
                href={card.href}
                className={`relative flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 font-bold text-sm transition-all ${card.color}`}
              >
                <card.icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{card.label}</span>
                {(card.badge ?? 0) > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1.5 flex items-center justify-center rounded-full bg-red-600 text-white text-[11px] font-black shadow-md">
                    {card.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}

        {grupa.isArchived && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 mb-6">
            <p className="font-extrabold text-amber-800 mb-1">{t("Grupa je arhivirana")}</p>
            <p className="text-sm text-amber-700">
              {t("Podaci grupe (ocjene, prisustvo, članstvo) su sačuvani. Učenici su oslobođeni i mogu se dodati u druge grupe.")}
              {grupa.archivedAt ? ` (${new Date(grupa.archivedAt).toLocaleDateString("bs-BA")})` : ""}
            </p>
            {arhivaClanovi.length > 0 && (
              <div className="mt-3">
                <p className="font-bold text-amber-800 text-sm mb-2">{t("Bivši članovi grupe")} ({arhivaClanovi.length}):</p>
                <div className="flex flex-wrap gap-2">
                  {arhivaClanovi.map(c => (
                    <span key={c.ucenikId} className="bg-white border border-amber-200 rounded-lg px-2.5 py-1 text-sm font-medium text-foreground">
                      {c.displayName || c.username}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          {!grupa.isArchived && (
            <>
              <Button onClick={() => { setShowBulkAdd(true); setCreatedStudents([]); setBulkNames(""); }}
                className="rounded-xl font-bold flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> {t("Dodaj učenike")}
              </Button>
              <Button variant="outline" onClick={() => setShowAddExisting(true)}
                className="rounded-xl font-bold flex items-center gap-2">
                <Plus className="w-4 h-4" /> {t("Dodaj postojećeg")}
              </Button>
            </>
          )}
          {(studentiGrupe.length > 0 || createdStudents.length > 0) && (
            <Button variant="outline" onClick={printCards} disabled={printLoading} className="rounded-xl font-bold flex items-center gap-2">
              {printLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} {t("Printaj kartice")}
            </Button>
          )}
        </div>

        {showBulkAdd && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-border/50 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-foreground flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" /> {t("Dodaj više učenika odjednom")}
              </h3>
              <button onClick={() => setShowBulkAdd(false)} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            {createdStudents.length > 0 ? (
              <div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
                  <p className="font-bold text-emerald-800 mb-3">{t("{n} učenika uspješno kreirano!", { n: String(createdStudents.length) })}</p>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {createdStudents.map(s => (
                      <div key={s.id} className="space-y-1">
                        <div className="bg-white rounded-lg p-3 flex items-center justify-between text-sm border border-emerald-100">
                          <div>
                            <span className="font-bold text-foreground">{t("Učenik: {ime}", { ime: s.displayName })}</span>
                            <span className="text-muted-foreground ml-2 font-mono text-xs">{s.username}</span>
                          </div>
                          <span className="font-mono font-bold text-primary">{s.generatedPassword}</span>
                        </div>
                        {s.roditelj && (
                          <div className="bg-blue-50 rounded-lg p-3 flex items-center justify-between text-sm border border-blue-200 ml-4">
                            <div>
                              <span className="font-bold text-blue-900">{t("Roditelj: {ime}", { ime: s.roditelj.displayName })}</span>
                              <span className="text-blue-700/70 ml-2 font-mono text-xs">{s.roditelj.username}</span>
                            </div>
                            <span className="font-mono font-bold text-blue-700">{s.roditelj.generatedPassword}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3 text-sm text-blue-900 flex items-start gap-2">
                  <Printer className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{t("Kartice s lozinkama možete odštampati bilo kada preko dugmeta \"Printaj kartice\" na vrhu stranice grupe. Štampanje samo prikazuje trenutne lozinke i ništa ne mijenja.")}</span>
                </div>
                <div className="flex gap-3">
                  <Button onClick={() => { setCreatedStudents([]); setBulkNames(""); }}
                    className="flex-1 rounded-xl font-bold">{t("Dodaj još")}</Button>
                  <Button variant="outline" onClick={() => { setCreatedStudents([]); setShowBulkAdd(false); }}
                    className="rounded-xl">{t("Gotovo")}</Button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  {t("Unesite imena učenika, svako u novi red. Ako želite kreirati i nalog za roditelja, upišite ga iza znaka")}{" "}
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">|</code>:
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-xs text-blue-900">
                  <div className="font-bold mb-1">{t("Primjer:")}</div>
                  <code className="block whitespace-pre-wrap font-mono leading-relaxed">
                    Amina Hasić | Senad Hasić{"\n"}Ahmed Begović{"\n"}Merjem Hadžić | Edina Hadžić
                  </code>
                  <p className="mt-2 text-blue-800">{t("Roditelj ne ulazi u kvotu licenci.")}</p>
                </div>
                <textarea value={bulkNames} onChange={e => setBulkNames(e.target.value)}
                  rows={8} placeholder={"Amina Hasić | Senad Hasić\nAhmed Begović\nMerjem Hadžić | Edina Hadžić"}
                  className="w-full border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 bg-muted/20 resize-none font-medium font-mono text-sm" />
                {(() => {
                  const entries = parseBulkEntries(bulkNames);
                  const sRoditelja = entries.filter(e => e.roditelj).length;
                  return (
                    <p className="text-xs text-muted-foreground mt-1 mb-4">
                      {t("{n} učenika", { n: String(entries.length) })}{sRoditelja > 0 ? t(" · {r} sa roditeljem", { r: String(sRoditelja) }) : ""}
                    </p>
                  );
                })()}
                <Button onClick={handleBulkAdd} disabled={bulkLoading || !bulkNames.trim()}
                  className="w-full rounded-xl font-bold py-3">
                  {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                  {bulkLoading ? t("Kreiranje...") : t("Kreiraj {n} učenika", { n: String(parseBulkEntries(bulkNames).length) })}
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {showAddExisting && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-border/50 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-foreground">{t("Dodaj postojećeg učenika u grupu")}</h3>
              <button onClick={() => setShowAddExisting(false)} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            {bezGrupe.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t("Nema dostupnih učenika za dodavanje")}</p>
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
                      <Plus className="w-3 h-3 mr-1" /> {t("Dodaj")}
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
              <Users className="w-5 h-5 text-secondary" /> {t("Učenici u grupi ({n})", { n: String(studentiGrupe.length) })}
            </h3>
          </div>
          {studentiGrupe.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">{t("Nema učenika u ovoj grupi")}</p>
              <p className="text-sm mt-1">{t("Dodaj učenike koristeći dugme iznad")}</p>
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
                            title={t("Online")}
                            data-testid={`online-dot-${u.id}`}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-foreground truncate">{u.displayName}</p>
                          {u.roditeljPovezan && (
                            <span
                              className="inline-flex items-center justify-center shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-black border border-emerald-200"
                              title={t("Roditelj povezan")}
                              aria-label={t("Roditelj povezan")}
                              data-testid={`roditelj-povezan-grupa-${u.id}`}
                            >
                              R
                            </span>
                          )}
                          {isOnline(u.lastSeenAt) && (
                            <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">{t("online")}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <span className="font-mono">{u.username}</span>
                          {(u.totalScreentimeSec ?? 0) > 0 && (
                            <span className="text-[10px] font-bold text-muted-foreground/80" title={t("Ukupno vrijeme na platformi")}>
                              ⏱ {formatScreentime(u.totalScreentimeSec)}
                            </span>
                          )}
                          {status?.zadnjaLekcija ? (
                            <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5 font-bold">
                              <BookOpen className="w-3 h-3" />
                              {t("Nivo {nivo} · {naslov}", { nivo: String(status.zadnjaLekcija.nivo), naslov: status.zadnjaLekcija.naslov })}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-muted-foreground/70">
                              <BookOpen className="w-3 h-3" /> {t("Nema završenih lekcija")}
                            </span>
                          )}
                          {status && status.zavrsenoLekcija > 0 && (
                            <span className="text-[10px] font-extrabold text-secondary">{t("{n} završeno", { n: String(status.zavrsenoLekcija) })}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap justify-end">
                      <button onClick={() => openOcjena(u)}
                        className="p-2 hover:bg-amber-50 rounded-lg text-amber-600 transition-colors" title={t("Daj ocjenu")}
                        data-testid={`btn-ocjena-${u.id}`}
                      >
                        <Star className="w-4 h-4" />
                      </button>
                      <button onClick={() => openZadacaForOne(u)}
                        className="p-2 hover:bg-violet-50 rounded-lg text-violet-600 transition-colors" title={t("Zadaća samo za ovog učenika")}
                        data-testid={`btn-zadaca-ucenik-${u.id}`}
                      >
                        <ClipboardList className="w-4 h-4" />
                      </button>
                      <button onClick={() => openParentReset(u)}
                        className="p-2 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors" title={t("Resetuj šifru roditelja")}
                        data-testid={`btn-roditelj-reset-${u.id}`}
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setMoveStudent(u); setMoveTargetGrupaId(""); setShowMoveModal(true); }}
                        className="p-2 hover:bg-cyan-50 rounded-lg text-cyan-500 transition-colors" title={t("Prebaci u drugu grupu")}>
                        <ArrowRightLeft className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteTarget(u)}
                        className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors" title={t("Obriši učenika trajno")}
                        data-testid={`btn-delete-${u.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <Link href={`/muallim/ucenik/${u.id}`}>
                        <button className="p-2 hover:bg-muted rounded-lg text-primary transition-colors" title={t("Detalji")}>
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
              <h3 className="font-extrabold text-foreground mb-1">{t("Prebaci učenika")}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("{ime} → odaberi novu grupu", { ime: moveStudent.displayName })}
              </p>
              <select value={moveTargetGrupaId} onChange={e => setMoveTargetGrupaId(e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 bg-muted/20 mb-4">
                <option value="">{t("Bez grupe")}</option>
                {sveGrupe.filter(g => !g.isArchived && g.id !== grupaId).map(g => (
                  <option key={g.id} value={g.id}>
                    {g.muallimDisplayName ? `${g.naziv} (${g.muallimDisplayName})` : g.naziv}
                  </option>
                ))}
              </select>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowMoveModal(false)} className="flex-1 rounded-xl">
                  {t("Otkaži")}
                </Button>
                <Button onClick={handleMove} disabled={moveLoading} className="flex-1 rounded-xl font-bold">
                  {moveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Prebaci")}
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
                <Star className="w-5 h-5 text-amber-500" /> {t("Ocjena za {ime}", { ime: ocjenaTarget.displayName })}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">{t("Unesi ocjenu i pripadajuću kategoriju.")}</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-1">{t("Kategorija")}</label>
                    <select value={newOcjena.kategorija}
                      onChange={e => setNewOcjena(o => ({ ...o, kategorija: e.target.value }))}
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                      <option value="usmeno">{t("Usmeno")}</option>
                      <option value="ucenje">{t("Učenje")}</option>
                      <option value="prakticno">{t("Praktično")}</option>
                      <option value="ponasanje">{t("Ponašanje")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-1">{t("Ocjena (1–6)")}</label>
                    <select value={newOcjena.ocjena}
                      onChange={e => setNewOcjena(o => ({ ...o, ocjena: parseInt(e.target.value) }))}
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white font-bold">
                      {[6,5,4,3,2,1].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">{t("Lekcija")}</label>
                  <LekcijaPicker
                    lekcije={ilmihalLekcije}
                    value={newOcjena.lekcijaNaziv}
                    onChange={v => setNewOcjena(o => ({ ...o, lekcijaNaziv: v }))}
                    placeholder={t("Pretraži lekciju ili upiši broj…")}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">{t("Datum")}</label>
                  <input type="date" value={newOcjena.datum}
                    onChange={e => setNewOcjena(o => ({ ...o, datum: e.target.value }))}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">{t("Napomena (opciono)")}</label>
                  <textarea value={newOcjena.napomena} rows={2}
                    onChange={e => setNewOcjena(o => ({ ...o, napomena: e.target.value }))}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <Button variant="outline" onClick={() => setOcjenaTarget(null)} disabled={savingOcjena} className="flex-1 rounded-xl">
                  {t("Otkaži")}
                </Button>
                <Button onClick={saveOcjena} disabled={savingOcjena} className="flex-1 rounded-xl font-bold">
                  {savingOcjena ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Spremi")}
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
                {zadacaTarget ? t("Zadaća za {ime}", { ime: zadacaTarget.displayName }) : t("Zadaća za cijelu grupu")}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {zadacaTarget
                  ? t("Vidljivo samo ovom učeniku.")
                  : t("Vidljivo svim učenicima u grupi ({n}).", { n: String(studentiGrupe.length) })}
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">{t("Naslov *")}</label>
                  <input type="text" value={newZadaca.naslov}
                    onChange={e => setNewZadaca(z => ({ ...z, naslov: e.target.value }))}
                    placeholder={t("Npr. Nauči Fatihu napamet")}
                    className="w-full border border-border rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid="input-zadaca-naslov"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">{t("Opis")}</label>
                  <textarea value={newZadaca.opis} rows={3}
                    onChange={e => setNewZadaca(z => ({ ...z, opis: e.target.value }))}
                    placeholder={t("Detalji zadaće (opciono)")}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-1">{t("Rok do")}</label>
                    <input type="date" value={newZadaca.rokDo}
                      onChange={e => setNewZadaca(z => ({ ...z, rokDo: e.target.value }))}
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-1">{t("Lekcija")}</label>
                    <LekcijaPicker
                      lekcije={ilmihalLekcije}
                      value={newZadaca.lekcijaNaslov}
                      onChange={v => setNewZadaca(z => ({ ...z, lekcijaNaslov: v }))}
                      placeholder={t("Pretraži lekciju ili upiši broj…")}
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <Button variant="outline" onClick={() => setShowZadacaModal(false)} disabled={savingZadaca} className="flex-1 rounded-xl">
                  {t("Otkaži")}
                </Button>
                <Button onClick={saveZadaca} disabled={savingZadaca || !newZadaca.naslov.trim()} className="flex-1 rounded-xl font-bold"
                  data-testid="btn-save-zadaca"
                >
                  {savingZadaca ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Dodaj zadaću")}
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
                  <KeyRound className="w-5 h-5 text-blue-600" /> {t("Šifra roditelja")}
                </h3>
                <button onClick={() => setParentResetTarget(null)} className="p-1 hover:bg-muted rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{t("Vrati šifru roditelja učenika {ime} na standardnu.", { ime: parentResetTarget.displayName })}</p>

              {parentResetLoading ? (
                <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : parentResetList.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                  {t("Ovaj učenik nema povezanog roditelja. Roditelja možeš dodati iz profila učenika (klikni strelicu desno).")}
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
                          {t("Resetuj šifru")}
                        </Button>
                      </div>
                      {parentResetResult?.id === r.id && (
                        <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg p-2 flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold text-emerald-700">{t("Standardna šifra:")}</span>
                          <code className="bg-white border border-emerald-300 rounded px-2 py-1 text-xs font-mono font-bold text-emerald-800">{parentResetResult.password}</code>
                          <Button size="sm" variant="outline"
                            onClick={async () => { try { await navigator.clipboard.writeText(parentResetResult.password); toast({ title: t("Kopirano!") }); } catch {} }}
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
                <h3 className="font-extrabold text-foreground">{t("Obriši učenika trajno?")}</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                <strong className="text-foreground">{deleteTarget.displayName}</strong>{" "}{t("i svi njegovi podaci (ocjene, prisustvo, napredak, zadaće, povezivanja s roditeljima) bit će")}{" "}<strong className="text-red-600">{t("trajno obrisani")}</strong>{t(". Ova akcija se ne može poništiti.")}
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 mb-4">
                {t(`Ako želiš samo da ga ukloniš iz grupe (zadržavajući podatke), iskoristi dugme "Prebaci u drugu grupu" i odaberi "Bez grupe".`)}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteLoading} className="flex-1 rounded-xl">
                  {t("Otkaži")}
                </Button>
                <Button onClick={handleHardDelete} disabled={deleteLoading}
                  className="flex-1 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white"
                  data-testid="btn-confirm-delete"
                >
                  {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Obriši trajno")}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* Modal: promjena muallima grupe (samo za glavnog) */}
      {showChangeMuallim && isGlavni && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => { if (!changingMuallim) setShowChangeMuallim(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-emerald-700" />
              </div>
              <h3 className="font-extrabold text-foreground">{t("Promijeni muallima grupe")}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {t("Odaberi muallima koji će biti odgovoran za grupu")} <span className="font-bold text-foreground">„{grupa?.naziv}"</span>.
            </p>
            <div className="space-y-2 mb-5">
              {mektebMuallimi.map(m => (
                <label key={m.userId}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${changeMuallimId === m.userId ? "border-emerald-400 bg-emerald-50" : "border-border hover:border-emerald-200 hover:bg-emerald-50/40"}`}>
                  <input type="radio" className="sr-only" checked={changeMuallimId === m.userId}
                    onChange={() => setChangeMuallimId(m.userId)} />
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${changeMuallimId === m.userId ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground"}`}>
                    {changeMuallimId === m.userId && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-sm text-foreground">{m.displayName}</span>
                    {m.isGlavni && <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-extrabold">{t("GLAVNI")}</span>}
                  </div>
                  {changeMuallimId === m.userId && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowChangeMuallim(false)} disabled={changingMuallim} className="flex-1 rounded-xl">
                {t("Otkaži")}
              </Button>
              <Button onClick={confirmChangeMuallim}
                disabled={changingMuallim || changeMuallimId === null || changeMuallimId === grupa?.muallimId}
                className="flex-1 rounded-xl font-bold">
                {changingMuallim ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Potvrdi")}
              </Button>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
}
