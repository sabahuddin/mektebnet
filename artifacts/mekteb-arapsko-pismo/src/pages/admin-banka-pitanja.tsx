import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/language";
import {
  ArrowLeft, Plus, Search, Pencil, Trash2, Loader2, X, Save,
  Database, AlertTriangle, ChevronLeft, ChevronRight, Filter, BookOpenCheck,
  Settings, Tag, CheckCircle2, RotateCcw,
} from "lucide-react";

// Banka pitanja — centralni admin UI za sva kviz pitanja.
// Backend rute u admin.ts:
//   GET    /admin/banka-pitanja?search=&kategorija=&tag=&page=&pageSize=
//   GET    /admin/banka-pitanja/:id
//   GET    /admin/banka-pitanja/:id/usage
//   POST   /admin/banka-pitanja
//   PUT    /admin/banka-pitanja/:id
//   DELETE /admin/banka-pitanja/:id  (CASCADE briše iz svih kvizova)
//
// Kategorije: 5 glavnih (NPP 2018) — akaid, ibadet, ahlak, historija, bosna
// Tagovi: pod-teme za admin filtriranje (npr. namaz, abdest, zekat…)

interface PitanjeMeta {
  template?: string[];
  words?: string[];
  correct?: string[];
  text?: string;
  incorrect?: string[];
  didaktickiTip?: DidaktickiTip;
  retryMode?: "immediate";
  retryPrompt?: string;
  sourceQuestion?: string;
  pilotKey?: string;
}

interface PitanjeBanka {
  id: number;
  pitanje: string;
  opcije: string[];
  correctIndex: number;
  correctIndexes: number[] | null;
  correctOrder: number[] | null;
  meta: PitanjeMeta | null;
  objasnjenje: string;
  slika: string | null;
  vrsta: string;
  kategorija: string | null;
  tagovi: string[];
  lekcijaId: number | null;
  urednickiStatus: UrednickiStatus;
  reviewedBy: number | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  tezina: number;
  createdAt: string;
  updatedAt: string;
}

const VRSTA_LABELS: Record<string, string> = {
  single: "Jedan tačan odgovor",
  multiple: "Više tačnih odgovora",
  truefalse: "Da / Ne",
  reorder: "Poredaj redom",
  dragDrop: "Dopuni (drag & drop)",
  markWords: "Pronađi grešku",
};

type Vrsta = "single" | "multiple" | "truefalse" | "reorder" | "dragDrop" | "markWords";
const ALL_VRSTE: Vrsta[] = ["single", "multiple", "truefalse", "reorder", "dragDrop", "markWords"];
type DidaktickiTip = "prisjecanje" | "razlikovanje" | "primjena" | "redoslijed";
type UrednickiStatus = "na_cekanju" | "odobreno" | "vraceno_na_doradu";

const DIDAKTICKI_TIP_LABELS: Record<DidaktickiTip, string> = {
  prisjecanje: "Prisjećanje",
  razlikovanje: "Razlikovanje",
  primjena: "Primjena",
  redoslijed: "Redoslijed",
};

const UREDNICKI_STATUS_META: Record<UrednickiStatus, { label: string; classes: string }> = {
  na_cekanju: { label: "Čeka urednički pregled", classes: "bg-amber-100 text-amber-800" },
  odobreno: { label: "Urednički odobreno", classes: "bg-emerald-100 text-emerald-800" },
  vraceno_na_doradu: { label: "Vraćeno na doradu", classes: "bg-red-100 text-red-700" },
};

interface PitanjeListResp {
  total: number;
  page: number;
  pageSize: number;
  rows: PitanjeBanka[];
}

interface IlmihalLekcija {
  id: number;
  nivo: number;
  slug: string;
  naslov: string;
}

interface UsageInfo {
  count: number;
  kvizovi: { kvizId: number; slug: string; naslov: string; modul: string }[];
}

const PAGE_SIZE = 50;

// 5 glavnih kategorija po NPP 2018 + tagovi
const KATEGORIJE_LABELS: Record<string, string> = {
  akaid: "Akaid (vjerovanje)", ibadet: "Ibadet (namaz, abdest…)",
  ahlak: "Ahlak i moral", historija: "Historija",
  bosna: "Bosna (džamije, običaji, džemat)",
};
const TAG_LABELS: Record<string, string> = {
  allah: "Allah", meleki: "Meleki", knjige: "Knjige", poslanici: "Poslanici", ahiret: "Ahiret", kuran: "Kuran", sure: "Sure",
  namaz: "Namaz", abdest: "Abdest", post: "Post", zekat: "Zekat", hadz: "Hadž", dove: "Dove", zikrovi: "Zikrovi", halal_haram: "Halal/Haram",
  ponasanje: "Ponašanje", obici: "Običaji", ljubaznost: "Ljubaznost", postenje: "Poštenje", srdacnost: "Srdacnost", pomaganje: "Pomaganje",
  zivot_poslanika: "Život poslanika", ashabi: "Ashabi", islamska_civilizacija: "Isl. civilizacija", osvajanja: "Osvajanja", kalifi: "Kalifi",
  nas_ucenjaci: "Naši učenjaci", dzamije: "Džamije", tradicije: "Tradicije", ilahije: "Ilahije", dijaspora: "Dijaspora",
};

interface KvizKategorijaApi {
  id: number;
  slug: string;
  naziv: string;
  ikona: string | null;
  redoslijed: number;
  brojPitanja?: number;
}

function emptyForm() {
  return {
    pitanje: "",
    opcije: ["", "", "", ""],
    correctIndex: 0,
    correctIndexes: [] as number[],
    correctOrder: [] as number[],
    // dragDrop
    template: [] as string[],     // npr. ["Tekst", "DROP", "još teksta", "DROP"]
    words: [] as string[],        // pool riječi
    correct: [] as string[],      // tačan slijed za DROP slotove
    // markWords
    text: "",                     // pun tekst (auto-split u words)
    incorrect: [] as string[],    // riječi koje treba kliknuti
    didaktickiTip: "" as "" | DidaktickiTip,
    retryMode: "" as "" | "immediate",
    retryPrompt: "",
    sourceQuestion: "",
    pilotKey: "",
    objasnjenje: "",
    slika: "",
    vrsta: "single" as Vrsta,
    kategorija: "",
    tagovi: [] as string[],
    lekcijaId: "" as string | number,
    tezina: 1,
  };
}

export default function AdminBankaPitanjaPage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [rows, setRows] = useState<PitanjeBanka[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterKategorija, setFilterKategorija] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [filterUrednickiStatus, setFilterUrednickiStatus] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [lekcije, setLekcije] = useState<IlmihalLekcija[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<{ pitanje: PitanjeBanka; usage: UsageInfo | null } | null>(null);
  // Pitanje otvoreno preko ?edit=N — drži ga zakucanim na vrhu liste čak i kad
  // loadList overwrite-uje `rows` (paginacija/filter/initial fetch). Bez ovoga
  // inline editor (renderuje se SAMO iz rows.map()) bi nestao kad loadList
  // završi poslije ?edit fetch-a.
  const [pinnedEditRow, setPinnedEditRow] = useState<PitanjeBanka | null>(null);

  // Dinamičke kategorije iz baze (admin može dodavati/brisati).
  const [kategorije, setKategorije] = useState<KvizKategorijaApi[]>([]);
  const [showKatManager, setShowKatManager] = useState(false);

  const loadKategorije = async () => {
    if (!token) return;
    try {
      const data = await apiRequest<KvizKategorijaApi[]>("GET", "/admin/kviz-kategorije", undefined, token);
      setKategorije(data);
    } catch {
      // tihi fallback — koristi se prazna lista
    }
  };

  useEffect(() => { void loadKategorije(); }, [token]);

  // Kategorije i tagovi iz novog hijerarhijskog endpointa (NPP 2018)
  const [kategorijeHier, setKategorijeHier] = useState<{slug:string; naziv:string; ikona:string}[]>([]);
  const [tagoviHier, setTagoviHier] = useState<{slug:string; naziv:string; kategorija:string}[]>([]);

  const loadKategorijeHier = async () => {
    if (!token) return;
    try {
      const data = await apiRequest<{kategorije:{slug:string; naziv:string; ikona:string}[]; tagovi:{slug:string; naziv:string; kategorija:string}[]}>("GET", "/admin/banka-pitanja/kategorije", undefined, token);
      setKategorijeHier(data.kategorije);
      setTagoviHier(data.tagovi);
    } catch {
      // tihi fallback
    }
  };
  useEffect(() => { void loadKategorijeHier(); }, [token]);

  // DB je izvor istine: katalog kategorija/tagova dolazi iz hijerarhijskog
  // endpointa. Konstante (KATEGORIJE_LABELS / TAG_LABELS) ostaju samo kao
  // cosmetic fallback labela za legacy slug koji više nije u katalogu.
  const kategorijeLabels = useMemo<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    kategorijeHier.forEach(k => { m[k.slug] = k.ikona ? `${k.ikona} ${k.naziv}` : k.naziv; });
    return m;
  }, [kategorijeHier]);

  const kategorijaTagovi = useMemo<Record<string, string[]>>(() => {
    const m: Record<string, string[]> = {};
    tagoviHier.forEach(t => { (m[t.kategorija] ||= []).push(t.slug); });
    return m;
  }, [tagoviHier]);

  const tagLabels = useMemo<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    tagoviHier.forEach(t => { m[t.slug] = t.naziv; });
    return m;
  }, [tagoviHier]);

  // Labela za badževe — DB katalog, pa fallback na konstantu, pa sirovi slug.
  const katLabel = (slug: string) => kategorijeLabels[slug] || KATEGORIJE_LABELS[slug] || slug;
  const tagLabel = (slug: string) => tagLabels[slug] || TAG_LABELS[slug] || slug;

  useEffect(() => {
    // Sačekaj da auth context završi hidraciju iz localStorage. Bez ovoga
    // direktan ulazak (npr. /admin/banka-pitanja?edit=N u novom tabu) bi
    // redirektovao na "/" prije nego što se user učita, pa bi query izgubili.
    if (authLoading) return;
    if (!user || user.role !== "admin") { setLocation("/"); return; }
  }, [authLoading, user, setLocation]);

  // Debounce search 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!token) return;
    void loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, debouncedSearch, filterKategorija, filterTag, filterUrednickiStatus]);

  useEffect(() => {
    if (!token) return;
    apiRequest<IlmihalLekcija[]>("GET", "/content/ilmihal", undefined, token)
      .then(setLekcije)
      .catch(() => {});
  }, [token]);

  // Deep-link: ?edit=<id> → auto-otvori edit formu za to pitanje.
  // Koristi se iz /admin/kviz/:id "Uredi u banci" prečice. Pitanje se fetch-uje
  // pojedinačno (možda nije na trenutnoj stranici liste). URL se čisti odmah
  // (prije fetcha) da reload ne pokrene ponovni auto-open ni na grešci.
  // useRef guard je StrictMode-safe (state se resetuje na remount, ref ne).
  const editParamHandledRef = useRef(false);
  useEffect(() => {
    if (!token || editParamHandledRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const editIdStr = params.get("edit");
    if (!editIdStr) { editParamHandledRef.current = true; return; }
    // Striktna validacija: samo cijeli pozitivni broj (odbij "12abc", "1.5", "-1").
    if (!/^\d+$/.test(editIdStr)) {
      editParamHandledRef.current = true;
      window.history.replaceState({}, "", `${import.meta.env.BASE_URL}admin/banka-pitanja`);
      return;
    }
    const editIdNum = parseInt(editIdStr, 10);
    editParamHandledRef.current = true;
    window.history.replaceState({}, "", `${import.meta.env.BASE_URL}admin/banka-pitanja`);
    apiRequest<PitanjeBanka>("GET", `/admin/banka-pitanja/${editIdNum}`, undefined, token)
      .then((p) => {
        // Zakucaj pitanje na vrh liste (preživi sve buduće loadList pozive,
        // za razliku od prepend-a u rows koji bi loadList overwrite-ovao).
        setPinnedEditRow(p);
        startEdit(p);
      })
      .catch(() => {
        toast({ title: t("Greška"), description: t("Pitanje #{id} nije pronađeno", { id: String(editIdNum) }), variant: "destructive" });
      });
  }, [token]);

  const loadList = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(filterKategorija ? { kategorija: filterKategorija } : {}),
        ...(filterTag ? { tag: filterTag } : {}),
        ...(filterUrednickiStatus ? { urednickiStatus: filterUrednickiStatus } : {}),
      }).toString();
      const data = await apiRequest<PitanjeListResp>("GET", `/admin/banka-pitanja?${qs}`, undefined, token);
      setRows(data.rows);
      setTotal(data.total);
    } catch {
      toast({ title: t("Greška"), description: t("Nije moguće učitati banku pitanja"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const startNew = () => {
    setPinnedEditRow(null);
    setEditId(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const startEdit = (p: PitanjeBanka) => {
    setEditId(p.id);
    // Skrol na red koji se uređuje (mobilno ne vidi formu inače).
    setTimeout(() => {
      const el = document.querySelector(`[data-testid="inline-editor-${p.id}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 80);
    const vrsta = (ALL_VRSTE.includes(p.vrsta as Vrsta) ? p.vrsta : "single") as Vrsta;
    const isInteractive = vrsta === "dragDrop" || vrsta === "markWords";
    const opcije = vrsta === "truefalse"
      ? ["Da", "Ne"]
      : isInteractive
        ? []
        : (p.opcije.length >= 2 ? [...p.opcije] : [...p.opcije, "", ""].slice(0, Math.max(4, p.opcije.length)));
    const correctOrder = vrsta === "reorder" && Array.isArray(p.correctOrder) && p.correctOrder.length === opcije.length
      ? [...p.correctOrder]
      : opcije.map((_, i) => i + 1);
    const correctIndexes = vrsta === "multiple" && Array.isArray(p.correctIndexes) && p.correctIndexes.length > 0
      ? [...p.correctIndexes]
      : [];
    const m = (p.meta || {}) as PitanjeMeta;
    setForm({
      pitanje: p.pitanje,
      opcije,
      correctIndex: p.correctIndex,
      correctIndexes,
      correctOrder,
      template: Array.isArray(m.template) ? [...m.template] : [],
      words: Array.isArray(m.words) ? [...m.words] : [],
      correct: Array.isArray(m.correct) ? [...m.correct] : [],
      text: typeof m.text === "string" ? m.text : "",
      incorrect: Array.isArray(m.incorrect) ? [...m.incorrect] : [],
      didaktickiTip: m.didaktickiTip || "",
      retryMode: m.retryMode || "",
      retryPrompt: m.retryPrompt || "",
      sourceQuestion: m.sourceQuestion || "",
      pilotKey: m.pilotKey || "",
      objasnjenje: p.objasnjenje,
      slika: p.slika || "",
      vrsta,
      kategorija: p.kategorija || "",
      tagovi: p.tagovi || [],
      lekcijaId: p.lekcijaId || "",
      tezina: p.tezina,
    });
    setShowForm(true);
  };

  const cancelForm = () => { setShowForm(false); setEditId(null); setPinnedEditRow(null); };

  const handleOpcijaChange = (i: number, val: string) => {
    setForm(prev => {
      const next = [...prev.opcije];
      next[i] = val;
      return { ...prev, opcije: next };
    });
  };

  const addOpcija = () => setForm(prev => ({ ...prev, opcije: [...prev.opcije, ""] }));
  const removeOpcija = (i: number) => setForm(prev => {
    const next = prev.opcije.filter((_, j) => j !== i);
    let ci = prev.correctIndex;
    if (i === ci) ci = 0;
    else if (i < ci) ci = ci - 1;
    return { ...prev, opcije: next, correctIndex: Math.max(0, Math.min(next.length - 1, ci)) };
  });

  const handleSave = async () => {
    if (!token) return;
    if (!form.pitanje.trim()) {
      toast({ title: t("Greška"), description: t("Tekst pitanja je obavezan"), variant: "destructive" });
      return;
    }

    let opcijeOut: string[];
    let correctIndexOut = 0;
    let correctIndexesOut: number[] | null = null;
    let correctOrderOut: number[] | null = null;
    let metaOut: PitanjeMeta | null = null;

    if (form.vrsta === "dragDrop") {
      const dropCount = form.template.filter(t => t === "DROP").length;
      if (form.template.length === 0) { toast({ title: t("Greška"), description: t("Šablon je prazan"), variant: "destructive" }); return; }
      if (dropCount === 0) { toast({ title: t("Greška"), description: t("Šablon mora imati barem jednu prazninu"), variant: "destructive" }); return; }
      const cleanWords = form.words.map(w => w.trim()).filter(w => w);
      const cleanCorrect = form.correct.map(w => w.trim());
      if (cleanWords.length < dropCount) { toast({ title: t("Greška"), description: t("Trebaš minimum {n} riječi u poolu", { n: String(dropCount) }), variant: "destructive" }); return; }
      if (cleanCorrect.length !== dropCount || cleanCorrect.some(c => !c)) {
        toast({ title: t("Greška"), description: t("Označi tačnu riječ za svaku od {n} praznina", { n: String(dropCount) }), variant: "destructive" }); return;
      }
      if (cleanCorrect.some(c => !cleanWords.includes(c))) {
        toast({ title: t("Greška"), description: t("Sve tačne riječi moraju biti u poolu"), variant: "destructive" }); return;
      }
      opcijeOut = [];
      metaOut = { template: form.template, words: cleanWords, correct: cleanCorrect };
    } else if (form.vrsta === "markWords") {
      const cleanWords = form.words.map(w => w.trim()).filter(w => w);
      const cleanIncorrect = form.incorrect.filter(w => cleanWords.includes(w));
      if (cleanWords.length < 2) { toast({ title: t("Greška"), description: t("Tekst mora imati minimum 2 riječi"), variant: "destructive" }); return; }
      if (cleanIncorrect.length === 0) { toast({ title: t("Greška"), description: t("Označi minimum 1 pogrešnu riječ"), variant: "destructive" }); return; }
      opcijeOut = [];
      metaOut = { text: form.text || cleanWords.join(" "), words: cleanWords, incorrect: cleanIncorrect };
    } else if (form.vrsta === "truefalse") {
      opcijeOut = ["Da", "Ne"];
      correctIndexOut = form.correctIndex === 1 ? 1 : 0;
    } else if (form.vrsta === "reorder") {
      opcijeOut = form.opcije.map(o => o.trim());
      if (opcijeOut.length < 2 || opcijeOut.some(o => !o)) {
        toast({ title: t("Greška"), description: t("Minimum 2 stavke, sve moraju imati tekst"), variant: "destructive" });
        return;
      }
      correctOrderOut = form.correctOrder.length === opcijeOut.length
        ? [...form.correctOrder]
        : opcijeOut.map((_, i) => i + 1);
      const sorted = [...correctOrderOut].sort((a, b) => a - b);
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i] !== i + 1) {
          toast({ title: t("Greška"), description: t("Redoslijed mora biti 1..{n} bez ponavljanja", { n: String(sorted.length) }), variant: "destructive" });
          return;
        }
      }
    } else if (form.vrsta === "multiple") {
      // VAŽNO: ne smijemo filterati prazne opcije jer bi to pomjerilo indekse
      // u correctIndexes — moramo validirati da nema praznih, pa onda mapirati 1:1.
      opcijeOut = form.opcije.map(o => o.trim());
      if (opcijeOut.length < 2 || opcijeOut.some(o => !o)) {
        toast({ title: t("Greška"), description: t("Minimum 2 opcije, sve moraju imati tekst"), variant: "destructive" });
        return;
      }
      correctIndexesOut = form.correctIndexes.filter(i => i >= 0 && i < opcijeOut.length).sort((a, b) => a - b);
      if (correctIndexesOut.length < 2) {
        toast({ title: t("Greška"), description: t("Označi minimum 2 tačne opcije za tip 'Više tačnih'"), variant: "destructive" });
        return;
      }
      correctIndexOut = correctIndexesOut[0]!;
    } else {
      // single — ne filteriramo prazne (pomjerilo bi correctIndex)
      opcijeOut = form.opcije.map(o => o.trim());
      if (opcijeOut.length < 2 || opcijeOut.some(o => !o)) {
        toast({ title: t("Greška"), description: t("Minimum 2 opcije, sve moraju imati tekst"), variant: "destructive" });
        return;
      }
      if (form.correctIndex < 0 || form.correctIndex >= opcijeOut.length) {
        toast({ title: t("Greška"), description: t("Označi tačan odgovor"), variant: "destructive" });
        return;
      }
      correctIndexOut = form.correctIndex;
    }

    const pedagogicalMeta: PitanjeMeta = {
      ...(form.didaktickiTip ? { didaktickiTip: form.didaktickiTip } : {}),
      ...(form.retryMode ? { retryMode: form.retryMode } : {}),
      ...(form.retryPrompt.trim() ? { retryPrompt: form.retryPrompt.trim() } : {}),
      ...(form.sourceQuestion.trim() ? { sourceQuestion: form.sourceQuestion.trim() } : {}),
      ...(form.pilotKey ? { pilotKey: form.pilotKey } : {}),
    };
    if (Object.keys(pedagogicalMeta).length > 0) {
      metaOut = { ...(metaOut ?? {}), ...pedagogicalMeta };
    }

    setSaving(true);
    try {
      const body = {
        pitanje: form.pitanje.trim(),
        opcije: opcijeOut,
        correctIndex: correctIndexOut,
        correctIndexes: correctIndexesOut,
        correctOrder: correctOrderOut,
        meta: metaOut,
        objasnjenje: form.objasnjenje.trim(),
        slika: form.slika.trim() || null,
        vrsta: form.vrsta,
        kategorija: form.kategorija || null,
        tagovi: form.tagovi || [],
        lekcijaId: form.lekcijaId ? Number(form.lekcijaId) : null,
        tezina: form.tezina,
      };
      if (editId) {
        await apiRequest("PUT", `/admin/banka-pitanja/${editId}`, body, token);
        toast({ title: t("Sačuvano"), description: t("Pitanje ažurirano u banci") });
      } else {
        await apiRequest("POST", "/admin/banka-pitanja", body, token);
        toast({ title: t("Dodano"), description: t("Novo pitanje u banci") });
      }
      setShowForm(false);
      setEditId(null);
      setPinnedEditRow(null);
      void loadList();
    } catch (err: any) {
      toast({ title: t("Greška"), description: err?.message || t("Nije moguće sačuvati"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const askDelete = async (p: PitanjeBanka) => {
    if (!token) return;
    try {
      const usage = await apiRequest<UsageInfo>("GET", `/admin/banka-pitanja/${p.id}/usage`, undefined, token);
      setConfirmDelete({ pitanje: p, usage });
    } catch {
      setConfirmDelete({ pitanje: p, usage: null });
    }
  };

  const confirmDeleteNow = async () => {
    if (!confirmDelete || !token) return;
    try {
      await apiRequest("DELETE", `/admin/banka-pitanja/${confirmDelete.pitanje.id}`, undefined, token);
      toast({ title: t("Obrisano"), description: t("Pitanje uklonjeno iz banke i svih kvizova") });
      setConfirmDelete(null);
      void loadList();
    } catch {
      toast({ title: t("Greška"), description: t("Nije moguće obrisati"), variant: "destructive" });
    }
  };

  const reviewQuestion = async (pitanje: PitanjeBanka, status: Exclude<UrednickiStatus, "na_cekanju">) => {
    if (!token) return;
    try {
      await apiRequest(
        "POST",
        `/admin/banka-pitanja/${pitanje.id}/urednicki-pregled`,
        { status },
        token,
      );
      toast({
        title: status === "odobreno" ? t("Pitanje je odobreno") : t("Pitanje je vraćeno na doradu"),
        description: status === "odobreno"
          ? t("Može biti objavljeno kada sva pitanja u kvizu budu odobrena.")
          : t("Nakon dorade pitanje će ponovo čekati pregled."),
      });
      void loadList();
    } catch (err: any) {
      toast({ title: t("Pregled nije sačuvan"), description: err?.message || t("Pokušaj ponovo"), variant: "destructive" });
    }
  };

  const lekcijeMap = useMemo(() => {
    const m = new Map<number, IlmihalLekcija>();
    lekcije.forEach(l => m.set(l.id, l));
    return m;
  }, [lekcije]);

  if (!user || user.role !== "admin") return null;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <button onClick={() => { if (window.history.length > 1) window.history.back(); else setLocation("/admin"); }} className="flex items-center gap-2 text-teal-600 hover:text-teal-800 mb-6 font-semibold">
          <ArrowLeft className="w-4 h-4" /> {t("Nazad na admin")}
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center">
            <Database className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">{t("Banka pitanja")}</h1>
            <p className="text-muted-foreground text-base">{t("{total} pitanja u banci · isto pitanje može biti u više kvizova", { total: String(total) })}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder={t("Pretraži po tekstu pitanja...")}
              className="w-full pl-10 pr-4 py-2.5 border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <select
              value={filterKategorija}
              onChange={e => { setFilterKategorija(e.target.value); setFilterTag(""); setPage(1); }}
              className="pl-10 pr-4 py-2.5 border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white min-w-[180px]"
            >
              <option value="">{t("Sve kategorije")}</option>
              {Object.entries(kategorijeLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <BookOpenCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <select
              value={filterUrednickiStatus}
              onChange={e => { setFilterUrednickiStatus(e.target.value); setPage(1); }}
              className="pl-10 pr-4 py-2.5 border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white min-w-[210px]"
            >
              <option value="">{t("Svi urednički statusi")}</option>
              {Object.entries(UREDNICKI_STATUS_META).map(([value, meta]) => (
                <option key={value} value={value}>{t(meta.label)}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <select
              value={filterTag}
              onChange={e => { setFilterTag(e.target.value); setPage(1); }}
              className="pl-10 pr-4 py-2.5 border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white min-w-[180px]"
            >
              <option value="">{t("Svi tagovi")}</option>
              {filterKategorija && kategorijaTagovi[filterKategorija]?.map(tg => (
                <option key={tg} value={tg}>{tagLabels[tg] || tg}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowKatManager(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-amber-300 text-amber-700 rounded-xl font-semibold hover:bg-amber-50 transition shrink-0"
            title={t("Dodaj/obriši kategorije pitanja")}
            data-testid="btn-upravljaj-kategorijama"
          >
            <Settings className="w-4 h-4" /> {t("Kategorije")}
          </button>
          <button
            onClick={startNew}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition shrink-0"
          >
            <Plus className="w-4 h-4" /> {t("Novo pitanje")}
          </button>
        </div>

        {/* Forma za NOVO pitanje stoji na vrhu (nema reda u koji bi se ubacila).
            Forma za EDIT se renderira INLINE unutar reda (vidi map ispod). */}
        {showForm && editId === null && (
          <PitanjeForm
            form={form}
            setForm={setForm}
            lekcije={lekcije}
            kategorijeLabels={kategorijeLabels}
            kategorijaTagovi={kategorijaTagovi}
            tagLabels={tagLabels}
            editId={null}
            saving={saving}
            onSave={handleSave}
            onCancel={cancelForm}
            onOpcijaChange={handleOpcijaChange}
            onAddOpcija={addOpcija}
            onRemoveOpcija={removeOpcija}
          />
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Database className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-lg font-semibold">{t("Nema pitanja")}</p>
            <p className="text-base mt-1">{t("Promijeni filter ili dodaj novo")}</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {(pinnedEditRow && !rows.some(r => r.id === pinnedEditRow.id) ? [pinnedEditRow, ...rows] : rows).map(p => {
                const lek = p.lekcijaId ? lekcijeMap.get(p.lekcijaId) : null;
                const isEditingThis = showForm && editId === p.id;
                return (
                  <div key={p.id} className="bg-white border border-border/50 rounded-xl px-4 py-3 hover:border-amber-200 transition group">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {p.kategorija && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                              {katLabel(p.kategorija)}
                            </span>
                          )}
                          {p.tagovi && p.tagovi.map(tg => (
                            <span key={tg} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {tagLabel(tg)}
                            </span>
                          ))}
                          {lek && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 flex items-center gap-1">
                              <BookOpenCheck className="w-3 h-3" /> {lek.naslov}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">#{p.id}</span>
                          {p.meta?.didaktickiTip && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                              {t(DIDAKTICKI_TIP_LABELS[p.meta.didaktickiTip])}
                            </span>
                          )}
                          {p.meta?.pilotKey && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${UREDNICKI_STATUS_META[p.urednickiStatus]?.classes || "bg-slate-100 text-slate-700"}`}>
                              {t(UREDNICKI_STATUS_META[p.urednickiStatus]?.label || p.urednickiStatus)}
                            </span>
                          )}
                        </div>
                        <p className="text-base font-semibold text-foreground leading-snug">{p.pitanje}</p>
                        {p.meta?.sourceQuestion && (
                          <p className="mt-1 text-sm text-blue-800">
                            <span className="font-bold">{t("Izvorno pitanje")}:</span> {p.meta.sourceQuestion}
                          </p>
                        )}
                        <div className="text-sm text-muted-foreground mt-1">
                          <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold mr-2">
                            {VRSTA_LABELS[p.vrsta] || p.vrsta}
                          </span>
                          {p.vrsta === "dragDrop" && p.meta?.template ? (
                            <span>
                              {p.meta.template.map((t, i) => t === "DROP"
                                ? <span key={i} className="inline-block px-2 mx-0.5 bg-amber-100 rounded text-amber-700 font-semibold">{p.meta!.correct?.[p.meta!.template!.slice(0, i).filter(x => x === "DROP").length] || "___"}</span>
                                : <span key={i}>{t} </span>
                              )}
                            </span>
                          ) : p.vrsta === "markWords" && p.meta?.words ? (
                            <span>
                              {p.meta.words.map((w, i) => (
                                <span key={i} className={p.meta!.incorrect?.includes(w) ? "text-red-600 line-through font-semibold mr-1" : "mr-1"}>{w}</span>
                              ))}
                            </span>
                          ) : p.vrsta === "reorder" ? (
                            (() => {
                              const co = Array.isArray(p.correctOrder) && p.correctOrder.length === p.opcije.length
                                ? p.correctOrder
                                : p.opcije.map((_, i) => i + 1);
                              const ordered = p.opcije
                                .map((o, i) => ({ o, pos: co[i] ?? (i + 1) }))
                                .sort((a, b) => a.pos - b.pos);
                              return ordered.map((it, i) => (
                                <span key={i}>
                                  {it.o}{i < ordered.length - 1 ? " → " : ""}
                                </span>
                              ));
                            })()
                          ) : (
                            p.opcije.map((o, i) => (
                              <span key={i} className={i === p.correctIndex ? "text-emerald-700 font-semibold" : ""}>
                                {o}{i < p.opcije.length - 1 ? " · " : ""}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                      <div className={`flex items-center gap-1 shrink-0 ${isEditingThis ? "" : "sm:opacity-0 sm:group-hover:opacity-100"} transition-opacity`}>
                        {p.meta?.pilotKey && p.urednickiStatus !== "odobreno" && (
                          <button
                            onClick={() => void reviewQuestion(p, "odobreno")}
                            className="p-2 rounded-lg hover:bg-emerald-50 text-muted-foreground hover:text-emerald-600 transition"
                            title={t("Stručno pregledano — odobri")}
                            data-testid={`approve-question-${p.id}`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        {p.meta?.pilotKey && p.urednickiStatus !== "vraceno_na_doradu" && (
                          <button
                            onClick={() => void reviewQuestion(p, "vraceno_na_doradu")}
                            className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition"
                            title={t("Vrati na doradu")}
                            data-testid={`reject-question-${p.id}`}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => isEditingThis ? cancelForm() : startEdit(p)}
                          className={`p-2 rounded-lg transition ${isEditingThis ? "bg-amber-100 text-amber-700" : "hover:bg-amber-50 text-muted-foreground hover:text-amber-600"}`}
                          title={isEditingThis ? t("Zatvori urednik") : t("Uredi")}
                        >
                          {isEditingThis ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => askDelete(p)}
                          className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 transition"
                          title={t("Obriši")}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {/* Inline editor — otvara se TU GDJE SI KLIKNUO, ne na vrhu strane,
                        tako da nema nepotrebnog scrolanja gore-dolje. */}
                    {isEditingThis && (
                      <div className="mt-3 border-t border-amber-200 pt-3" data-testid={`inline-editor-${p.id}`}>
                        <PitanjeForm
                          form={form}
                          setForm={setForm}
                          lekcije={lekcije}
                          kategorijeLabels={kategorijeLabels}
                          kategorijaTagovi={kategorijaTagovi}
                          tagLabels={tagLabels}
                          editId={editId}
                          saving={saving}
                          onSave={handleSave}
                          onCancel={cancelForm}
                          onOpcijaChange={handleOpcijaChange}
                          onAddOpcija={addOpcija}
                          onRemoveOpcija={removeOpcija}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40 text-sm font-semibold"
                >
                  <ChevronLeft className="w-4 h-4" /> {t("Prethodna")}
                </button>
                <span className="text-sm text-muted-foreground">{t("Strana {page} od {totalPages} ({total} pitanja)", { page: String(page), totalPages: String(totalPages), total: String(total) })}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40 text-sm font-semibold"
                >
                  {t("Sljedeća")} <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}

        {showKatManager && (
          <KategorijeManagerModal
            kategorije={kategorije}
            token={token!}
            onClose={() => setShowKatManager(false)}
            onChanged={() => { void loadKategorije(); void loadKategorijeHier(); void loadList(); }}
          />
        )}

        {confirmDelete && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="font-extrabold text-lg text-foreground">{t("Obrisati pitanje?")}</h3>
              </div>
              <p className="text-base text-muted-foreground mb-2 line-clamp-3">{confirmDelete.pitanje.pitanje}</p>
              {confirmDelete.usage && confirmDelete.usage.count > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm">
                  <p className="font-semibold text-amber-800 mb-1">{t("⚠️ Pitanje se koristi u {count} {rijec}:", { count: String(confirmDelete.usage.count), rijec: confirmDelete.usage.count === 1 ? t("kvizu") : t("kvizova") })}</p>
                  <ul className="text-amber-700 list-disc list-inside">
                    {confirmDelete.usage.kvizovi.slice(0, 6).map(k => <li key={k.kvizId}>{k.naslov}</li>)}
                    {confirmDelete.usage.kvizovi.length > 6 && <li>{t("… i još {n}", { n: String(confirmDelete.usage.kvizovi.length - 6) })}</li>}
                  </ul>
                  <p className="text-amber-800 mt-2 text-xs">{t("Brisanje će ukloniti pitanje iz svih ovih kvizova. Već postojeći rezultati učenika ostaju netaknuti.")}</p>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-xl border border-border font-semibold hover:bg-muted">{t("Odustani")}</button>
                <button onClick={confirmDeleteNow} className="px-4 py-2 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700">{t("Obriši")}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

// ── KategorijeManagerModal ────────────────────────────────────────────────────
// Admin panel za dodavanje/brisanje kategorija pitanja. Brisanje NE briše
// pitanja — ona ostaju u bazi sa starim slug-om. Promjena slug-a postojeće
// kategorije automatski premjesti pitanja (server-side transakcija).
interface KvizTagApi {
  id: number;
  slug: string;
  naziv: string;
  kategorija: string;
  redoslijed: number;
  brojPitanja?: number;
}

function KategorijeManagerModal({
  kategorije, token, onClose, onChanged,
}: {
  kategorije: KvizKategorijaApi[];
  token: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [novaSlug, setNovaSlug] = useState("");
  const [noviNaziv, setNoviNaziv] = useState("");
  const [novaIkona, setNovaIkona] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState<KvizKategorijaApi | null>(null);
  // Uređivanje kategorije
  const [editingKat, setEditingKat] = useState<KvizKategorijaApi | null>(null);
  const [editKatNaziv, setEditKatNaziv] = useState("");
  const [editKatSlug, setEditKatSlug] = useState("");
  const [editKatIkona, setEditKatIkona] = useState("");

  // Tagovi (pod-teme) — zaseban CRUD; lista se učitava iz /admin/kviz-tagovi.
  const [tagovi, setTagovi] = useState<KvizTagApi[]>([]);
  const [noviTagNaziv, setNoviTagNaziv] = useState("");
  const [noviTagSlug, setNoviTagSlug] = useState("");
  const [noviTagKat, setNoviTagKat] = useState("");
  const [savingTag, setSavingTag] = useState(false);
  const [confirmingTag, setConfirmingTag] = useState<KvizTagApi | null>(null);
  // Uređivanje taga
  const [editingTag, setEditingTag] = useState<KvizTagApi | null>(null);
  const [editTagNaziv, setEditTagNaziv] = useState("");
  const [editTagSlug, setEditTagSlug] = useState("");
  const [editTagKat, setEditTagKat] = useState("");

  const loadTagovi = async () => {
    try {
      const data = await apiRequest<KvizTagApi[]>("GET", "/admin/kviz-tagovi", undefined, token);
      setTagovi(data);
    } catch {
      // tiho
    }
  };
  useEffect(() => { void loadTagovi(); }, [token]);

  const dodaj = async () => {
    if (!noviNaziv.trim()) { toast({ title: t("Greška"), description: t("Naziv je obavezan"), variant: "destructive" }); return; }
    setSaving(true);
    try {
      await apiRequest("POST", "/admin/kviz-kategorije", {
        slug: novaSlug.trim() || noviNaziv.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_"),
        naziv: noviNaziv.trim(),
        ikona: novaIkona.trim() || null,
      }, token);
      toast({ title: t("Dodano"), description: t('Kategorija "{naziv}"', { naziv: noviNaziv.trim() }) });
      setNovaSlug(""); setNoviNaziv(""); setNovaIkona("");
      onChanged();
    } catch (err: any) {
      toast({ title: t("Greška"), description: err?.message || t("Nije moguće dodati"), variant: "destructive" });
    } finally { setSaving(false); }
  };

  const obrisi = async (k: KvizKategorijaApi) => {
    setSaving(true);
    try {
      await apiRequest("DELETE", `/admin/kviz-kategorije/${k.id}`, undefined, token);
      toast({ title: t("Obrisano"), description: t('Kategorija "{naziv}" uklonjena', { naziv: k.naziv }) });
      setConfirming(null);
      onChanged();
    } catch (err: any) {
      toast({ title: t("Greška"), description: err?.message || t("Nije moguće obrisati"), variant: "destructive" });
    } finally { setSaving(false); }
  };

  const uredi = async (k: KvizKategorijaApi) => {
    if (!editKatNaziv.trim()) { toast({ title: t("Greška"), description: t("Naziv je obavezan"), variant: "destructive" }); return; }
    setSaving(true);
    try {
      await apiRequest("PUT", `/admin/kviz-kategorije/${k.id}`, {
        slug: editKatSlug.trim() || undefined,
        naziv: editKatNaziv.trim(),
        ikona: editKatIkona.trim() || null,
      }, token);
      toast({ title: t("Sačuvano"), description: t('Kategorija "{naziv}" ažurirana', { naziv: editKatNaziv.trim() }) });
      setEditingKat(null);
      onChanged();
    } catch (err: any) {
      toast({ title: t("Greška"), description: err?.message || t("Nije moguće sačuvati"), variant: "destructive" });
    } finally { setSaving(false); }
  };

  const startEditKat = (k: KvizKategorijaApi) => {
    setEditingKat(k);
    setEditKatNaziv(k.naziv);
    setEditKatSlug(k.slug);
    setEditKatIkona(k.ikona || "");
  };

  const dodajTag = async () => {
    if (!noviTagNaziv.trim() || !noviTagKat) {
      toast({ title: t("Greška"), description: t("Naziv i glavna kategorija su obavezni"), variant: "destructive" });
      return;
    }
    setSavingTag(true);
    try {
      await apiRequest("POST", "/admin/kviz-tagovi", {
        naziv: noviTagNaziv.trim(),
        slug: noviTagSlug.trim() || undefined,
        kategorija: noviTagKat,
      }, token);
      toast({ title: t("Dodano"), description: t('Tag "{naziv}"', { naziv: noviTagNaziv.trim() }) });
      setNoviTagNaziv(""); setNoviTagSlug(""); setNoviTagKat("");
      await loadTagovi();
      onChanged();
    } catch (err: any) {
      toast({ title: t("Greška"), description: err?.message || t("Nije moguće dodati tag"), variant: "destructive" });
    } finally { setSavingTag(false); }
  };

  const obrisiTag = async (tag: KvizTagApi) => {
    setSavingTag(true);
    try {
      await apiRequest("DELETE", `/admin/kviz-tagovi/${tag.id}`, undefined, token);
      toast({ title: t("Obrisano"), description: t('Tag "{naziv}" uklonjen', { naziv: tag.naziv }) });
      setConfirmingTag(null);
      await loadTagovi();
      onChanged();
    } catch (err: any) {
      toast({ title: t("Greška"), description: err?.message || t("Nije moguće obrisati tag"), variant: "destructive" });
    } finally { setSavingTag(false); }
  };

  const urediTag = async (tag: KvizTagApi) => {
    if (!editTagNaziv.trim()) { toast({ title: t("Greška"), description: t("Naziv je obavezan"), variant: "destructive" }); return; }
    setSavingTag(true);
    try {
      await apiRequest("PUT", `/admin/kviz-tagovi/${tag.id}`, {
        slug: editTagSlug.trim() || undefined,
        naziv: editTagNaziv.trim(),
        kategorija: editTagKat,
      }, token);
      toast({ title: t("Sačuvano"), description: t('Tag "{naziv}" ažuriran', { naziv: editTagNaziv.trim() }) });
      setEditingTag(null);
      await loadTagovi();
      onChanged();
    } catch (err: any) {
      toast({ title: t("Greška"), description: err?.message || t("Nije moguće sačuvati tag"), variant: "destructive" });
    } finally { setSavingTag(false); }
  };

  const startEditTag = (tag: KvizTagApi) => {
    setEditingTag(tag);
    setEditTagNaziv(tag.naziv);
    setEditTagSlug(tag.slug);
    setEditTagKat(tag.kategorija);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Tag className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="font-extrabold text-lg text-foreground">{t("Kategorije i tagovi")}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 mb-4">
          <h4 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> {t("Dodaj novu kategoriju")}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
            <input
              value={noviNaziv}
              onChange={e => setNoviNaziv(e.target.value)}
              placeholder={t("Naziv (npr. Sirat)")}
              className="px-3 py-2 border border-border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
              data-testid="input-nova-kategorija-naziv"
            />
            <input
              value={novaSlug}
              onChange={e => setNovaSlug(e.target.value)}
              placeholder={t("slug (auto)")}
              className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              data-testid="input-nova-kategorija-slug"
            />
            <input
              value={novaIkona}
              onChange={e => setNovaIkona(e.target.value)}
              placeholder={t("ikona (emoji)")}
              maxLength={4}
              className="px-3 py-2 border border-border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
              data-testid="input-nova-kategorija-ikona"
            />
          </div>
          <button
            onClick={dodaj}
            disabled={saving || !noviNaziv.trim()}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 disabled:opacity-50"
            data-testid="btn-dodaj-kategoriju"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Dodaj")}
          </button>
          <p className="text-xs text-muted-foreground mt-2">
            {t("Slug se generiše automatski iz naziva ako ga ne upišeš (samo a-z, 0-9, _).")}
          </p>
        </div>

        <div className="space-y-2">
          {kategorije.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">{t("Nema kategorija. Dodaj prvu iznad.")}</p>
          ) : kategorije.map(k => (
            <div key={k.id} className="px-3 py-2 border border-border rounded-lg">
              {editingKat?.id === k.id ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                  <input
                    value={editKatNaziv}
                    onChange={e => setEditKatNaziv(e.target.value)}
                    placeholder={t("Naziv")}
                    className="px-3 py-2 border border-border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <input
                    value={editKatSlug}
                    onChange={e => setEditKatSlug(e.target.value)}
                    placeholder={t("slug")}
                    className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <input
                    value={editKatIkona}
                    onChange={e => setEditKatIkona(e.target.value)}
                    placeholder={t("ikona (emoji)")}
                    maxLength={4}
                    className="px-3 py-2 border border-border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-xl shrink-0 w-6 text-center">{k.ikona || "•"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground truncate">{k.naziv}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-mono">{k.slug}</span> · {t("{n} pitanja", { n: String(k.brojPitanja || 0) })}
                    </div>
                  </div>
                  <button
                    onClick={() => startEditKat(k)}
                    className="p-2 rounded-lg hover:bg-amber-50 text-muted-foreground hover:text-amber-600 transition"
                    title={t("Uredi kategoriju")}
                    data-testid={`btn-uredi-kategoriju-${k.slug}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setConfirming(k)}
                    className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition"
                    title={t("Obriši kategoriju")}
                    data-testid={`btn-obrisi-kategoriju-${k.slug}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
              {editingKat?.id === k.id && (
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditingKat(null)} className="px-3 py-1.5 rounded-lg border border-border font-semibold text-sm hover:bg-muted">{t("Odustani")}</button>
                  <button onClick={() => uredi(k)} disabled={saving} className="px-3 py-1.5 rounded-lg bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 disabled:opacity-50">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Sačuvaj")}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── TAGOVI (pod-teme) ────────────────────────────────────────── */}
        <div className="mt-6 pt-5 border-t border-border">
          <h4 className="font-extrabold text-base text-foreground mb-3">{t("Tagovi (pod-teme)")}</h4>
          <div className="bg-teal-50/50 border border-teal-200 rounded-xl p-4 mb-4">
            <h4 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> {t("Dodaj novi tag")}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
              <input
                value={noviTagNaziv}
                onChange={e => setNoviTagNaziv(e.target.value)}
                placeholder={t("Naziv (npr. Tedžvid)")}
                className="px-3 py-2 border border-border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-teal-400"
                data-testid="input-novi-tag-naziv"
              />
              <input
                value={noviTagSlug}
                onChange={e => setNoviTagSlug(e.target.value)}
                placeholder={t("slug (auto)")}
                className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                data-testid="input-novi-tag-slug"
              />
              <select
                value={noviTagKat}
                onChange={e => setNoviTagKat(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg text-base bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                data-testid="select-novi-tag-kategorija"
              >
                <option value="">{t("— glavna kategorija —")}</option>
                {kategorije.map(k => <option key={k.id} value={k.slug}>{k.ikona ? `${k.ikona} ${k.naziv}` : k.naziv}</option>)}
              </select>
            </div>
            <button
              onClick={dodajTag}
              disabled={savingTag || !noviTagNaziv.trim() || !noviTagKat}
              className="px-4 py-2 bg-teal-500 text-white rounded-lg font-semibold hover:bg-teal-600 disabled:opacity-50"
              data-testid="btn-dodaj-tag"
            >
              {savingTag ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Dodaj tag")}
            </button>
            <p className="text-xs text-muted-foreground mt-2">
              {t("Tag mora pripadati jednoj glavnoj kategoriji. Slug se generiše automatski (a-z, 0-9, _).")}
            </p>
          </div>

          <div className="space-y-1">
            {tagovi.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">{t("Nema tagova. Dodaj prvi iznad.")}</p>
            ) : (() => {
              const katSlugs = new Set(kategorije.map(k => k.slug));
              const grupe: { kljuc: string; naslov: string; lista: KvizTagApi[] }[] = kategorije.map(k => ({
                kljuc: k.slug,
                naslov: k.ikona ? `${k.ikona} ${k.naziv}` : k.naziv,
                lista: tagovi.filter(tg => tg.kategorija === k.slug),
              }));
              const orphan = tagovi.filter(tg => !katSlugs.has(tg.kategorija));
              if (orphan.length > 0) grupe.push({ kljuc: "__orphan__", naslov: t("Bez kategorije"), lista: orphan });
              return grupe.filter(g => g.lista.length > 0).map(g => (
                <div key={g.kljuc} className="mb-3">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">{g.naslov}</div>
                  {g.lista.map(tag => (
                    <div key={tag.id} className="px-3 py-2 border border-border rounded-lg mb-1">
                      {editingTag?.id === tag.id ? (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                            <input
                              value={editTagNaziv}
                              onChange={e => setEditTagNaziv(e.target.value)}
                              placeholder={t("Naziv")}
                              className="px-3 py-2 border border-border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-teal-400"
                            />
                            <input
                              value={editTagSlug}
                              onChange={e => setEditTagSlug(e.target.value)}
                              placeholder={t("slug")}
                              className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                            />
                            <select
                              value={editTagKat}
                              onChange={e => setEditTagKat(e.target.value)}
                              className="px-3 py-2 border border-border rounded-lg text-base bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                            >
                              <option value="">{t("— glavna kategorija —")}</option>
                              {kategorije.map(k => <option key={k.id} value={k.slug}>{k.ikona ? `${k.ikona} ${k.naziv}` : k.naziv}</option>)}
                            </select>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditingTag(null)} className="px-3 py-1.5 rounded-lg border border-border font-semibold text-sm hover:bg-muted">{t("Odustani")}</button>
                            <button onClick={() => urediTag(tag)} disabled={savingTag} className="px-3 py-1.5 rounded-lg bg-teal-500 text-white font-semibold text-sm hover:bg-teal-600 disabled:opacity-50">
                              {savingTag ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Sačuvaj")}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-foreground truncate">{tag.naziv}</div>
                            <div className="text-xs text-muted-foreground">
                              <span className="font-mono">{tag.slug}</span> · {t("{n} pitanja", { n: String(tag.brojPitanja || 0) })}
                            </div>
                          </div>
                          <button
                            onClick={() => startEditTag(tag)}
                            className="p-2 rounded-lg hover:bg-teal-50 text-muted-foreground hover:text-teal-600 transition"
                            title={t("Uredi tag")}
                            data-testid={`btn-uredi-tag-${tag.slug}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfirmingTag(tag)}
                            className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition"
                            title={t("Obriši tag")}
                            data-testid={`btn-obrisi-tag-${tag.slug}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ));
            })()}
          </div>
        </div>

        {confirming && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirming(null)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="font-extrabold text-lg text-foreground">{t("Obrisati kategoriju?")}</h3>
              </div>
              <p className="text-base text-muted-foreground mb-2">
                <strong>{confirming.naziv}</strong> ({t("{n} pitanja", { n: String(confirming.brojPitanja || 0) })})
              </p>
              {(confirming.brojPitanja || 0) > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-800">
                  {t("Pitanja u ovoj kategoriji ostaju u banci, samo neće više imati kategoriju i prikazivat će se sa starim slug-om dok im ne dodijeliš novu.")}
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button onClick={() => setConfirming(null)} className="px-4 py-2 rounded-xl border border-border font-semibold hover:bg-muted">{t("Odustani")}</button>
                <button onClick={() => obrisi(confirming)} disabled={saving} className="px-4 py-2 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Obriši")}
                </button>
              </div>
            </div>
          </div>
        )}

        {confirmingTag && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmingTag(null)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="font-extrabold text-lg text-foreground">{t("Obrisati tag?")}</h3>
              </div>
              <p className="text-base text-muted-foreground mb-2">
                <strong>{confirmingTag.naziv}</strong> ({t("{n} pitanja", { n: String(confirmingTag.brojPitanja || 0) })})
              </p>
              {(confirmingTag.brojPitanja || 0) > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-800">
                  {t("Tag će biti uklonjen iz svih {n} pitanja. Sama pitanja ostaju u banci.", { n: String(confirmingTag.brojPitanja) })}
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button onClick={() => setConfirmingTag(null)} className="px-4 py-2 rounded-xl border border-border font-semibold hover:bg-muted">{t("Odustani")}</button>
                <button onClick={() => obrisiTag(confirmingTag)} disabled={savingTag} className="px-4 py-2 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50">
                  {savingTag ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Obriši")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface FormProps {
  form: ReturnType<typeof emptyForm>;
  setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof emptyForm>>>;
  lekcije: IlmihalLekcija[];
  kategorijeLabels: Record<string, string>;
  kategorijaTagovi: Record<string, string[]>;
  tagLabels: Record<string, string>;
  editId: number | null;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onOpcijaChange: (i: number, val: string) => void;
  onAddOpcija: () => void;
  onRemoveOpcija: (i: number) => void;
}

interface LekcijaPickerProps {
  lekcije: IlmihalLekcija[];
  value: number | null;
  onChange: (id: number | null) => void;
}

// Pretraživi picker lekcija — bolji od <select> sa 300+ stavki.
// Pretražuje po naslovu, slugu i nivou ("N1", "N2", "N3").
function LekcijaPicker({ lekcije, value, onChange }: LekcijaPickerProps) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => (value ? lekcije.find(l => l.id === value) ?? null : null),
    [lekcije, value]
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = [...lekcije].sort((a, b) => a.nivo - b.nivo || a.naslov.localeCompare(b.naslov, "bs"));
    if (!q) return base.slice(0, 100);
    return base
      .filter(l => {
        const hay = `n${l.nivo} ${l.naslov} ${l.slug}`.toLowerCase();
        return q.split(/\s+/).every(part => hay.includes(part));
      })
      .slice(0, 100);
  }, [lekcije, query]);

  return (
    <div className="relative">
      {selected && !open ? (
        <div className="flex items-center gap-2 w-full px-3 py-2 border border-border rounded-xl bg-white">
          <span className="flex-1 text-base truncate">
            <span className="inline-block px-1.5 py-0.5 mr-2 text-xs font-bold bg-amber-100 text-amber-800 rounded">N{selected.nivo}</span>
            {selected.naslov}
          </span>
          <button
            type="button"
            onClick={() => { setQuery(""); setOpen(true); }}
            className="text-sm text-amber-700 hover:text-amber-900 font-semibold whitespace-nowrap"
          >
            {t("Promijeni")}
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-muted-foreground hover:text-foreground"
            title={t("Ukloni vezu sa lekcijom")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              autoFocus={open}
              value={query}
              onChange={e => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              placeholder={t("Pretraži lekcije (naziv, N1/N2/N3)…")}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          {open && (
            <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto bg-white border border-border rounded-xl shadow-lg">
              <button
                type="button"
                onClick={() => { onChange(null); setOpen(false); setQuery(""); }}
                className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-amber-50 border-b border-border"
              >
                {t("— nijedna —")}
              </button>
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">{t('Nema rezultata za "{query}"', { query })}</div>
              ) : (
                filtered.map(l => (
                  <button
                    type="button"
                    key={l.id}
                    onClick={() => { onChange(l.id); setOpen(false); setQuery(""); }}
                    className={`w-full text-left px-3 py-2 text-base hover:bg-amber-50 flex items-center gap-2 ${value === l.id ? "bg-amber-100" : ""}`}
                  >
                    <span className="inline-block px-1.5 py-0.5 text-xs font-bold bg-amber-100 text-amber-800 rounded shrink-0">N{l.nivo}</span>
                    <span className="truncate">{l.naslov}</span>
                  </button>
                ))
              )}
              {filtered.length === 100 && (
                <div className="px-3 py-2 text-xs text-muted-foreground text-center border-t border-border">
                  {t("Prikazano prvih 100 — suzi pretragu za ostalo.")}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PitanjeForm({ form, setForm, lekcije, kategorijeLabels, kategorijaTagovi, tagLabels, editId, saving, onSave, onCancel, onOpcijaChange, onAddOpcija, onRemoveOpcija }: FormProps) {
  const { t } = useLanguage();
  return (
    <div className="bg-white border-2 border-amber-200 rounded-2xl p-5 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg text-foreground">{editId ? t("Uredi pitanje") : t("Novo pitanje")}</h3>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
      </div>
      <div className="space-y-3">
        <div>
          <label className="block text-base font-semibold text-foreground mb-1">{t("Pitanje")}</label>
          <textarea
            value={form.pitanje}
            onChange={e => setForm(prev => ({ ...prev, pitanje: e.target.value }))}
            rows={2}
            className="w-full px-4 py-2.5 border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1">{t("Tip pitanja")}</label>
          <select
            value={form.vrsta}
            onChange={e => {
              const v = e.target.value as Vrsta;
              setForm(prev => {
                const base = { ...prev, vrsta: v };
                if (v === "truefalse") {
                  return { ...base, opcije: ["Da", "Ne"], correctIndex: 0, correctIndexes: [], correctOrder: [] };
                }
                if (v === "reorder") {
                  const op = prev.opcije.length >= 2 ? prev.opcije : ["", "", "", ""];
                  return { ...base, opcije: op, correctOrder: op.map((_, i) => i + 1), correctIndexes: [] };
                }
                if (v === "multiple") {
                  return { ...base, correctIndexes: prev.correctIndex >= 0 ? [prev.correctIndex] : [], correctOrder: [] };
                }
                if (v === "dragDrop") {
                  return {
                    ...base,
                    opcije: [],
                    template: prev.template.length > 0 ? prev.template : ["", "DROP"],
                    words: prev.words.length > 0 ? prev.words : ["", ""],
                    correct: prev.correct.length > 0 ? prev.correct : [""],
                  };
                }
                if (v === "markWords") {
                  return {
                    ...base,
                    opcije: [],
                    text: prev.text || "",
                    words: prev.words.length > 0 ? prev.words : [],
                    incorrect: prev.incorrect || [],
                  };
                }
                return { ...base, correctIndexes: [], correctOrder: [] };
              });
            }}
            className="w-full px-3 py-2 border border-border rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="single">{t("Jedan tačan odgovor")}</option>
            <option value="multiple">{t("Više tačnih odgovora")}</option>
            <option value="truefalse">{t("Da / Ne")}</option>
            <option value="reorder">{t("Poredaj redom")}</option>
            <option value="dragDrop">{t("Dopuni (drag & drop)")}</option>
            <option value="markWords">{t("Pronađi grešku")}</option>
          </select>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">{t("Šta pitanje vježba")}</label>
            <select
              value={form.didaktickiTip}
              onChange={e => setForm(prev => ({ ...prev, didaktickiTip: e.target.value as "" | DidaktickiTip }))}
              className="w-full px-3 py-2 border border-border rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">{t("Nije označeno")}</option>
              {Object.entries(DIDAKTICKI_TIP_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{t(label)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">{t("Ponovni pokušaj")}</label>
            <select
              value={form.retryMode}
              onChange={e => setForm(prev => ({ ...prev, retryMode: e.target.value as "" | "immediate" }))}
              className="w-full px-3 py-2 border border-border rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">{t("Bez posebnog pokušaja")}</option>
              <option value="immediate">{t("Odmah ponovi isto pitanje")}</option>
            </select>
          </div>
        </div>
        {form.retryMode === "immediate" && (
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">{t("Uputa prije ponovnog pokušaja")}</label>
            <textarea
              value={form.retryPrompt}
              onChange={e => setForm(prev => ({ ...prev, retryPrompt: e.target.value }))}
              rows={2}
              placeholder={t("Npr. Prisjeti se koji događaj dolazi prvi.")}
              className="w-full px-3 py-2 border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y"
            />
          </div>
        )}
        {form.sourceQuestion && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-xs font-extrabold uppercase tracking-wide text-blue-700 mb-1">{t("Izvorno pitanje")}</p>
            <p className="text-sm text-blue-900">{form.sourceQuestion}</p>
          </div>
        )}

        {form.vrsta === "truefalse" ? (
          <div>
            <label className="block text-base font-semibold text-foreground mb-1">{t("Tačan odgovor")}</label>
            <div className="flex gap-3">
              {["Da", "Ne"].map((label, i) => (
                <label key={i} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 cursor-pointer transition ${form.correctIndex === i ? "border-emerald-500 bg-emerald-50 text-emerald-800 font-bold" : "border-border bg-white hover:bg-muted"}`}>
                  <input type="radio" name="tf" checked={form.correctIndex === i} onChange={() => setForm(prev => ({ ...prev, correctIndex: i }))} className="w-5 h-5 accent-emerald-600" />
                  {t(label)}
                </label>
              ))}
            </div>
          </div>
        ) : form.vrsta === "reorder" ? (
          <div>
            <label className="block text-base font-semibold text-foreground mb-1">
              {t("Stavke (upiši broj redoslijeda 1..N kako trebaju biti složene)")}
            </label>
            <div className="space-y-2">
              {form.opcije.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={form.opcije.length}
                    value={form.correctOrder[i] ?? (i + 1)}
                    onChange={e => {
                      const n = parseInt(e.target.value) || 1;
                      setForm(prev => {
                        const next = [...prev.correctOrder];
                        while (next.length < prev.opcije.length) next.push(next.length + 1);
                        next[i] = Math.max(1, Math.min(prev.opcije.length, n));
                        return { ...prev, correctOrder: next };
                      });
                    }}
                    className="w-16 px-2 py-2 border border-border rounded-lg text-center text-base font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <input
                    value={o}
                    onChange={e => onOpcijaChange(i, e.target.value)}
                    placeholder={t("Stavka {n}", { n: String(i + 1) })}
                    className="flex-1 px-3 py-2 border border-border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  {form.opcije.length > 2 && (
                    <button
                      onClick={() => {
                        onRemoveOpcija(i);
                        setForm(prev => ({ ...prev, correctOrder: prev.correctOrder.filter((_, j) => j !== i).map((_, k) => k + 1) }));
                      }}
                      className="p-2 text-muted-foreground hover:text-red-500"
                      title={t("Ukloni")}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                onAddOpcija();
                setForm(prev => ({ ...prev, correctOrder: [...prev.correctOrder, prev.correctOrder.length + 1] }));
              }}
              className="mt-2 text-sm text-amber-700 font-semibold hover:underline"
            >
              {t("+ Dodaj stavku")}
            </button>
            <p className="text-xs text-muted-foreground mt-2">{t("Brojevi moraju činiti permutaciju 1..{n} (svaki broj tačno jednom).", { n: String(form.opcije.length) })}</p>
          </div>
        ) : form.vrsta === "dragDrop" ? (
          <DragDropEditor form={form} setForm={setForm} />
        ) : form.vrsta === "markWords" ? (
          <MarkWordsEditor form={form} setForm={setForm} />
        ) : form.vrsta === "multiple" ? (
          <div>
            <label className="block text-base font-semibold text-foreground mb-1">{t("Opcije (označi sve tačne — minimum 2)")}</label>
            <div className="space-y-2">
              {form.opcije.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.correctIndexes.includes(i)}
                    onChange={e => setForm(prev => ({
                      ...prev,
                      correctIndexes: e.target.checked
                        ? Array.from(new Set([...prev.correctIndexes, i])).sort((a, b) => a - b)
                        : prev.correctIndexes.filter(x => x !== i),
                    }))}
                    className="w-5 h-5 accent-emerald-600"
                  />
                  <input
                    value={o}
                    onChange={e => onOpcijaChange(i, e.target.value)}
                    placeholder={t("Opcija {n}", { n: String(i + 1) })}
                    className="flex-1 px-3 py-2 border border-border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  {form.opcije.length > 2 && (
                    <button onClick={() => onRemoveOpcija(i)} className="p-2 text-muted-foreground hover:text-red-500" title={t("Ukloni")}>
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={onAddOpcija} className="mt-2 text-sm text-amber-700 font-semibold hover:underline">{t("+ Dodaj opciju")}</button>
          </div>
        ) : (
          <div>
            <label className="block text-base font-semibold text-foreground mb-1">{t("Opcije (klikni radio za tačan odgovor)")}</label>
            <div className="space-y-2">
              {form.opcije.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct"
                    checked={form.correctIndex === i}
                    onChange={() => setForm(prev => ({ ...prev, correctIndex: i }))}
                    className="w-5 h-5 accent-emerald-600"
                  />
                  <input
                    value={o}
                    onChange={e => onOpcijaChange(i, e.target.value)}
                    placeholder={t("Opcija {n}", { n: String(i + 1) })}
                    className="flex-1 px-3 py-2 border border-border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  {form.opcije.length > 2 && (
                    <button onClick={() => onRemoveOpcija(i)} className="p-2 text-muted-foreground hover:text-red-500" title={t("Ukloni")}>
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={onAddOpcija} className="mt-2 text-sm text-amber-700 font-semibold hover:underline">{t("+ Dodaj opciju")}</button>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">{t("Kategorija (NPP 2018)")}</label>
            <select
              value={form.kategorija}
              onChange={e => setForm(prev => ({ ...prev, kategorija: e.target.value, tagovi: [] }))}
              className="w-full px-3 py-2 border border-border rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">{t("— bez —")}</option>
              {Object.entries(kategorijeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">{t("Lekcija (opciono)")}</label>
            <LekcijaPicker
              lekcije={lekcije}
              value={form.lekcijaId === "" ? null : Number(form.lekcijaId)}
              onChange={id => setForm(prev => ({ ...prev, lekcijaId: id === null ? "" : id }))}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">{t("Težina")}</label>
            <select
              value={form.tezina}
              onChange={e => setForm(prev => ({ ...prev, tezina: Number(e.target.value) }))}
              className="w-full px-3 py-2 border border-border rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value={1}>{t("Lako")}</option>
              <option value={2}>{t("Srednje")}</option>
              <option value={3}>{t("Teško")}</option>
            </select>
          </div>
        </div>
        {/* Tagovi — admin filtriranje */}
        {form.kategorija && kategorijaTagovi[form.kategorija] && (
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">{t("Tagovi (pod-teme)")}</label>
            <div className="flex flex-wrap gap-2">
              {kategorijaTagovi[form.kategorija].map(tag => {
                const active = (form.tagovi || []).includes(tag);
                return (
                  <button key={tag} onClick={() => setForm(prev => {
                    const curr = prev.tagovi || [];
                    const next = active ? curr.filter(t => t !== tag) : [...curr, tag];
                    return { ...prev, tagovi: next };
                  })}
                    className={`px-3 py-1 rounded-full text-sm font-semibold transition ${active ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"}`}>
                    {tagLabels[tag] || tag}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t("Tagovi služe za admin filtriranje — polaznici ih ne vide.")}</p>
          </div>
        )}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1">{t("Slika (URL, opciono)")}</label>
          <input
            value={form.slika}
            onChange={e => setForm(prev => ({ ...prev, slika: e.target.value }))}
            placeholder="/uploads/slika.png"
            className="w-full px-3 py-2 border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1">{t("Objašnjenje (opciono, prikazuje se nakon odgovora)")}</label>
          <textarea
            value={form.objasnjenje}
            onChange={e => setForm(prev => ({ ...prev, objasnjenje: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y"
          />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl border border-border font-semibold hover:bg-muted">{t("Odustani")}</button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {editId ? t("Sačuvaj") : t("Dodaj u banku")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DragDropEditor ──────────────────────────────────────────────────────────
// Šablon = niz dijelova: tekstualni segmenti i "DROP" markeri. Učenik povlači
// riječ iz `words` poola u svaki DROP. `correct` čuva tačan slijed riječi za
// DROP slotove (po redu pojavljivanja).
function DragDropEditor({
  form, setForm,
}: {
  form: ReturnType<typeof emptyForm>;
  setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof emptyForm>>>;
}) {
  const { t } = useLanguage();
  const dropCount = form.template.filter(p => p === "DROP").length;

  // Drži correct poravnatim sa dropCount
  const ensureCorrect = (n: number, prev: string[]) => {
    const next = prev.slice(0, n);
    while (next.length < n) next.push("");
    return next;
  };

  const updatePart = (i: number, val: string) =>
    setForm(prev => ({ ...prev, template: prev.template.map((t, j) => j === i ? val : t) }));

  const removePart = (i: number) =>
    setForm(prev => {
      const nextTemplate = prev.template.filter((_, j) => j !== i);
      const nextDropCount = nextTemplate.filter(t => t === "DROP").length;
      return { ...prev, template: nextTemplate, correct: ensureCorrect(nextDropCount, prev.correct) };
    });

  const addText = () => setForm(prev => ({ ...prev, template: [...prev.template, ""] }));
  const addDrop = () => setForm(prev => ({
    ...prev,
    template: [...prev.template, "DROP"],
    correct: ensureCorrect(prev.template.filter(t => t === "DROP").length + 1, prev.correct),
  }));

  const updateWord = (i: number, val: string) =>
    setForm(prev => {
      const oldVal = prev.words[i];
      const next = prev.words.map((w, j) => j === i ? val : w);
      // Ako se mijenja riječ koja je odabrana kao tačan odgovor — ažuriraj correct
      const nextCorrect = prev.correct.map(c => c === oldVal ? val : c);
      return { ...prev, words: next, correct: nextCorrect };
    });
  const removeWord = (i: number) =>
    setForm(prev => {
      const removed = prev.words[i];
      return {
        ...prev,
        words: prev.words.filter((_, j) => j !== i),
        correct: prev.correct.map(c => c === removed ? "" : c),
      };
    });
  const addWord = () => setForm(prev => ({ ...prev, words: [...prev.words, ""] }));

  const setCorrectAt = (slot: number, val: string) =>
    setForm(prev => ({ ...prev, correct: ensureCorrect(dropCount, prev.correct).map((c, j) => j === slot ? val : c) }));

  return (
    <div className="space-y-4 bg-amber-50/40 border border-amber-200 rounded-xl p-3">
      <div>
        <label className="block text-base font-semibold text-foreground mb-1">{t("Šablon (tekst + praznine)")}</label>
        <p className="text-xs text-muted-foreground mb-2">{t(`Razdijeli rečenicu u dijelove. "DROP" je prazna rupa koju učenik popunjava.`)}</p>
        <div className="space-y-2">
          {form.template.map((part, i) => (
            <div key={i} className="flex items-center gap-2">
              {part === "DROP" ? (
                <div className="flex-1 px-3 py-2 border-2 border-dashed border-amber-400 bg-amber-100 rounded-lg text-amber-800 font-semibold text-base">
                  ___ {t("praznina")} #{form.template.slice(0, i + 1).filter(p => p === "DROP").length}
                </div>
              ) : (
                <input
                  value={part}
                  onChange={e => updatePart(i, e.target.value)}
                  placeholder={t(`Tekstualni dio (npr. 'Gusulskih šarta ima')`)}
                  className="flex-1 px-3 py-2 border border-border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              )}
              <button onClick={() => removePart(i)} className="p-2 text-muted-foreground hover:text-red-500" title={t("Ukloni")}>
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <button onClick={addText} className="text-sm text-amber-700 font-semibold hover:underline">{t("+ Dodaj tekst")}</button>
          <button onClick={addDrop} className="text-sm text-amber-700 font-semibold hover:underline">{t("+ Dodaj prazninu")}</button>
        </div>
      </div>

      <div>
        <label className="block text-base font-semibold text-foreground mb-1">{t("Pool riječi (sve ponuđene, uključujući distrakcije)")}</label>
        <div className="space-y-2">
          {form.words.map((w, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={w}
                onChange={e => updateWord(i, e.target.value)}
                placeholder={t("Riječ {n}", { n: String(i + 1) })}
                className="flex-1 px-3 py-2 border border-border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button onClick={() => removeWord(i)} className="p-2 text-muted-foreground hover:text-red-500"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        <button onClick={addWord} className="mt-2 text-sm text-amber-700 font-semibold hover:underline">{t("+ Dodaj riječ")}</button>
      </div>

      {dropCount > 0 && (
        <div>
          <label className="block text-base font-semibold text-foreground mb-1">{t("Tačan slijed za praznine")}</label>
          <p className="text-xs text-muted-foreground mb-2">{t("Za svaku prazninu odaberi tačnu riječ iz poola.")}</p>
          <div className="space-y-2">
            {Array.from({ length: dropCount }).map((_, slot) => (
              <div key={slot} className="flex items-center gap-2">
                <span className="text-sm font-bold text-amber-700 min-w-[80px]">{t("Praznina")} #{slot + 1}</span>
                <select
                  value={form.correct[slot] || ""}
                  onChange={e => setCorrectAt(slot, e.target.value)}
                  className="flex-1 px-3 py-2 border border-border rounded-lg text-base bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="">{t("— odaberi —")}</option>
                  {form.words.filter(w => w.trim()).map((w, j) => (
                    <option key={j} value={w}>{w}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MarkWordsEditor ─────────────────────────────────────────────────────────
// Učenik dobija tekst s podijeljenim riječima i klikom označava one koje su
// pogrešne. `text` se splituje po razmaku u `words`. `incorrect` su klikabilne.
function MarkWordsEditor({
  form, setForm,
}: {
  form: ReturnType<typeof emptyForm>;
  setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof emptyForm>>>;
}) {
  const { t } = useLanguage();
  const setText = (txt: string) => {
    const newWords = txt.split(/\s+/).filter(w => w.length > 0);
    setForm(prev => ({
      ...prev,
      text: txt,
      words: newWords,
      // zadrži samo one incorrect koji još postoje u novim words
      incorrect: prev.incorrect.filter(w => newWords.includes(w)),
    }));
  };

  const toggleIncorrect = (w: string) => {
    setForm(prev => ({
      ...prev,
      incorrect: prev.incorrect.includes(w)
        ? prev.incorrect.filter(x => x !== w)
        : [...prev.incorrect, w],
    }));
  };

  return (
    <div className="space-y-4 bg-amber-50/40 border border-amber-200 rounded-xl p-3">
      <div>
        <label className="block text-base font-semibold text-foreground mb-1">{t("Tekst (riječi razdvojene razmakom)")}</label>
        <textarea
          value={form.text}
          onChange={e => setText(e.target.value)}
          rows={3}
          placeholder={t("Npr.: Allah je jedan i nema mu para u vlasti.")}
          className="w-full px-3 py-2 border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y"
        />
      </div>
      {form.words.length > 0 && (
        <div>
          <label className="block text-base font-semibold text-foreground mb-1">{t("Klikni riječi koje su POGREŠNE (one koje učenik treba pronaći)")}</label>
          <div className="flex flex-wrap gap-2 p-3 bg-white rounded-lg border border-border">
            {form.words.map((w, i) => {
              const isIncorrect = form.incorrect.includes(w);
              return (
                <button
                  key={i}
                  onClick={() => toggleIncorrect(w)}
                  className={`px-2.5 py-1.5 rounded-lg font-semibold text-base transition ${
                    isIncorrect
                      ? "bg-red-100 text-red-700 border-2 border-red-400 line-through"
                      : "bg-slate-100 text-slate-700 border-2 border-transparent hover:bg-slate-200"
                  }`}
                >
                  {w}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {form.incorrect.length === 0
              ? t("Nijedna riječ nije označena kao pogrešna.")
              : t("Označeno: {n} pogrešnih riječi.", { n: String(form.incorrect.length) })}
          </p>
        </div>
      )}
    </div>
  );
}
