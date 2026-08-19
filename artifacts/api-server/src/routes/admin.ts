import { Router } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import mammoth from "mammoth";
import PDFParser from "pdf2json";
import { db } from "@workspace/db";
import {
  usersTable,
  muallimProfiliTable,
  ucenikProfiliTable,
  mektebiTable,
  pretplateTable,
  kvizoviTable,
  kvizPitanjaTable,
  pitanjaBankaTable,
  KVIZ_KATEGORIJE,
  ilmihalLekcijeTable,
  kvizRezultatiTable,
  posjeteTable,
  korisnikNapredakTable,
  grupeTable,
  roditeljProfiliTable,
  roditeljUcenikTable,
  priustvoTable,
  ocjeneTable,
  mektebKalendarTable,
  planLekcijaTable,
  porukeTable,
  zadaceTable,
  certifikatiTable,
  prilozi,
  rjecnikTable,
  studentProgressTable,
  exerciseSessionsTable,
  igraPitanjaTable,
  MEDENA_KATEGORIJE,
  type MedenaKategorija,
  knjige,
  kategorijeKnjigeTable,
  kvizKategorijeTable,
  kvizTagoviTable,
  medaljoniTable,
  krunisanjaTable,
  krunisanjeLekcijeTable,
  etapaPolaganjaTable,
  studentKrunisanjaTable,
} from "@workspace/db/schema";
import { eq, desc, asc, sql, gte, gt, lt, lte, inArray, and, isNotNull, or } from "drizzle-orm";
import { requireAuth, invalidateUserStatusCache } from "../middlewares/auth.js";
import { CT_TABLES } from "../lib/content-translatable.js";

const router = Router();
router.use(requireAuth);

// Prilozi (materijali za nastavu) — i muallim i admin smiju upravljati;
// sve ostale admin rute ostaju strogo admin-only.
router.use((req, res, next) => {
  const role = (req as unknown as { user?: { role?: string } }).user?.role;
  // Boundary-safe prefix: tačno "/prilozi" ili podruta "/prilozi/...".
  // Sprječava buduće slučajeve gdje bi nova ruta tipa "/priloziXYZ" slučajno
  // postala dostupna i muallim-u zbog naivnog startsWith-a.
  const isPriloziRoute = req.path === "/prilozi" || req.path.startsWith("/prilozi/");
  const isUploadRoute = req.path === "/upload";
  const allowed = (isPriloziRoute || isUploadRoute)
    ? role === "admin" || role === "muallim"
    : role === "admin";
  if (!allowed) {
    return res.status(403).json({ error: "Nemaš dozvolu za ovu radnju" });
  }
  next();
  return;
});

const __adminDirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = process.env["UPLOADS_DIR"]
  ? path.resolve(process.env["UPLOADS_DIR"])
  : path.resolve(process.cwd(), "uploads");
import fs from "fs";
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`[Upload] Created uploads dir: ${uploadsDir}`);
} else {
  console.log(`[Upload] Using uploads dir: ${uploadsDir}`);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp)$/i;
    if (allowed.test(path.extname(file.originalname))) cb(null, true);
    else cb(new Error("Dozvoljeni su samo formati slika (jpg, png, gif, webp)"));
  },
});

const docUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(pdf|docx)$/i;
    if (allowed.test(path.extname(file.originalname))) cb(null, true);
    else cb(new Error("Dozvoljeni su samo PDF i DOCX formati"));
  },
});

router.post("/upload-document", (req, res) => {
  docUpload.single("document")(req, res, async (err) => {
    if (err) {
      const msg = err instanceof multer.MulterError
        ? (err.code === "LIMIT_FILE_SIZE" ? "Fajl prevelik (max 20MB)" : err.message)
        : err.message || "Greška pri uploadu";
      return res.status(400).json({ error: msg });
    }
    if (!req.file) return res.status(400).json({ error: "Nema fajla" });

    try {
      const filePath = req.file.path;
      const ext = path.extname(req.file.originalname).toLowerCase();
      let html = "";

      if (ext === ".docx") {
        const result = await mammoth.convertToHtml({ path: filePath });
        html = result.value;
      } else if (ext === ".pdf") {
        const pdfText = await new Promise<string>((resolve, reject) => {
          const pdfParser = new (PDFParser as any)(null, true);
          pdfParser.on("pdfParser_dataError", (errData: any) => reject(new Error(errData.parserError)));
          pdfParser.on("pdfParser_dataReady", () => {
            const rawText = (pdfParser as any).getRawTextContent();
            resolve(rawText);
          });
          pdfParser.loadPDF(filePath);
        });
        const lines = pdfText.split("\n").filter((l: string) => l.trim());
        html = lines.map((l: string) => `<p>${l.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`).join("\n");
      }

      fs.unlinkSync(filePath);

      res.json({
        html,
        filename: req.file.originalname,
        format: ext.replace(".", ""),
      });
    } catch (e: any) {
      res.status(500).json({ error: "Greška pri obradi dokumenta: " + e.message });
    }
    return;
  });
});

// Resize/optimize uploaded raster images: max 1600px width, WebP quality 82.
// Skips animated GIFs and SVGs (preserved as-is).
async function optimizeUploadedImage(filePath: string, originalName: string): Promise<{ filename: string; bytesBefore: number; bytesAfter: number; skipped: boolean }> {
  const ext = path.extname(originalName).toLowerCase();
  const stat = fs.statSync(filePath);
  const bytesBefore = stat.size;
  if (ext === ".gif" || ext === ".svg") {
    return { filename: path.basename(filePath), bytesBefore, bytesAfter: bytesBefore, skipped: true };
  }
  try {
    const sharp = (await import("sharp")).default;
    const buf = await sharp(filePath, { failOn: "none" })
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    const newName = path.basename(filePath, ext) + ".webp";
    const newPath = path.join(path.dirname(filePath), newName);
    fs.writeFileSync(newPath, buf);
    if (newPath !== filePath) {
      try { fs.unlinkSync(filePath); } catch {}
    }
    return { filename: newName, bytesBefore, bytesAfter: buf.length, skipped: false };
  } catch (e) {
    console.warn("[Upload] Sharp optimize failed, keeping original:", (e as Error).message);
    return { filename: path.basename(filePath), bytesBefore, bytesAfter: bytesBefore, skipped: true };
  }
}

router.post("/upload", (req, res) => {
  upload.single("image")(req, res, async (err) => {
    if (err) {
      const msg = err instanceof multer.MulterError
        ? (err.code === "LIMIT_FILE_SIZE" ? "Fajl prevelik (max 10MB)" : err.message)
        : err.message || "Greška pri uploadu";
      return res.status(400).json({ error: msg });
    }
    if (!req.file) return res.status(400).json({ error: "Nema fajla" });
    try {
      const result = await optimizeUploadedImage(req.file.path, req.file.originalname);
      const url = `/uploads/${result.filename}`;
      console.log(`[Upload] ${req.file.originalname}: ${(result.bytesBefore/1024).toFixed(0)}KB -> ${(result.bytesAfter/1024).toFixed(0)}KB${result.skipped ? " (skipped)" : ""}`);
      res.json({ url, originalSize: result.bytesBefore, finalSize: result.bytesAfter, optimized: !result.skipped });
    } catch (e: any) {
      res.status(500).json({ error: "Greška pri obradi slike: " + e.message });
    }
    return;
  });
});

const audioUpload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(mp3|m4a|aac|ogg|oga|opus|wav|webm)$/i;
    if (allowed.test(path.extname(file.originalname))) cb(null, true);
    else cb(new Error("Dozvoljeni formati: MP3, M4A, AAC, OGG, OPUS, WAV"));
  },
});

router.post("/upload-audio", (req, res) => {
  audioUpload.single("audio")(req, res, async (err) => {
    if (err) {
      const msg = err instanceof multer.MulterError
        ? (err.code === "LIMIT_FILE_SIZE" ? "Audio fajl prevelik (max 30MB)" : err.message)
        : err.message || "Greška pri uploadu";
      return res.status(400).json({ error: msg });
    }
    if (!req.file) return res.status(400).json({ error: "Nema fajla" });
    const url = `/uploads/${req.file.filename}`;
    console.log(`[Upload-Audio] ${req.file.originalname} -> ${req.file.filename} (${(req.file.size / 1024).toFixed(0)}KB)`);
    res.json({ url, filename: req.file.originalname, size: req.file.size });
    return;
  });
});

const attachUpload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(pdf|docx|doc|xlsx|xls|pptx|ppt|txt|rtf)$/i;
    if (allowed.test(path.extname(file.originalname))) cb(null, true);
    else cb(new Error("Dozvoljeni formati: PDF, DOCX, DOC, XLSX, PPTX, TXT"));
  },
});

router.post("/prilozi/:lekcijaId", (req, res) => {
  attachUpload.single("file")(req, res, async (err) => {
    if (err) {
      const msg = err instanceof multer.MulterError
        ? (err.code === "LIMIT_FILE_SIZE" ? "Fajl prevelik (max 25MB)" : err.message)
        : err.message || "Greška pri uploadu";
      return res.status(400).json({ error: msg });
    }
    if (!req.file) return res.status(400).json({ error: "Nema fajla" });
    try {
      const lekcijaId = parseInt(req.params.lekcijaId);
      if (isNaN(lekcijaId)) return res.status(400).json({ error: "Nevažeći ID lekcije" });
      const [exists] = await db.select({ id: ilmihalLekcijeTable.id }).from(ilmihalLekcijeTable).where(eq(ilmihalLekcijeTable.id, lekcijaId));
      if (!exists) return res.status(404).json({ error: "Lekcija nije pronađena" });
      const mimeMap: Record<string, string> = {
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".doc": "application/msword",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".xls": "application/vnd.ms-excel",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".ppt": "application/vnd.ms-powerpoint",
        ".txt": "text/plain",
        ".rtf": "application/rtf",
      };
      const ext = path.extname(req.file.originalname).toLowerCase();
      const uploaderRole = req.user?.role ?? "muallim";
      const uploaderUserId = req.user?.userId ?? null;
      const [inserted] = await db.insert(prilozi).values({
        lekcijaId,
        originalName: req.file.originalname,
        storedName: req.file.filename,
        fileSize: req.file.size,
        mimeType: mimeMap[ext] || "application/octet-stream",
        approved: uploaderRole === "admin",
        uploadedByRole: uploaderRole,
        uploadedByUserId: uploaderUserId,
      }).returning();
      res.json(inserted);
    } catch (e: any) {
      console.error("[POST /prilozi/:lekcijaId] insert failed:", {
        lekcijaId: req.params.lekcijaId,
        file: req.file && { name: req.file.originalname, size: req.file.size, stored: req.file.filename },
        errCode: e?.code,
        errMessage: e?.message,
        errDetail: e?.detail,
        stack: e?.stack,
      });
      res.status(500).json({ error: "Greška servera pri snimanju priloga. Pokušaj ponovo." });
    }
    return;
  });
});

// POST /api/admin/prilozi/:lekcijaId/url — dodaj eksterni link (YouTube, web)
router.post("/prilozi/:lekcijaId/url", async (req, res) => {
  try {
    const lekcijaId = parseInt(req.params.lekcijaId);
    if (isNaN(lekcijaId)) return res.status(400).json({ error: "Nevažeći ID lekcije" });
    const { url, label } = (req.body || {}) as { url?: string; label?: string };
    if (!url || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: "Nevažeći URL (mora počinjati sa http:// ili https://)" });
    if (url.length > 2000) return res.status(400).json({ error: "URL predugačak" });
    const [exists] = await db.select({ id: ilmihalLekcijeTable.id }).from(ilmihalLekcijeTable).where(eq(ilmihalLekcijeTable.id, lekcijaId));
    if (!exists) return res.status(404).json({ error: "Lekcija nije pronađena" });
    let mimeType = "text/uri-list";
    if (/youtube\.com|youtu\.be/i.test(url)) mimeType = "video/youtube";
    else if (/vimeo\.com/i.test(url)) mimeType = "video/vimeo";
    const displayName = (label && label.trim()) || url.replace(/^https?:\/\//i, "").slice(0, 120);
    const uploaderRole = req.user?.role ?? "muallim";
    const uploaderUserId = req.user?.userId ?? null;
    const [inserted] = await db.insert(prilozi).values({
      lekcijaId,
      originalName: displayName,
      storedName: "",
      fileSize: 0,
      mimeType,
      kind: "url",
      externalUrl: url,
      approved: uploaderRole === "admin",
      uploadedByRole: uploaderRole,
      uploadedByUserId: uploaderUserId,
    }).returning();
    res.json(inserted);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
  return;
});

// POST /api/admin/prilozi/:lekcijaId/embed — dodaj embed vježbu (LearningApps,
// Wordwall, Genially, Quizizz, Kahoot, Padlet, Mentimeter). Prihvata ili
// puni iframe HTML (iz "embed code" dugmeta na tim sajtovima) ili direktan
// URL. Whitelist domena je obavezan zbog sigurnosti — proizvoljan iframe se
// odbija. Embed vježbe NE donose kapi meda (frontend prikazuje napomenu).
const EMBED_WHITELIST = [
  "learningapps.org",
  "wordwall.net",
  "view.genial.ly",
  "genial.ly",
  "quizizz.com",
  "kahoot.it",
  "kahoot.com",
  "padlet.com",
  "mentimeter.com",
  "embed.mentimeter.com",
  "h5p.org",
];

function extractEmbedSrc(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Ako je čisti URL, vrati ga
  if (/^https?:\/\//i.test(trimmed) && !/<iframe/i.test(trimmed)) {
    return trimmed.length <= 2000 ? trimmed : null;
  }
  // Ako je iframe HTML, izvuci src
  const m = trimmed.match(/<iframe[^>]+src\s*=\s*["']([^"']+)["']/i);
  if (m && m[1]) {
    const src = m[1];
    if (/^https?:\/\//i.test(src) && src.length <= 2000) return src;
  }
  return null;
}

function isWhitelistedHost(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    return EMBED_WHITELIST.some(d => host === d || host.endsWith("." + d));
  } catch {
    return false;
  }
}

// Sadržaj lekcije (contentHtml) smije sadržavati <iframe> SAMO sa whitelist-ovanih
// edukativnih izvora (isti kao embed prilozi) + YouTube. Doc upload vraća čisti
// tekst (bez iframe-a), pa su to jedini legitimni izvori. Ovo zatvara bypass:
// admin/muallim bi kroz HTML-mode editora mogao zalijepiti proizvoljan iframe
// koji se onda prikazuje djeci. Vraća listu nedozvoljenih src-ova (prazna = OK).
const CONTENT_IFRAME_WHITELIST = [
  ...EMBED_WHITELIST,
  "youtube.com",
  "youtube-nocookie.com",
];

function findDisallowedIframeSrcs(html: string): string[] {
  if (!html || typeof html !== "string") return [];
  const bad: string[] = [];
  const iframeRe = /<iframe\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = iframeRe.exec(html)) !== null) {
    const tag = m[0];
    const srcM = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    const src = srcM ? srcM[1] : "";
    let ok = false;
    if (src) {
      try {
        const u = new URL(src);
        if (u.protocol === "https:" || u.protocol === "http:") {
          const host = u.hostname.toLowerCase();
          ok = CONTENT_IFRAME_WHITELIST.some(d => host === d || host.endsWith("." + d));
        }
      } catch {
        ok = false;
      }
    }
    if (!ok) bad.push(src || "(iframe bez src)");
  }
  return bad;
}

// Dozvoljene vrijednosti kapi meda za embed vježbu (admin postavlja).
// 0 = bez nagrade (samo informativna/dekorativna vježba).
// Limit do 10 jer cijela lekcija nosi 30 — embed ne smije nadjačati učenje.
const ALLOWED_EMBED_REWARDS = [0, 3, 5, 10] as const;
function normalizeEmbedReward(input: unknown): number {
  const n = Number(input);
  if (!Number.isFinite(n)) return 0;
  return ALLOWED_EMBED_REWARDS.includes(n as 0 | 3 | 5 | 10) ? n : 0;
}

router.post("/prilozi/:lekcijaId/embed", async (req, res) => {
  try {
    const lekcijaId = parseInt(req.params.lekcijaId);
    if (isNaN(lekcijaId)) return res.status(400).json({ error: "Nevažeći ID lekcije" });
    const { embedCode, label, hasanatReward } = (req.body || {}) as { embedCode?: string; label?: string; hasanatReward?: number };
    if (!embedCode || typeof embedCode !== "string") {
      return res.status(400).json({ error: "Pošalji iframe kod ili URL vježbe" });
    }
    if (embedCode.length > 5000) {
      return res.status(400).json({ error: "Embed kod je predugačak (max 5000 znakova)" });
    }
    const src = extractEmbedSrc(embedCode);
    if (!src) {
      return res.status(400).json({ error: "Ne mogu da pronađem URL u embed kodu. Provjeri da je iframe ispravan." });
    }
    if (!isWhitelistedHost(src)) {
      return res.status(400).json({
        error: "Embed mora biti sa: LearningApps, Wordwall, Genially, Quizizz, Kahoot, Padlet, Mentimeter ili H5P.org. Drugi izvori nisu dozvoljeni."
      });
    }
    const [exists] = await db.select({ id: ilmihalLekcijeTable.id }).from(ilmihalLekcijeTable).where(eq(ilmihalLekcijeTable.id, lekcijaId));
    if (!exists) return res.status(404).json({ error: "Lekcija nije pronađena" });

    let provider = "Embed";
    try {
      const host = new URL(src).hostname.toLowerCase();
      if (host.includes("learningapps")) provider = "LearningApps";
      else if (host.includes("wordwall")) provider = "Wordwall";
      else if (host.includes("genial")) provider = "Genially";
      else if (host.includes("quizizz")) provider = "Quizizz";
      else if (host.includes("kahoot")) provider = "Kahoot";
      else if (host.includes("padlet")) provider = "Padlet";
      else if (host.includes("mentimeter")) provider = "Mentimeter";
      else if (host.includes("h5p.org")) provider = "H5P";
    } catch {}

    const displayName = (label && label.trim()) || `${provider} vježba`;
    const uploaderRole = req.user?.role ?? "muallim";
    const uploaderUserId = req.user?.userId ?? null;
    const [inserted] = await db.insert(prilozi).values({
      lekcijaId,
      originalName: displayName.slice(0, 200),
      storedName: "",
      fileSize: 0,
      mimeType: "text/embed",
      kind: "embed",
      externalUrl: src,
      approved: uploaderRole === "admin",
      uploadedByRole: uploaderRole,
      uploadedByUserId: uploaderUserId,
      hasanatReward: normalizeEmbedReward(hasanatReward),
    }).returning();
    res.json(inserted);
  } catch (e: any) {
    console.error("[POST /prilozi/:lekcijaId/embed] failed:", e?.message);
    res.status(500).json({ error: e.message });
  }
  return;
});

// PUT /api/admin/prilozi/:id — uredi embed prilog (samo admin).
// Trenutno podržava: label (originalName) + hasanatReward + opciono novi
// embedCode (URL ili iframe — prolazi kroz isti extractEmbedSrc + whitelist).
// Ostali tipovi priloga (file/url/h5p) se NE mogu uređivati ovim endpointom —
// fajl bi zahtijevao re-upload, URL bi mogao biti dodan kasnije.
router.put("/prilozi/:id", async (req, res) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Samo admin može uređivati materijale" });
  }
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Nevažeći ID" });
    const [existing] = await db.select().from(prilozi).where(eq(prilozi.id, id));
    if (!existing) return res.status(404).json({ error: "Prilog nije pronađen" });
    if (existing.kind !== "embed") {
      return res.status(400).json({ error: "Trenutno se može uređivati samo embed vježba" });
    }

    const { label, hasanatReward, embedCode } = (req.body || {}) as {
      label?: string;
      hasanatReward?: number;
      embedCode?: string;
    };
    const updates: Partial<typeof prilozi.$inferInsert> = {};

    if (typeof label === "string") {
      const trimmed = label.trim();
      if (!trimmed) return res.status(400).json({ error: "Naziv ne može biti prazan" });
      updates.originalName = trimmed.slice(0, 200);
    }
    if (hasanatReward !== undefined) {
      updates.hasanatReward = normalizeEmbedReward(hasanatReward);
    }
    if (typeof embedCode === "string" && embedCode.trim()) {
      if (embedCode.length > 5000) {
        return res.status(400).json({ error: "Embed kod je predugačak (max 5000 znakova)" });
      }
      const src = extractEmbedSrc(embedCode);
      if (!src) return res.status(400).json({ error: "Ne mogu da pronađem URL u embed kodu" });
      if (!isWhitelistedHost(src)) {
        return res.status(400).json({
          error: "Embed mora biti sa: LearningApps, Wordwall, Genially, Quizizz, Kahoot, Padlet, Mentimeter ili H5P.org."
        });
      }
      updates.externalUrl = src;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "Nema promjena" });
    }

    const [updated] = await db.update(prilozi).set(updates).where(eq(prilozi.id, id)).returning();
    res.json(updated);
  } catch (e: any) {
    console.error("[PUT /prilozi/:id] failed:", e?.message);
    res.status(500).json({ error: e.message });
  }
  return;
});

router.get("/prilozi/:lekcijaId", async (req, res) => {
  try {
    const lekcijaId = parseInt(req.params.lekcijaId);
    const files = await db.select().from(prilozi).where(eq(prilozi.lekcijaId, lekcijaId)).orderBy(desc(prilozi.createdAt));
    res.json(files.map(f => ({
      ...f,
      url: f.kind === "url" ? (f.externalUrl || "") : `/uploads/${f.storedName}`,
    })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/prilozi/download/:id — zahtijeva Authorization: Bearer <token>
router.get("/prilozi/download/:id", async (req, res) => {
  try {
    const JWT_SECRET_DL = process.env.JWT_SECRET || "mekteb-secret-change-in-production";
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Neautorizovan pristup" });
    }
    const rawToken = authHeader.slice(7);
    const jwt = await import("jsonwebtoken");
    let decoded: any;
    try {
      decoded = jwt.default.verify(rawToken, JWT_SECRET_DL);
    } catch {
      return res.status(401).json({ error: "Nevažeći token" });
    }
    if (decoded.role !== "admin" && decoded.role !== "muallim") {
      return res.status(403).json({ error: "Samo muallimi i admini mogu preuzimati materijale" });
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Nevažeći ID" });
    const [file] = await db.select().from(prilozi).where(eq(prilozi.id, id));
    if (!file) return res.status(404).json({ error: "Prilog nije pronađen" });
    const filePath = path.join(uploadsDir, file.storedName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Fajl nije pronađen na serveru" });
    const stat = fs.statSync(filePath);
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
    res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
    res.setHeader("Cache-Control", "private, no-cache");
    fs.createReadStream(filePath).pipe(res);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
  return;
});

// GET /api/admin/pending-prilozi — lista fajlova koji čekaju odobrenje (samo admin)
router.get("/pending-prilozi", async (req, res) => {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Samo admin" });
  try {
    // LEFT JOIN ilmihal_lekcije da admin vidi naslov + slug lekcije, ne samo
    // ID. LEFT (a ne INNER) za slučaj da je lekcija u međuvremenu obrisana —
    // pending prilog se i dalje treba moći pregledati i odbiti.
    const pending = await db.select({
      id: prilozi.id,
      lekcijaId: prilozi.lekcijaId,
      lekcijaNaslov: ilmihalLekcijeTable.naslov,
      lekcijaSlug: ilmihalLekcijeTable.slug,
      lekcijaNivo: ilmihalLekcijeTable.nivo,
      originalName: prilozi.originalName,
      storedName: prilozi.storedName,
      fileSize: prilozi.fileSize,
      mimeType: prilozi.mimeType,
      kind: prilozi.kind,
      externalUrl: prilozi.externalUrl,
      uploadedByRole: prilozi.uploadedByRole,
      createdAt: prilozi.createdAt,
    })
      .from(prilozi)
      .leftJoin(ilmihalLekcijeTable, eq(ilmihalLekcijeTable.id, prilozi.lekcijaId))
      .where(eq(prilozi.approved, false))
      .orderBy(desc(prilozi.createdAt));
    res.json(pending);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
  return;
});

// PUT /api/admin/prilozi/:id/approve — odobri ili odbij prilog
router.put("/prilozi/:id/approve", async (req, res) => {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Samo admin" });
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Nevažeći ID" });
    const { approve } = (req.body || {}) as { approve?: boolean };
    if (typeof approve !== "boolean") return res.status(400).json({ error: "Nedostaje 'approve' boolean" });
    if (approve) {
      const [updated] = await db.update(prilozi).set({ approved: true }).where(eq(prilozi.id, id)).returning();
      if (!updated) return res.status(404).json({ error: "Prilog nije pronađen" });
      res.json(updated);
    } else {
      // Odbij = obriši prilog
      const [file] = await db.select().from(prilozi).where(eq(prilozi.id, id));
      if (!file) return res.status(404).json({ error: "Prilog nije pronađen" });
      if (file.kind !== "url" && file.storedName && file.storedName !== "h5p/pending") {
        const fp = path.join(uploadsDir, file.storedName);
        try { if (fs.existsSync(fp)) { if (file.kind === "h5p") fs.rmSync(fp, { recursive: true, force: true }); else fs.unlinkSync(fp); } } catch {}
      }
      await db.delete(prilozi).where(eq(prilozi.id, id));
      res.json({ ok: true, deleted: true });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
  return;
});

// H5P upload: prima .h5p (zip) fajl, otpakira u uploads/h5p/<id>/.
// Validira osnovnu strukturu (mora postojati h5p.json).
const h5pUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.h5p$/i.test(path.extname(file.originalname))) cb(null, true);
    else cb(new Error("Dozvoljeni su samo .h5p fajlovi"));
  },
});

// Lista content type-ova koji puca u našem h5p-standalone player-u (bez Drupal/Moodle
// runtime-a). Ako h5p.json (mainLibrary ili preloadedDependencies) referencira jednu
// od ovih biblioteka, upload odbacujemo da muallim ne snimi vježbu koja kasnije puca
// na učeničkom uređaju.
const UNSUPPORTED_H5P_LIBRARIES = new Set<string>([
  "H5P.FindTheWords",
  "H5P.Crossword",
  "H5P.BranchingScenario",
]);

interface H5PDependency {
  machineName: string;
  majorVersion: number;
  minorVersion: number;
}

/**
 * Validira otpakirani H5P paket protiv naše playera:
 *   1) h5p.json je validan JSON sa preloadedDependencies array-om
 *   2) Nijedna referencirana biblioteka nije na crnoj listi nepodržanih content type-ova
 *   3) Svaka biblioteka iz preloadedDependencies ima odgovarajući folder
 *      `<machineName>-<major>.<minor>` u root-u arhive
 *
 * Baca Error sa porukom prilagođenom muallimu (Bosnian) na prvi neuspjeh.
 */
function validateH5PPackage(extractDir: string): void {
  const manifestPath = path.join(extractDir, "h5p.json");
  let manifest: { mainLibrary?: string; preloadedDependencies?: H5PDependency[] };
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  } catch {
    throw new Error("Nevažeća H5P arhiva: h5p.json nije ispravan JSON");
  }

  const deps = Array.isArray(manifest.preloadedDependencies) ? manifest.preloadedDependencies : [];
  if (deps.length === 0) {
    throw new Error("Nevažeća H5P arhiva: h5p.json nema preloadedDependencies");
  }

  // 1) Crna lista poznato problemskih content type-ova (mainLibrary + sve deps).
  const referencedNames = new Set<string>(deps.map(d => d?.machineName).filter(Boolean) as string[]);
  if (typeof manifest.mainLibrary === "string") referencedNames.add(manifest.mainLibrary);
  for (const name of referencedNames) {
    if (UNSUPPORTED_H5P_LIBRARIES.has(name)) {
      throw new Error("Ovaj tip vježbe nije podržan, pogledaj listu preporučenih");
    }
  }

  // 2) Svaka deklarisana biblioteka mora imati svoj folder u arhivi.
  for (const dep of deps) {
    if (
      !dep ||
      typeof dep.machineName !== "string" ||
      typeof dep.majorVersion !== "number" ||
      typeof dep.minorVersion !== "number"
    ) {
      throw new Error("Nevažeća H5P arhiva: neispravan format preloadedDependencies");
    }
    const folderName = `${dep.machineName}-${dep.majorVersion}.${dep.minorVersion}`;
    const libDir = path.join(extractDir, folderName);
    if (!fs.existsSync(libDir) || !fs.statSync(libDir).isDirectory()) {
      throw new Error(`Nevažeća H5P arhiva: nedostaje biblioteka ${folderName}`);
    }
    // Provjeri library.json (ako postoji) — verzija u njemu mora odgovarati manifestu.
    // H5P spec garantuje library.json u svakoj biblioteci; ako fali, paket je pokvaren.
    const libJsonPath = path.join(libDir, "library.json");
    if (!fs.existsSync(libJsonPath)) {
      throw new Error(`Nevažeća H5P arhiva: nedostaje library.json u ${folderName}`);
    }
    let libJson: { majorVersion?: number; minorVersion?: number };
    try {
      libJson = JSON.parse(fs.readFileSync(libJsonPath, "utf-8"));
    } catch {
      throw new Error(`Nevažeća H5P arhiva: neispravan library.json u ${folderName}`);
    }
    if (libJson.majorVersion !== dep.majorVersion || libJson.minorVersion !== dep.minorVersion) {
      throw new Error(
        `Nevažeća H5P arhiva: verzija biblioteke ${dep.machineName} ne odgovara ` +
        `(manifest: ${dep.majorVersion}.${dep.minorVersion}, library.json: ${libJson.majorVersion}.${libJson.minorVersion})`
      );
    }
  }
}

router.post("/prilozi/:lekcijaId/h5p", (req, res) => {
  h5pUpload.single("file")(req, res, async (err) => {
    if (err) {
      // 413 Payload Too Large kad je multer odbio zbog veličine, 400 inače.
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "H5P fajl prevelik (max 50MB)" });
      }
      const msg = err instanceof multer.MulterError ? err.message : (err.message || "Greška pri uploadu");
      return res.status(400).json({ error: msg });
    }
    if (!req.file) return res.status(400).json({ error: "Nema fajla" });

    const tmpZipPath = req.file.path;
    let extractDir: string | null = null;
    let inserted: any = null;

    try {
      const lekcijaId = parseInt(req.params.lekcijaId);
      if (isNaN(lekcijaId)) return res.status(400).json({ error: "Nevažeći ID lekcije" });
      const [exists] = await db.select({ id: ilmihalLekcijeTable.id }).from(ilmihalLekcijeTable).where(eq(ilmihalLekcijeTable.id, lekcijaId));
      if (!exists) return res.status(404).json({ error: "Lekcija nije pronađena" });

      // 1. Insert prazan h5p prilog (placeholder) da dobijemo ID za direktorij
      const h5pUploaderRole = req.user?.role ?? "muallim";
      const h5pUploaderUserId = req.user?.userId ?? null;
      const [pre] = await db.insert(prilozi).values({
        lekcijaId,
        originalName: req.file.originalname,
        storedName: "h5p/pending",
        fileSize: req.file.size,
        mimeType: "application/x-h5p",
        kind: "h5p",
        approved: h5pUploaderRole === "admin",
        uploadedByRole: h5pUploaderRole,
        uploadedByUserId: h5pUploaderUserId,
      }).returning();
      inserted = pre;

      // 2. Otpakiraj zip u uploads/h5p/<id>/
      const h5pBaseDir = path.join(uploadsDir, "h5p");
      if (!fs.existsSync(h5pBaseDir)) fs.mkdirSync(h5pBaseDir, { recursive: true });
      extractDir = path.join(h5pBaseDir, String(inserted.id));
      if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
      fs.mkdirSync(extractDir, { recursive: true });

      const AdmZip = (await import("adm-zip")).default;
      const zip = new AdmZip(tmpZipPath);
      // Sigurnosna provjera: zabrani path traversal (entry imena sa .. ili apsolutnim path-om)
      for (const entry of zip.getEntries()) {
        const name = entry.entryName;
        if (name.includes("..") || path.isAbsolute(name) || name.startsWith("/")) {
          throw new Error(`Sumnjiv path u .h5p arhivi: ${name}`);
        }
      }
      zip.extractAllTo(extractDir, true);

      // 3. Validacija H5P arhive po H5P specifikaciji:
      //    - h5p.json (manifest sa libraries) MORA postojati u root-u
      //    - content/content.json (parametri konkretnog content-a) MORA postojati
      const manifestPath = path.join(extractDir, "h5p.json");
      if (!fs.existsSync(manifestPath)) {
        throw new Error("Nevažeća H5P arhiva: nedostaje h5p.json u root-u");
      }
      const contentJsonPath = path.join(extractDir, "content", "content.json");
      if (!fs.existsSync(contentJsonPath)) {
        throw new Error("Nevažeća H5P arhiva: nedostaje content/content.json");
      }

      // 3b. Stroga validacija: sve preloadedDependencies moraju imati svoje
      //     library foldere unutar arhive, i nijedna referencirana biblioteka
      //     ne smije biti na crnoj listi nepodržanih content type-ova.
      //     Ovo radimo PRIJE update-a storedName-a tako da nevalidan paket
      //     bude očišćen u catch bloku ispod (rmSync(extractDir) + delete row).
      validateH5PPackage(extractDir);

      // 4. Update storedName na finalni put
      const storedRel = `h5p/${inserted.id}`;
      const [final] = await db.update(prilozi)
        .set({ storedName: storedRel })
        .where(eq(prilozi.id, inserted.id))
        .returning();

      // 5. Brisanje tmp .h5p zip-a (otpakirani sadržaj je dovoljan)
      try { fs.unlinkSync(tmpZipPath); } catch {}

      res.json(final);
    } catch (e: any) {
      // Cleanup u slučaju greške
      try { if (fs.existsSync(tmpZipPath)) fs.unlinkSync(tmpZipPath); } catch {}
      try { if (extractDir && fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true }); } catch {}
      if (inserted?.id) {
        try { await db.delete(prilozi).where(eq(prilozi.id, inserted.id)); } catch {}
      }
      res.status(400).json({ error: e.message || "Greška pri obradi H5P arhive" });
    }
    return;
  });
});

router.delete("/prilozi/:id", async (req, res) => {
  try {
    // Brisanje materijala (fajl, URL link, embed vježba, H5P) je admin-only.
    // Muallim smije dodavati i odobravati priloge, ali NE smije ih brisati —
    // tako se sprječava nehotično ili namjerno gubljenje sadržaja koji je već
    // postavljen na lekciji.
    const role = (req as unknown as { user?: { role?: string } }).user?.role;
    if (role !== "admin") {
      return res.status(403).json({ error: "Samo admin može brisati materijale" });
    }
    const id = parseInt(req.params.id);
    const [file] = await db.select().from(prilozi).where(eq(prilozi.id, id));
    if (!file) return res.status(404).json({ error: "Prilog nije pronađen" });
    if (file.kind === "h5p" && file.storedName) {
      // H5P: storedName je direktorij (h5p/<id>) — rekurzivni rmSync
      const dirPath = path.join(uploadsDir, file.storedName);
      if (fs.existsSync(dirPath)) {
        try { fs.rmSync(dirPath, { recursive: true, force: true }); } catch {}
      }
    } else if (file.kind !== "url" && file.storedName) {
      const filePath = path.join(uploadsDir, file.storedName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await db.delete(prilozi).where(eq(prilozi.id, id));
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
  return;
});

router.get("/uploads", (_req, res) => {
  try {
    if (!fs.existsSync(uploadsDir)) return res.json([]);
    const files = fs.readdirSync(uploadsDir)
      .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
      .map(f => {
        const stat = fs.statSync(path.join(uploadsDir, f));
        return { name: f, url: `/uploads/${f}`, size: stat.size, modified: stat.mtime };
      })
      .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
    res.json(files);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
  return;
});

// GET /api/admin/uploads-audio — već uploadovani audio fajlovi (za ponovnu
// upotrebu u drugim lekcijama bez ponovnog uploada).
router.get("/uploads-audio", (_req, res) => {
  try {
    if (!fs.existsSync(uploadsDir)) return res.json([]);
    const files = fs.readdirSync(uploadsDir)
      .filter(f => /\.(mp3|m4a|aac|ogg|oga|opus|wav|webm)$/i.test(f))
      .map(f => {
        const stat = fs.statSync(path.join(uploadsDir, f));
        return { name: f, url: `/uploads/${f}`, size: stat.size, modified: stat.mtime };
      })
      .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
    res.json(files);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
  return;
});

// GET /api/admin/orphan-uploads — slike koje postoje na disku ali NE postoje
// kao /uploads/<name> referenca u contentHtml-u nijedne lekcije.
// Vraća { orphans: [...], used: [...], lekcije: [...] } da UI može popunjavati dropdown.
router.get("/orphan-uploads", async (_req, res) => {
  try {
    if (!fs.existsSync(uploadsDir)) return res.json({ orphans: [], used: [], lekcije: [] });

    // 1) Sve slike na disku
    const diskFiles = fs.readdirSync(uploadsDir)
      .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));
    const diskSet = new Set(diskFiles);

    // 2) Sve lekcije + skup korištenih /uploads/<name> referenci
    const lessons = await db.select({
      id: ilmihalLekcijeTable.id,
      slug: ilmihalLekcijeTable.slug,
      naslov: ilmihalLekcijeTable.naslov,
      nivo: ilmihalLekcijeTable.nivo,
      contentHtml: ilmihalLekcijeTable.contentHtml,
    }).from(ilmihalLekcijeTable).orderBy(asc(ilmihalLekcijeTable.nivo), asc(ilmihalLekcijeTable.redoslijed));

    const usedSet = new Set<string>();
    for (const l of lessons) {
      const html = l.contentHtml || "";
      const matches = html.matchAll(/\/uploads\/([^\s"'<>?#]+)/g);
      for (const m of matches) usedSet.add(m[1]);
    }

    const orphans = diskFiles
      .filter(f => !usedSet.has(f))
      .map(f => {
        const stat = fs.statSync(path.join(uploadsDir, f));
        return { name: f, url: `/uploads/${f}`, size: stat.size, modified: stat.mtime };
      })
      .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());

    const used = Array.from(usedSet)
      .filter(f => diskSet.has(f))
      .map(f => ({ name: f, url: `/uploads/${f}` }));

    const missing = Array.from(usedSet).filter(f => !diskSet.has(f));

    res.json({
      orphans,
      used,
      missing,
      lekcije: lessons.map(l => ({ id: l.id, slug: l.slug, naslov: l.naslov, nivo: l.nivo })),
      stats: { diskCount: diskFiles.length, usedCount: usedSet.size, orphanCount: orphans.length, missingCount: missing.length },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
  return;
});

// Per-lekcija in-memory mutex da se izbjegnu izgubljeni insert-i pri paralelnim zahtjevima
const insertLocks = new Map<number, Promise<unknown>>();
async function withLekcijaLock<T>(id: number, fn: () => Promise<T>): Promise<T> {
  const prev = insertLocks.get(id) || Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>(r => { release = r; });
  const chained = prev.then(() => next);
  insertLocks.set(id, chained);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    // Brišemo entry samo ako niko drugi nije već postavio sljedeći lanac.
    if (insertLocks.get(id) === chained) insertLocks.delete(id);
  }
}

// Find balanced </div> for a <div ...> opening tag at position openEnd
// (openEnd = index right AFTER the opening tag). Returns index of matching
// </div>, or -1 if not found. Skips nested divs.
function findMatchingDivClose(html: string, openEnd: number): number {
  const tagRe = /<\/?div\b[^>]*>/gi;
  tagRe.lastIndex = openEnd;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html)) !== null) {
    if (m[0].toLowerCase().startsWith("</")) {
      depth--;
      if (depth === 0) return m.index;
    } else {
      depth++;
    }
  }
  return -1;
}

// Find every <div ... class="...lesson-content..."> block. Returns inner
// content boundaries [contentStart, contentEnd) so callers can prepend or
// append inside the div.
function findLessonContentBlocks(html: string): Array<{ contentStart: number; contentEnd: number }> {
  const out: Array<{ contentStart: number; contentEnd: number }> = [];
  // Podržava double i single quotes oko class atributa
  const openRe = /<div\b[^>]*\bclass\s*=\s*(?:"[^"]*\blesson-content\b[^"]*"|'[^']*\blesson-content\b[^']*')[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(html)) !== null) {
    const openEnd = m.index + m[0].length;
    const closeStart = findMatchingDivClose(html, openEnd);
    if (closeStart === -1) continue;
    out.push({ contentStart: openEnd, contentEnd: closeStart });
    openRe.lastIndex = closeStart;
  }
  return out;
}

// POST /api/admin/lekcije/:id/insert-image
// body: { filename: string, mode?: "section-top" | "section-bottom" | "hero",
//         position?: "top" | "bottom" (legacy alias) }
// Ubacuje sliku u contentHtml lekcije pazeći na strukturu .lesson-accordion /
// .lesson-content / .hero-box, jer renderer prikazuje samo te dijelove.
router.post("/lekcije/:id/insert-image", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Nevažeći ID lekcije" });
    const body = (req.body || {}) as {
      filename?: string;
      mode?: "section-top" | "section-bottom" | "hero";
      position?: "top" | "bottom";
    };
    const filename = body.filename;
    if (!filename || typeof filename !== "string") return res.status(400).json({ error: "Nedostaje filename" });
    if (filename.includes("/") || filename.includes("..")) return res.status(400).json({ error: "Nevažeći filename" });
    if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(filename)) return res.status(400).json({ error: "Dozvoljene su samo slike" });
    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Fajl ne postoji na disku" });

    let mode: "section-top" | "section-bottom" | "hero" = body.mode || "section-top";
    if (!body.mode && body.position === "bottom") mode = "section-bottom";
    if (!body.mode && body.position === "top") mode = "section-top";
    if (mode !== "section-top" && mode !== "section-bottom" && mode !== "hero") {
      return res.status(400).json({ error: "Nevažeći mode" });
    }

    const result = await withLekcijaLock(id, async () => {
      const [lekcija] = await db.select().from(ilmihalLekcijeTable).where(eq(ilmihalLekcijeTable.id, id));
      if (!lekcija) return { status: 404 as const, body: { error: "Lekcija nije pronađena" } };

      const url = `/uploads/${filename}`;
      const currentHtml = lekcija.contentHtml || "";
      if (currentHtml.includes(url)) {
        return { status: 200 as const, body: { ok: true, alreadyPresent: true, mode, lekcija: { id, slug: lekcija.slug } } };
      }

      const altText = (lekcija.naslov || "").replace(/"/g, "&quot;");
      // Init na currentHtml samo radi TS control-flow analize (flag `replaced`
      // je van njenog dometa); svaka grana ispod ionako dodjeljuje vrijednost.
      let newHtml: string = currentHtml;

      if (mode === "hero") {
        // Replace existing .hero-box img src, or insert a new .hero-box at the
        // top of the lesson container. Tolerantno na single/double quote i
        // proizvoljan poredak atributa na <div> i <img>.
        const heroOpenRe = /<div\b[^>]*\bclass\s*=\s*(?:"[^"]*\bhero-box\b[^"]*"|'[^']*\bhero-box\b[^']*')[^>]*>/i;
        const heroOpenMatch = currentHtml.match(heroOpenRe);
        let replaced = false;
        if (heroOpenMatch && heroOpenMatch.index !== undefined) {
          const heroOpenEnd = heroOpenMatch.index + heroOpenMatch[0].length;
          const heroCloseStart = findMatchingDivClose(currentHtml, heroOpenEnd);
          if (heroCloseStart !== -1) {
            const heroInner = currentHtml.slice(heroOpenEnd, heroCloseStart);
            const imgSrcRe = /(<img\b[^>]*?\bsrc\s*=\s*)(?:"[^"]*"|'[^']*')/i;
            let newInner: string;
            if (imgSrcRe.test(heroInner)) {
              newInner = heroInner.replace(imgSrcRe, (_full, p1) => `${p1}"${url}"`);
            } else {
              newInner = `<img src="${url}" alt="${altText}">${heroInner}`;
            }
            newHtml =
              currentHtml.slice(0, heroOpenEnd) + newInner + currentHtml.slice(heroCloseStart);
            replaced = true;
          }
        }
        if (!replaced) {
          const heroDiv = `<div class="hero-box"><img src="${url}" alt="${altText}"></div>`;
          const h1Match = currentHtml.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/i);
          if (h1Match && h1Match.index !== undefined) {
            const insertAt = h1Match.index + h1Match[0].length;
            newHtml = currentHtml.slice(0, insertAt) + `\n    ${heroDiv}` + currentHtml.slice(insertAt);
          } else {
            newHtml = `${heroDiv}\n${currentHtml}`;
          }
        }
      } else {
        const blocks = findLessonContentBlocks(currentHtml);
        const imgTag = `<p><img src="${url}" alt="${altText}" style="max-width:100%;height:auto;border-radius:8px;" /></p>`;

        if (blocks.length === 0) {
          // No accordion sections — fall back to plain prepend/append.
          newHtml = mode === "section-bottom" ? `${currentHtml}\n${imgTag}` : `${imgTag}\n${currentHtml}`;
        } else if (mode === "section-top") {
          const target = blocks[0];
          newHtml =
            currentHtml.slice(0, target.contentStart) +
            imgTag +
            currentHtml.slice(target.contentStart, target.contentEnd) +
            currentHtml.slice(target.contentEnd);
        } else {
          const target = blocks[blocks.length - 1];
          newHtml =
            currentHtml.slice(0, target.contentEnd) +
            imgTag +
            currentHtml.slice(target.contentEnd);
        }
      }

      await db.update(ilmihalLekcijeTable)
        .set({ contentHtml: newHtml })
        .where(eq(ilmihalLekcijeTable.id, id));

      return { status: 200 as const, body: { ok: true, alreadyPresent: false, mode, lekcija: { id, slug: lekcija.slug, naslov: lekcija.naslov } } };
    });
    res.status(result.status).json(result.body);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
  return;
});

// GET /api/admin/korisnici
router.get("/korisnici", async (req, res) => {
  try {
    const korisnici = await db.select({
      id: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      email: usersTable.email,
      role: usersTable.role,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
      lastLoginAt: usersTable.lastLoginAt,
      lastSeenAt: usersTable.lastSeenAt,
      totalScreentimeSec: usersTable.totalScreentimeSec,
      trialUntil: usersTable.trialUntil,
    }).from(usersTable);
    res.json(korisnici);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/admin/statistike
router.get("/statistike", async (req, res) => {
  try {
    const sviKorisnici = await db.select({ role: usersTable.role }).from(usersTable);
    const counts = sviKorisnici.reduce((acc: Record<string, number>, u) => {
      acc[u.role] = (acc[u.role] || 0) + 1;
      return acc;
    }, {});

    const mektebi = await db.select().from(mektebiTable);
    const pretplate = await db.select().from(pretplateTable);

    res.json({
      korisnici: counts,
      ukupnoKorisnika: sviKorisnici.length,
      ukupnoMekteba: mektebi.length,
      aktivnePretplate: pretplate.filter(p => p.status === "active").length,
    });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/admin/muallim - create muallim account
router.post("/muallim", async (req, res) => {
  try {
    const { username, password, displayName, email, licenceCount, mektebId } = req.body;

    const exists = await db.select().from(usersTable).where(eq(usersTable.username, username.trim().toLowerCase()));
    if (exists.length > 0) {
      res.status(409).json({ error: "Korisničko ime zauzeto" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [newUser] = await db.insert(usersTable).values({
      username: username.trim().toLowerCase(),
      email: email || null,
      passwordHash,
      displayName: displayName.trim(),
      role: "muallim",
    }).returning();

    await db.insert(muallimProfiliTable).values({
      userId: newUser.id,
      mektebId: mektebId || null,
      licenceCount: licenceCount || 30,
      licencesUsed: 0,
    });

    res.status(201).json({ ...newUser, passwordHash: undefined });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/admin/muallim-profili - all muallim profiles with licence info
router.get("/muallim-profili", async (req, res) => {
  try {
    const profili = await db.select().from(muallimProfiliTable);
    // dozvoljeni_jezici je residual kolona (raw SQL), pa je dohvaćamo zasebno i
    // spajamo da očuvamo postojeća camelCase polja iz drizzle select-a.
    const jr = (await db.execute(
      sql`SELECT user_id, dozvoljeni_jezici FROM muallim_profili`,
    )) as unknown as { rows: { user_id: number; dozvoljeni_jezici: unknown }[] };
    const jmap = new Map<number, unknown>();
    for (const row of jr.rows) jmap.set(Number(row.user_id), row.dozvoljeni_jezici);
    res.json(profili.map((p) => ({ ...p, dozvoljeniJezici: jmap.get(p.userId) ?? null })));
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/admin/korisnici/:id - update user
router.put("/korisnici/:id", async (req, res) => {
  try {
    const { displayName, email, isActive, role } = req.body;
    const userId = parseInt(req.params.id);

    const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!existing) { res.status(404).json({ error: "Korisnik nije pronađen" }); return; }

    const updates: Record<string, any> = {};
    if (displayName !== undefined) updates.displayName = displayName;
    if (email !== undefined) updates.email = email;
    if (isActive !== undefined) {
      updates.isActive = isActive;
      // Kad admin aktivira nalog (pretplata odobrena), čistimo trial — od sada
      // pristup ovisi isključivo o `isActive` flagu.
      if (isActive === true) updates.trialUntil = null;
    }
    if (role !== undefined) updates.role = role;

    const [updated] = await db.update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, userId))
      .returning();

    if (isActive !== undefined && existing.role === "muallim") {
      const ucenikProfili = await db.select({ userId: ucenikProfiliTable.userId })
        .from(ucenikProfiliTable).where(eq(ucenikProfiliTable.muallimId, userId));
      if (ucenikProfili.length > 0) {
        const ucenikIds = ucenikProfili.map(p => p.userId);
        await db.update(usersTable).set({ isActive }).where(inArray(usersTable.id, ucenikIds));
        for (const id of ucenikIds) invalidateUserStatusCache(id);
      }
    }

    // Cache u requireAuth ima TTL 30s — invalidacija ovdje garantuje
    // trenutnu primjenu deaktivacije/aktivacije bez čekanja.
    invalidateUserStatusCache(userId);

    res.json({ ...updated, passwordHash: undefined });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/admin/muallim/:id/licence - set licence count
router.put("/muallim/:id/licence", async (req, res) => {
  try {
    const { licenceCount } = req.body;
    const count = parseInt(licenceCount);
    if (!count || count < 1 || count > 999) {
      res.status(400).json({ error: "Broj licenci mora biti između 1 i 999" });
      return;
    }
    const [profil] = await db.select().from(muallimProfiliTable).where(eq(muallimProfiliTable.userId, parseInt(req.params.id)));
    if (!profil) { res.status(404).json({ error: "Muallim profil nije pronađen" }); return; }
    if (count < (profil.licencesUsed || 0)) {
      res.status(400).json({ error: `Ne možete staviti manje licenci od iskorištenih (${profil.licencesUsed})` });
      return;
    }
    const [updated] = await db.update(muallimProfiliTable)
      .set({ licenceCount: count })
      .where(eq(muallimProfiliTable.userId, parseInt(req.params.id)))
      .returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/admin/muallim/:id/jezici - postavi dozvoljene jezike za muallima
// (njegovi učenici automatski prate). Bosanski je uvijek uključen.
router.put("/muallim/:id/jezici", async (req, res) => {
  try {
    const SVI = ["bs", "sq", "de", "en", "tr", "ar"];
    const userId = parseInt(req.params.id);
    const raw = (req.body as { jezici?: unknown }).jezici;
    if (!Array.isArray(raw)) { res.status(400).json({ error: "jezici mora biti niz" }); return; }
    let lista = raw.filter((l): l is string => typeof l === "string" && SVI.includes(l));
    if (!lista.includes("bs")) lista = ["bs", ...lista];
    lista = SVI.filter((l) => lista.includes(l));
    const [profil] = await db.select().from(muallimProfiliTable).where(eq(muallimProfiliTable.userId, userId));
    if (!profil) { res.status(404).json({ error: "Muallim profil nije pronađen" }); return; }
    await db.execute(sql`UPDATE muallim_profili SET dozvoljeni_jezici = ${JSON.stringify(lista)}::jsonb WHERE user_id = ${userId}`);
    res.json({ ok: true, jezici: lista });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/admin/muallim/:id/mekteb - dodijeli/promijeni džemat postojećem muallimu
router.put("/muallim/:id/mekteb", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const raw = req.body.mektebId;
    const targetMektebId = raw === null || raw === undefined || raw === "" ? null : parseInt(raw);

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user || user.role !== "muallim") { res.status(404).json({ error: "Muallim nije pronađen" }); return; }

    if (targetMektebId !== null) {
      const [m] = await db.select().from(mektebiTable).where(eq(mektebiTable.id, targetMektebId));
      if (!m) { res.status(404).json({ error: "Džemat nije pronađen" }); return; }
    }

    const [profil] = await db.select().from(muallimProfiliTable).where(eq(muallimProfiliTable.userId, userId));

    // Ako se muallim premješta iz džemata u kojem je bio glavni, skidamo glavni status i pointer.
    if (profil && profil.mektebId && profil.mektebId !== targetMektebId) {
      await db.update(mektebiTable).set({ glavniMuallimId: null })
        .where(and(eq(mektebiTable.id, profil.mektebId), eq(mektebiTable.glavniMuallimId, userId)));
    }

    if (profil) {
      const upd: Record<string, any> = { mektebId: targetMektebId };
      if (profil.mektebId !== targetMektebId && profil.isGlavni) upd.isGlavni = false;
      await db.update(muallimProfiliTable).set(upd).where(eq(muallimProfiliTable.userId, userId));
    } else {
      await db.insert(muallimProfiliTable).values({ userId, mektebId: targetMektebId });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/admin/muallim/:id/glavni - proglasi/skini glavnog muallima
router.put("/muallim/:id/glavni", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const isGlavni = req.body.isGlavni === true;

    const [profil] = await db.select().from(muallimProfiliTable).where(eq(muallimProfiliTable.userId, userId));
    if (!profil) { res.status(404).json({ error: "Muallim profil nije pronađen" }); return; }

    if (isGlavni) {
      if (!profil.mektebId) { res.status(400).json({ error: "Muallim prvo mora biti dodijeljen džematu." }); return; }
      const mektebId = profil.mektebId;
      // Jedan glavni po džematu: prvo skini status svim ostalima, pa postavi cilj.
      await db.transaction(async (tx) => {
        await tx.update(muallimProfiliTable).set({ isGlavni: false })
          .where(and(eq(muallimProfiliTable.mektebId, mektebId), eq(muallimProfiliTable.isGlavni, true)));
        await tx.update(muallimProfiliTable).set({ isGlavni: true }).where(eq(muallimProfiliTable.userId, userId));
        await tx.update(mektebiTable).set({ glavniMuallimId: userId }).where(eq(mektebiTable.id, mektebId));
      });
    } else {
      await db.update(muallimProfiliTable).set({ isGlavni: false }).where(eq(muallimProfiliTable.userId, userId));
      if (profil.mektebId) {
        await db.update(mektebiTable).set({ glavniMuallimId: null })
          .where(and(eq(mektebiTable.id, profil.mektebId), eq(mektebiTable.glavniMuallimId, userId)));
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/admin/mekteb/:id/dozvoljeno-muallima - povećaj/postavi dozvoljeni broj muallima
router.put("/mekteb/:id/dozvoljeno-muallima", async (req, res) => {
  try {
    const mektebId = parseInt(req.params.id);
    const dozvoljeno = parseInt(req.body.dozvoljenoMuallima);
    if (!dozvoljeno || dozvoljeno < 1 || dozvoljeno > 99) {
      res.status(400).json({ error: "Broj muallima mora biti između 1 i 99" }); return;
    }
    const [m] = await db.select().from(mektebiTable).where(eq(mektebiTable.id, mektebId));
    if (!m) { res.status(404).json({ error: "Džemat nije pronađen" }); return; }

    const postojeci = await db.select({ userId: muallimProfiliTable.userId })
      .from(muallimProfiliTable).where(eq(muallimProfiliTable.mektebId, mektebId));
    if (dozvoljeno < postojeci.length) {
      res.status(400).json({ error: `Već postoji ${postojeci.length} muallima u ovom džematu` }); return;
    }

    await db.update(mektebiTable).set({ dozvoljenoMuallima: dozvoljeno }).where(eq(mektebiTable.id, mektebId));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET/POST /api/admin/mektebi
router.get("/mektebi", async (req, res) => {
  const lista = await db.select().from(mektebiTable);
  res.json(lista);
});

router.post("/mektebi", async (req, res) => {
  try {
    const [novi] = await db.insert(mektebiTable).values(req.body).returning();
    res.status(201).json(novi);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/admin/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    const newHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, userId));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/admin/admin - create admin account
router.post("/admin", async (req, res) => {
  try {
    const { username, password, displayName, email } = req.body;

    const exists = await db.select().from(usersTable).where(eq(usersTable.username, username.trim().toLowerCase()));
    if (exists.length > 0) {
      res.status(409).json({ error: "Korisničko ime zauzeto" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [newUser] = await db.insert(usersTable).values({
      username: username.trim().toLowerCase(),
      email: email || null,
      passwordHash,
      displayName: displayName.trim(),
      role: "admin",
    }).returning();

    res.status(201).json({ ...newUser, passwordHash: undefined });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/admin/ucenik - create student account
router.post("/ucenik", async (req, res) => {
  try {
    const { username, password, displayName, email } = req.body;

    const exists = await db.select().from(usersTable).where(eq(usersTable.username, username.trim().toLowerCase()));
    if (exists.length > 0) {
      res.status(409).json({ error: "Korisničko ime zauzeto" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [newUser] = await db.insert(usersTable).values({
      username: username.trim().toLowerCase(),
      email: email || null,
      passwordHash,
      displayName: displayName.trim(),
      role: "ucenik",
    }).returning();

    await db.insert(ucenikProfiliTable).values({
      userId: newUser.id,
    });

    res.status(201).json({ ...newUser, passwordHash: undefined });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/admin/ilmihal/lista — kompaktna lista svih lekcija za prerequisit picker
// (id, nivo, naslov, redoslijed). Mora biti PRIJE router.put("/ilmihal/:id") da
// Express ne pohvata "lista" kao :id parametar za PUT (različiti HTTP metodi, ali
// radi jasnoće i za buduće GET /:id endpointe).
router.get("/ilmihal/lista", async (req, res) => {
  try {
    const lekcije = await db
      .select({
        id: ilmihalLekcijeTable.id,
        nivo: ilmihalLekcijeTable.nivo,
        naslov: ilmihalLekcijeTable.naslov,
        redoslijed: ilmihalLekcijeTable.redoslijed,
      })
      .from(ilmihalLekcijeTable)
      .orderBy(asc(ilmihalLekcijeTable.nivo), asc(ilmihalLekcijeTable.redoslijed));
    res.json(lekcije);
  } catch (err) {
    res.status(500).json({ error: "Greška pri dohvatu liste lekcija" });
  }
});

router.post("/ilmihal", async (req, res) => {
  try {
    const { naslov, slug, nivo, redoslijed, contentHtml, kvizPitanja } = req.body;
    if (!naslov || !slug) return res.status(400).json({ error: "naslov and slug required" });
    const kviz = kvizPitanja ? (typeof kvizPitanja === "string" ? kvizPitanja : JSON.stringify(kvizPitanja)) : null;
    const [row] = await db.insert(ilmihalLekcijeTable).values({
      naslov, slug, nivo: nivo || 2, redoslijed: redoslijed || 0,
      contentHtml: contentHtml || "", kvizPitanja: kviz as any,
    }).returning({ id: ilmihalLekcijeTable.id });
    res.json({ success: true, id: row.id });
  } catch (err) {
    console.error("POST /ilmihal error:", err);
    res.status(500).json({ error: "Greška pri kreiranju lekcije" });
  }
  return;
});

router.put("/ilmihal/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { contentHtml, naslov, kvizPitanja, redoslijed, forceUnlock, predmet, uvjetiIds } = req.body;
    const [existing] = await db.select().from(ilmihalLekcijeTable).where(eq(ilmihalLekcijeTable.id, id));
    if (!existing) return res.status(404).json({ error: "Lekcija nije pronađena" });
    const updates: Record<string, any> = {};
    if (contentHtml !== undefined) {
      // Sigurnost: odbij snimanje ako sadržaj ima iframe sa nedozvoljenog izvora
      // (zatvara HTML-mode bypass — vidi findDisallowedIframeSrcs).
      const badEmbeds = findDisallowedIframeSrcs(typeof contentHtml === "string" ? contentHtml : "");
      if (badEmbeds.length > 0) {
        return res.status(400).json({
          error: "Sadržaj sadrži nedozvoljen iframe/embed. Dozvoljeni izvori: LearningApps, Wordwall, Genially, Quizizz, Kahoot, Padlet, Mentimeter, H5P.org i YouTube.",
          detail: badEmbeds.slice(0, 3),
        });
      }
      // Auto-clean before save: remove duplicate priprema accordions, upgrade old design.
      const { regeneratePripremaInHtml } = await import("../lib/priprema-render.js");
      updates.contentHtml = regeneratePripremaInHtml(contentHtml);
    }
    if (naslov !== undefined) updates.naslov = naslov;
    if (redoslijed !== undefined) updates.redoslijed = redoslijed;
    if (predmet !== undefined) {
      // Predmet: prazan string → NULL (lekcija "bez predmeta"). Trim, max 60 char.
      const p = typeof predmet === "string" ? predmet.trim() : "";
      updates.predmet = p ? p.slice(0, 60) : null;
    }
    if (kvizPitanja !== undefined) {
      updates.kvizPitanja = typeof kvizPitanja === "string" ? kvizPitanja : JSON.stringify(kvizPitanja);
    }
    if (contentHtml !== undefined) {
      updates.locked = true;
      updates.lockedNote = "Auto-zaključano pri uređivanju";
    }
    if (uvjetiIds !== undefined) {
      // Prihvati samo integer ID-jeve, max 6 preduvjeta.
      const ids = Array.isArray(uvjetiIds)
        ? uvjetiIds.filter((x: unknown) => Number.isInteger(x) && (x as number) > 0).slice(0, 6)
        : [];
      updates.uvjetiIds = ids;
    }
    await db.update(ilmihalLekcijeTable).set(updates).where(eq(ilmihalLekcijeTable.id, id));
    res.json({ success: true });
  } catch (err: any) {
    console.error("PUT /ilmihal/:id error:", err?.message, err?.stack);
    res.status(500).json({ error: "Greška servera", detail: err?.message });
  }
  return;
});

// POST /api/admin/ilmihal/:id/lock — zaključaj lekciju (zaštita od auto-skripti)
router.post("/ilmihal/:id/lock", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const note = (req.body?.note as string) || "OVAJ SADRŽAJ NE DIRAJ NIKADA — ručno verifikovan";
    const [row] = await db.update(ilmihalLekcijeTable)
      .set({ locked: true, lockedAt: new Date(), lockedNote: note })
      .where(eq(ilmihalLekcijeTable.id, id))
      .returning({ id: ilmihalLekcijeTable.id, slug: ilmihalLekcijeTable.slug, locked: ilmihalLekcijeTable.locked });
    if (!row) return res.status(404).json({ error: "Lekcija nije pronađena" });
    res.json({ success: true, ...row });
  } catch (err) {
    res.status(500).json({ error: "Greška pri zaključavanju" });
  }
  return;
});

// POST /api/admin/ilmihal/:id/unlock — otključaj lekciju
router.post("/ilmihal/:id/unlock", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db.update(ilmihalLekcijeTable)
      .set({ locked: false, lockedAt: null, lockedNote: null })
      .where(eq(ilmihalLekcijeTable.id, id))
      .returning({ id: ilmihalLekcijeTable.id, slug: ilmihalLekcijeTable.slug, locked: ilmihalLekcijeTable.locked });
    if (!row) return res.status(404).json({ error: "Lekcija nije pronađena" });
    res.json({ success: true, ...row });
  } catch (err) {
    res.status(500).json({ error: "Greška pri otključavanju" });
  }
  return;
});

// POST /api/admin/ilmihal/lock-by-slug — zaključaj po slug-u (za bulk i CLI)
router.post("/ilmihal/lock-by-slug", async (req, res) => {
  try {
    const { slugs, note } = req.body as { slugs: string[]; note?: string };
    if (!Array.isArray(slugs) || slugs.length === 0) return res.status(400).json({ error: "slugs array required" });
    const lockedNote = note || "OVAJ SADRŽAJ NE DIRAJ NIKADA — ručno verifikovan";
    const result = await db.update(ilmihalLekcijeTable)
      .set({ locked: true, lockedAt: new Date(), lockedNote })
      .where(inArray(ilmihalLekcijeTable.slug, slugs))
      .returning({ slug: ilmihalLekcijeTable.slug });
    res.json({ success: true, locked: result.map(r => r.slug), count: result.length });
  } catch (err) {
    res.status(500).json({ error: "Greška pri bulk zaključavanju" });
  }
  return;
});

// UKLONJENO: restore-from-prod-seed endpoint je obrisan.
// Produkcija je jedini izvor istine — seed fajlovi su obrisani.

// POST /api/admin/ilmihal/regenerate-priprema-design
// Parsira stari dizajn pripreme (table layout) i regeneriše u novi dizajn
// (gradient kartica + 3 obojena cilja). Skipuje zaključane.
router.post("/ilmihal/regenerate-priprema-design", async (req, res) => {
  try {
    const { dryRun, nivo } = (req.body || {}) as { dryRun?: boolean; nivo?: number };
    const { regenerateOldDesignToNew } = await import("./regenerate-priprema-design.js");
    const report = await regenerateOldDesignToNew({
      nivo: typeof nivo === "number" ? nivo : 1,
      dryRun: !!dryRun,
    });
    res.json({ success: true, ...report });
  } catch (err: any) {
    res.status(500).json({ error: "Regenerate failed", detail: err?.message });
  }
});

// UKLONJENO: sync-from-seed i restore-diac endpointi su obrisani jer su
// prepisivali produkcijski content_html sa skraćenim seed podacima.
// Produkcija je jedini izvor istine za sadržaj lekcija.

router.delete("/ilmihal/:id", async (req, res) => {
  try {
    await db.delete(ilmihalLekcijeTable).where(eq(ilmihalLekcijeTable.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

router.post("/ilmihal/delete-batch", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: "ids array required" });
    for (const id of ids) {
      await db.delete(ilmihalLekcijeTable).where(eq(ilmihalLekcijeTable.id, id));
    }
    res.json({ success: true, deleted: ids.length });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
  return;
});

// PUT /api/admin/kvizovi/:id — Update quiz questions/title
router.put("/kvizovi/:id", async (req, res) => {
  try {
    const { pitanja, naslov, isPublished, kategorija, tagovi, lekcijaId, opis, modul, nivo, variant } = req.body;
    const updates: Record<string, any> = {};
    if (pitanja !== undefined) {
      updates.pitanja = typeof pitanja === "string" ? pitanja : JSON.stringify(pitanja);
    }
    if (naslov !== undefined) updates.naslov = naslov;
    if (isPublished !== undefined) updates.isPublished = isPublished;
    if (kategorija !== undefined) updates.kategorija = kategorija || null;
    if (tagovi !== undefined) updates.tagovi = Array.isArray(tagovi) ? tagovi : (tagovi ? [tagovi] : []);
    if (lekcijaId !== undefined) updates.lekcijaId = lekcijaId || null;
    if (opis !== undefined) updates.opis = opis || "";
    if (modul !== undefined) updates.modul = modul;
    if (nivo !== undefined) updates.nivo = nivo;
    if (variant !== undefined) updates.variant = variant;
    await db.update(kvizoviTable).set(updates).where(eq(kvizoviTable.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/admin/kvizovi/ai-import — uvoz kompletnog kviza (AI-generisanog).
// Prima JSON: { naslov, slug, kategorija, tagovi, opis?, pitanja: [...] }.
// Svako pitanje se dedup-uje po tekstu (UNIQUE na pitanja_banka.pitanje). Ako
// pitanje već postoji, koristi se postojeći ID; inaće se kreira u banci.
// Na kraju se kreira kviz i linkuju sva pitanja.
router.post("/kvizovi/ai-import", async (req, res) => {
  try {
    const { naslov, slug, kategorija, tagovi, opis, pitanja } = req.body || {};
    if (!naslov || !slug) { res.status(400).json({ error: "naslov i slug su obavezni" }); return; }
    if (!Array.isArray(pitanja) || pitanja.length === 0) { res.status(400).json({ error: "pitanja mora biti niz sa barem jednim pitanjem" }); return; }

    const userId = (req as any).user?.id;
    const slugClean = String(slug).trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
    if (!slugClean) { res.status(400).json({ error: "Slug mora sadržavati a-z, 0-9 ili _" }); return; }

    const result = await db.transaction(async (tx) => {
      // 1) Kreiraj kviz
      const [kviz] = await tx.insert(kvizoviTable).values({
        naslov: String(naslov).trim(),
        slug: slugClean,
        modul: "ilmihal",
        variant: "normal",
        kategorija: kategorija ? String(kategorija) : null,
        tagovi: Array.isArray(tagovi) ? tagovi.map(String) : [],
        opis: opis ? String(opis) : "",
        isPublished: true,
        pitanja: [],
      }).returning();

      // 2) Pitanja — dedup po tekstu
      const pitanjeIds: number[] = [];
      for (const q of pitanja) {
        const normalized = normalizePitanjeBody(q);
        const err = validatePitanjeData(normalized);
        if (err) {
          // Preskoči nevalidna pitanja i loguj
          console.warn(`[ai-import] Preskočeno pitanje: ${err}`, normalized.pitanje.slice(0, 80));
          continue;
        }
        // Provjeri da li pitanje već postoji
        const [existing] = await tx.select({ id: pitanjaBankaTable.id }).from(pitanjaBankaTable)
          .where(sql`LOWER(TRIM(${pitanjaBankaTable.pitanje})) = LOWER(TRIM(${normalized.pitanje}))`)
          .limit(1);
        let pid: number;
        if (existing) {
          pid = existing.id;
        } else {
          const [created] = await tx.insert(pitanjaBankaTable).values({
            ...normalized,
            createdBy: userId || null,
          }).returning();
          pid = created.id;
        }
        pitanjeIds.push(pid);
      }

      if (pitanjeIds.length === 0) {
        throw new Error("Nijedno validno pitanje nije pronađeno ili kreirano");
      }

      // 3) Linkuj pitanja u kviz
      const values = pitanjeIds.map((pid, i) => ({ kvizId: kviz.id, pitanjeId: pid, redoslijed: i }));
      await tx.insert(kvizPitanjaTable).values(values).onConflictDoNothing();

      return { kvizId: kviz.id, naslov: kviz.naslov, slug: kviz.slug, ukupnoPitanja: pitanjeIds.length };
    });

    res.status(201).json({ success: true, ...result });
  } catch (err: any) {
    if (String(err?.message || "").includes("unique") || String(err?.message || "").includes("violation")) {
      res.status(409).json({ error: "Slug kviza već postoji. Izaberi drugi slug." });
      return;
    }
    console.error("[POST /kvizovi/ai-import]", err);
    res.status(500).json({ error: err?.message || "Greška servera" });
  }
});

// POST /api/admin/kvizovi — Create new (empty) quiz. Pitanja se dodaju
// posebno kroz POST /kvizovi/:id/dodaj-pitanja iz banke.
router.post("/kvizovi", async (req, res) => {
  try {
    const { naslov, slug, modul, nivo, variant, kategorija, tagovi, lekcijaId, opis, isPublished } = req.body || {};
    if (!naslov || !slug) {
      res.status(400).json({ error: "naslov i slug su obavezni" });
      return;
    }
    const [created] = await db.insert(kvizoviTable).values({
      naslov,
      slug,
      modul: modul || "ilmihal",
      nivo: nivo ?? null,
      variant: variant || "normal",
      kategorija: kategorija || null,
      tagovi: Array.isArray(tagovi) ? tagovi : (tagovi ? [tagovi] : []),
      lekcijaId: lekcijaId || null,
      opis: opis || "",
      isPublished: isPublished ?? true,
      pitanja: [],
    }).returning();
    res.status(201).json(created);
  } catch (err: any) {
    if (String(err?.message || "").includes("unique")) {
      res.status(409).json({ error: "Slug već postoji" });
      return;
    }
    console.error("[POST /kvizovi]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// DELETE /api/admin/kvizovi/:id — briše kviz. CASCADE briše kviz_pitanja
// linkove (pitanja u banci ostaju). Rezultati ostaju (snapshot).
router.delete("/kvizovi/:id", async (req, res) => {
  try {
    await db.delete(kvizoviTable).where(eq(kvizoviTable.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE /kvizovi/:id]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// ── KNJIGE / ČITAONICA ─────────────────────────────────────────────────────────
// Admin CRUD za priče u Čitaonici. Public read ide kroz /api/content/knjige.
// Slike (cover + slike u tekstu) se uploaduju kroz već postojeći /api/admin/upload
// koji vraća URL oblika /uploads/<filename>.

// GET /api/admin/knjige — sve knjige (uključujući neobjavljene)
router.get("/knjige", async (_req, res) => {
  try {
    const result = await db.select().from(knjige)
      .orderBy(asc(knjige.redoslijed), asc(knjige.id));
    res.json(result);
  } catch (err) {
    console.error("[GET /admin/knjige]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/admin/knjige/:id — pojedinačna knjiga (za uređivanje)
router.get("/knjige/:id", async (req, res) => {
  try {
    const [k] = await db.select().from(knjige).where(eq(knjige.id, parseInt(req.params.id)));
    if (!k) { res.status(404).json({ error: "Knjiga nije pronađena" }); return; }
    res.json(k);
  } catch (err) {
    console.error("[GET /admin/knjige/:id]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/admin/knjige — kreiraj novu knjigu/priču
router.post("/knjige", async (req, res) => {
  try {
    const { slug, naslov, kategorija, contentHtml, coverImage, redoslijed, isPublished } = req.body || {};
    if (!slug || !naslov) {
      res.status(400).json({ error: "slug i naslov su obavezni" });
      return;
    }
    const [created] = await db.insert(knjige).values({
      slug: String(slug).trim(),
      naslov: String(naslov).trim(),
      kategorija: kategorija || "prica",
      contentHtml: contentHtml || "",
      coverImage: coverImage || null,
      redoslijed: typeof redoslijed === "number" ? redoslijed : 0,
      isPublished: isPublished ?? true,
    }).returning();
    res.status(201).json(created);
  } catch (err: any) {
    if (String(err?.message || "").toLowerCase().includes("unique")) {
      res.status(409).json({ error: "Slug već postoji — odaberi drugi" });
      return;
    }
    console.error("[POST /admin/knjige]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/admin/knjige/:id — izmijeni postojeću knjigu
router.put("/knjige/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Neispravan id" }); return; }
    const { slug, naslov, kategorija, contentHtml, coverImage, redoslijed, isPublished } = req.body || {};
    const updates: Record<string, unknown> = {};
    if (slug !== undefined) updates["slug"] = String(slug).trim();
    if (naslov !== undefined) updates["naslov"] = String(naslov).trim();
    if (kategorija !== undefined) updates["kategorija"] = kategorija || "prica";
    if (contentHtml !== undefined) updates["contentHtml"] = contentHtml || "";
    if (coverImage !== undefined) updates["coverImage"] = coverImage || null;
    if (redoslijed !== undefined) updates["redoslijed"] = typeof redoslijed === "number" ? redoslijed : 0;
    if (isPublished !== undefined) updates["isPublished"] = !!isPublished;
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "Nema izmjena" });
      return;
    }
    await db.update(knjige).set(updates).where(eq(knjige.id, id));
    const [updated] = await db.select().from(knjige).where(eq(knjige.id, id));
    res.json(updated);
  } catch (err: any) {
    if (String(err?.message || "").toLowerCase().includes("unique")) {
      res.status(409).json({ error: "Slug već postoji — odaberi drugi" });
      return;
    }
    console.error("[PUT /admin/knjige/:id]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// DELETE /api/admin/knjige/:id — obriši knjigu
router.delete("/knjige/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Neispravan id" }); return; }
    await db.delete(knjige).where(eq(knjige.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE /admin/knjige/:id]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// ── KATEGORIJE ČITAONICE ───────────────────────────────────────────────────────
// Admin-definisane grupe priča. Slug se koristi kao referenca iz `knjige.kategorija`.
// Brisanje kategorije NE briše priče u njoj — one postaju "Bez kategorije" na frontendu.

// GET /api/admin/kategorije-knjiga — sve kategorije + broj priča u svakoj
router.get("/kategorije-knjiga", async (_req, res) => {
  try {
    const kategorije = await db.select().from(kategorijeKnjigeTable)
      .orderBy(asc(kategorijeKnjigeTable.redoslijed), asc(kategorijeKnjigeTable.id));
    // Brojanje priča po kategoriji (uključujući neobjavljene — admin treba da vidi sve)
    const counts = await db
      .select({ kategorija: knjige.kategorija, broj: sql<number>`count(*)::int` })
      .from(knjige)
      .groupBy(knjige.kategorija);
    const countMap = new Map(counts.map(c => [c.kategorija, c.broj]));
    res.json(kategorije.map(k => ({ ...k, brojPrica: countMap.get(k.slug) ?? 0 })));
  } catch (err) {
    console.error("[GET /admin/kategorije-knjiga]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/admin/kategorije-knjiga — kreiraj novu kategoriju
router.post("/kategorije-knjiga", async (req, res) => {
  try {
    const { slug, naziv, opis, redoslijed, defaultOpen } = req.body || {};
    if (!slug || !naziv) { res.status(400).json({ error: "slug i naziv su obavezni" }); return; }
    const [created] = await db.insert(kategorijeKnjigeTable).values({
      slug: String(slug).trim(),
      naziv: String(naziv).trim(),
      opis: opis ? String(opis).trim() : null,
      redoslijed: typeof redoslijed === "number" ? redoslijed : 100,
      defaultOpen: !!defaultOpen,
    }).returning();
    res.status(201).json(created);
  } catch (err: any) {
    if (String(err?.message || "").toLowerCase().includes("unique")) {
      res.status(409).json({ error: "Slug kategorije već postoji" });
      return;
    }
    console.error("[POST /admin/kategorije-knjiga]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/admin/kategorije-knjiga/:id — izmijeni kategoriju.
// Ako se mijenja `slug`, automatski ažurira `knjige.kategorija` u svim pričama
// koje su trenutno u toj kategoriji (transakcija).
router.put("/kategorije-knjiga/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Neispravan id" }); return; }
    const { slug, naziv, opis, redoslijed, defaultOpen } = req.body || {};
    const [existing] = await db.select().from(kategorijeKnjigeTable).where(eq(kategorijeKnjigeTable.id, id));
    if (!existing) { res.status(404).json({ error: "Kategorija nije pronađena" }); return; }

    const updates: Record<string, unknown> = {};
    if (slug !== undefined) updates["slug"] = String(slug).trim();
    if (naziv !== undefined) updates["naziv"] = String(naziv).trim();
    if (opis !== undefined) updates["opis"] = opis ? String(opis).trim() : null;
    if (redoslijed !== undefined) updates["redoslijed"] = typeof redoslijed === "number" ? redoslijed : 100;
    if (defaultOpen !== undefined) updates["defaultOpen"] = !!defaultOpen;
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nema izmjena" }); return; }

    const newSlug = (updates["slug"] as string | undefined) ?? existing.slug;
    const slugChanged = newSlug !== existing.slug;

    await db.transaction(async (tx) => {
      await tx.update(kategorijeKnjigeTable).set(updates).where(eq(kategorijeKnjigeTable.id, id));
      if (slugChanged) {
        await tx.update(knjige)
          .set({ kategorija: newSlug })
          .where(eq(knjige.kategorija, existing.slug));
      }
    });
    const [updated] = await db.select().from(kategorijeKnjigeTable).where(eq(kategorijeKnjigeTable.id, id));
    res.json(updated);
  } catch (err: any) {
    if (String(err?.message || "").toLowerCase().includes("unique")) {
      res.status(409).json({ error: "Slug kategorije već postoji" });
      return;
    }
    console.error("[PUT /admin/kategorije-knjiga/:id]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// DELETE /api/admin/kategorije-knjiga/:id — obriši kategoriju.
// Priče u toj kategoriji ostaju (postaju "Bez kategorije" na frontendu).
router.delete("/kategorije-knjiga/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Neispravan id" }); return; }
    await db.delete(kategorijeKnjigeTable).where(eq(kategorijeKnjigeTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE /admin/kategorije-knjiga/:id]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// ── BANKA PITANJA ──────────────────────────────────────────────────────────────
// Centralizovana baza svih pitanja. Vidi schema komentar uz pitanjaBankaTable.
// Sve rute admin-only (router.use guard iznad).

// GET /api/admin/banka-pitanja?search=...&kategorija=...&lekcijaId=...&page=1&pageSize=50
router.get("/banka-pitanja", async (req, res) => {
  try {
    const search = (req.query["search"] as string | undefined)?.trim() || "";
    const kategorija = (req.query["kategorija"] as string | undefined) || "";
    const tag = (req.query["tag"] as string | undefined) || "";
    const lekcijaIdRaw = req.query["lekcijaId"] as string | undefined;
    const lekcijaId = lekcijaIdRaw ? parseInt(lekcijaIdRaw) : undefined;
    const page = Math.max(1, parseInt((req.query["page"] as string) || "1") || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt((req.query["pageSize"] as string) || "50") || 50));

    const filters = [] as any[];
    if (search) filters.push(sql`${pitanjaBankaTable.pitanje} ILIKE ${"%" + search + "%"}`);
    if (kategorija) filters.push(eq(pitanjaBankaTable.kategorija, kategorija));
    if (tag) filters.push(sql`${pitanjaBankaTable.tagovi} ? ${tag}`);
    if (lekcijaId) filters.push(eq(pitanjaBankaTable.lekcijaId, lekcijaId));
    const whereClause = filters.length ? and(...filters) : undefined;

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(pitanjaBankaTable)
      .where(whereClause as any);

    const rows = await db
      .select()
      .from(pitanjaBankaTable)
      .where(whereClause as any)
      .orderBy(desc(pitanjaBankaTable.updatedAt), desc(pitanjaBankaTable.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    res.json({ total, page, pageSize, rows });
  } catch (err) {
    console.error("[GET /banka-pitanja]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/admin/banka-pitanja/kategorije — meta za UI dropdowns
// Vraća hijerarhiju: 5 glavnih kategorija (NPP 2018) + tagovi za filtriranje.
router.get("/banka-pitanja/kategorije", async (_req, res) => {
  try {
    const kategorijeRows = await db.select().from(kvizKategorijeTable)
      .orderBy(asc(kvizKategorijeTable.redoslijed), asc(kvizKategorijeTable.id));
    const tagoviRows = await db.select().from(kvizTagoviTable)
      .orderBy(asc(kvizTagoviTable.redoslijed), asc(kvizTagoviTable.id));
    res.json({
      kategorije: kategorijeRows.map(k => ({ slug: k.slug, naziv: k.naziv, ikona: k.ikona })),
      tagovi: tagoviRows.map(t => ({ slug: t.slug, naziv: t.naziv, kategorija: t.kategorija })),
    });
  } catch (err) {
    console.error("[GET /admin/banka-pitanja/kategorije]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// ── KVIZ KATEGORIJE (admin CRUD) ───────────────────────────────────────────────
// Admin-definisane kategorije za pitanja u banci. Brisanje kategorije NE briše
// pitanja — ona ostaju sa starim slugom u koloni `kategorija` i u UI-ju se
// prikazuju pod "Bez kategorije" (ili pod sirovim slugom). Admin može masovno
// promijeniti kategoriju pitanjima kroz banku ako želi.

// GET /api/admin/kviz-kategorije — sve kategorije + broj pitanja u svakoj
router.get("/kviz-kategorije", async (_req, res) => {
  try {
    const kategorije = await db.select().from(kvizKategorijeTable)
      .orderBy(asc(kvizKategorijeTable.redoslijed), asc(kvizKategorijeTable.id));
    const counts = await db
      .select({ kategorija: pitanjaBankaTable.kategorija, broj: sql<number>`count(*)::int` })
      .from(pitanjaBankaTable)
      .groupBy(pitanjaBankaTable.kategorija);
    const countMap = new Map(counts.map(c => [c.kategorija, c.broj]));
    res.json(kategorije.map(k => ({ ...k, brojPitanja: countMap.get(k.slug) ?? 0 })));
  } catch (err) {
    console.error("[GET /admin/kviz-kategorije]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/admin/kviz-kategorije — dodaj novu kategoriju
router.post("/kviz-kategorije", async (req, res) => {
  try {
    const { slug, naziv, ikona, redoslijed } = req.body || {};
    if (!slug || !naziv) { res.status(400).json({ error: "slug i naziv su obavezni" }); return; }
    const slugClean = String(slug).trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
    if (!slugClean) { res.status(400).json({ error: "Slug mora sadržavati a-z, 0-9 ili _" }); return; }
    const [created] = await db.insert(kvizKategorijeTable).values({
      slug: slugClean,
      naziv: String(naziv).trim(),
      ikona: ikona ? String(ikona).trim().slice(0, 16) : null,
      redoslijed: typeof redoslijed === "number" ? redoslijed : 100,
    }).returning();
    res.status(201).json(created);
  } catch (err: any) {
    if (String(err?.message || "").toLowerCase().includes("unique")) {
      res.status(409).json({ error: "Slug kategorije već postoji" });
      return;
    }
    console.error("[POST /admin/kviz-kategorije]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/admin/kviz-kategorije/:id — izmijeni kategoriju.
// Ako se mijenja `slug`, automatski ažurira `pitanja_banka.kategorija` u svim
// pitanjima koja su u toj kategoriji (transakcija).
router.put("/kviz-kategorije/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Neispravan id" }); return; }
    const { slug, naziv, ikona, redoslijed } = req.body || {};
    const [existing] = await db.select().from(kvizKategorijeTable).where(eq(kvizKategorijeTable.id, id));
    if (!existing) { res.status(404).json({ error: "Kategorija nije pronađena" }); return; }
    const updates: Record<string, unknown> = {};
    if (slug !== undefined) {
      const s = String(slug).trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
      if (!s) { res.status(400).json({ error: "Slug mora sadržavati a-z, 0-9 ili _" }); return; }
      updates["slug"] = s;
    }
    if (naziv !== undefined) updates["naziv"] = String(naziv).trim();
    if (ikona !== undefined) updates["ikona"] = ikona ? String(ikona).trim().slice(0, 16) : null;
    if (redoslijed !== undefined) updates["redoslijed"] = typeof redoslijed === "number" ? redoslijed : existing.redoslijed;
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nema izmjena" }); return; }
    const newSlug = (updates["slug"] as string | undefined) ?? existing.slug;
    const slugChanged = newSlug !== existing.slug;
    if (slugChanged) {
      await db.transaction(async (tx) => {
        await tx.update(kvizKategorijeTable).set(updates).where(eq(kvizKategorijeTable.id, id));
        await tx.update(pitanjaBankaTable)
          .set({ kategorija: newSlug })
          .where(eq(pitanjaBankaTable.kategorija, existing.slug));
      });
    } else {
      await db.update(kvizKategorijeTable).set(updates).where(eq(kvizKategorijeTable.id, id));
    }
    const [updated] = await db.select().from(kvizKategorijeTable).where(eq(kvizKategorijeTable.id, id));
    res.json(updated);
  } catch (err: any) {
    if (String(err?.message || "").toLowerCase().includes("unique")) {
      res.status(409).json({ error: "Slug kategorije već postoji" });
      return;
    }
    console.error("[PUT /admin/kviz-kategorije/:id]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// DELETE /api/admin/kviz-kategorije/:id — obriši kategoriju.
// Pitanja u toj kategoriji ostaju netaknuta (slug ostaje u koloni — UI ih
// grupiše pod "Bez kategorije"). Admin ih može pojedinačno premjestiti.
router.delete("/kviz-kategorije/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Neispravan id" }); return; }
    await db.delete(kvizKategorijeTable).where(eq(kvizKategorijeTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE /admin/kviz-kategorije/:id]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// ── KVIZ TAGOVI (admin CRUD) ───────────────────────────────────────────────────
// Admin-definisani tagovi (pod-teme), vezani za glavnu kategoriju preko `kategorija`
// slug-a. Referenciraju se iz `pitanja_banka.tagovi` (jsonb array). Brisanje taga
// ga skida iz svih pitanja (transakcija); preimenovanje slug-a kaskadno ažurira
// pitanja.

// GET /api/admin/kviz-tagovi — svi tagovi + broj pitanja u svakom
router.get("/kviz-tagovi", async (_req, res) => {
  try {
    const tagovi = await db.select().from(kvizTagoviTable)
      .orderBy(asc(kvizTagoviTable.redoslijed), asc(kvizTagoviTable.id));
    const countRes: any = await db.execute(sql`
      SELECT tag, COUNT(*)::int AS broj
      FROM pitanja_banka, jsonb_array_elements_text(tagovi) AS tag
      GROUP BY tag
    `);
    const countMap = new Map((countRes.rows ?? []).map((c: any) => [c.tag, Number(c.broj)]));
    res.json(tagovi.map(t => ({ ...t, brojPitanja: countMap.get(t.slug) ?? 0 })));
  } catch (err) {
    console.error("[GET /admin/kviz-tagovi]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/admin/kviz-tagovi — dodaj novi tag
router.post("/kviz-tagovi", async (req, res) => {
  try {
    const { slug, naziv, kategorija, redoslijed } = req.body || {};
    if (!naziv || !kategorija) { res.status(400).json({ error: "naziv i kategorija su obavezni" }); return; }
    const base = slug || naziv;
    const slugClean = String(base).trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
    if (!slugClean) { res.status(400).json({ error: "Slug mora sadržavati a-z, 0-9 ili _" }); return; }
    const [kat] = await db.select().from(kvizKategorijeTable).where(eq(kvizKategorijeTable.slug, String(kategorija)));
    if (!kat) { res.status(400).json({ error: "Glavna kategorija ne postoji" }); return; }
    const [created] = await db.insert(kvizTagoviTable).values({
      slug: slugClean,
      naziv: String(naziv).trim(),
      kategorija: String(kategorija),
      redoslijed: typeof redoslijed === "number" ? redoslijed : 100,
    }).returning();
    res.status(201).json(created);
  } catch (err: any) {
    if (String(err?.message || "").toLowerCase().includes("unique")) {
      res.status(409).json({ error: "Tag sa istim slugom već postoji" });
      return;
    }
    console.error("[POST /admin/kviz-tagovi]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/admin/kviz-tagovi/:id — izmijeni tag.
// Ako se mijenja `slug`, kaskadno ažurira `pitanja_banka.tagovi` (zamjena u jsonb
// nizu) u svim pitanjima koja taj tag koriste (transakcija).
router.put("/kviz-tagovi/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Neispravan id" }); return; }
    const { slug, naziv, kategorija, redoslijed } = req.body || {};
    const [existing] = await db.select().from(kvizTagoviTable).where(eq(kvizTagoviTable.id, id));
    if (!existing) { res.status(404).json({ error: "Tag nije pronađen" }); return; }
    const updates: Record<string, unknown> = {};
    if (slug !== undefined) {
      const s = String(slug).trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
      if (!s) { res.status(400).json({ error: "Slug mora sadržavati a-z, 0-9 ili _" }); return; }
      updates["slug"] = s;
    }
    if (naziv !== undefined) updates["naziv"] = String(naziv).trim();
    if (kategorija !== undefined) {
      const [kat] = await db.select().from(kvizKategorijeTable).where(eq(kvizKategorijeTable.slug, String(kategorija)));
      if (!kat) { res.status(400).json({ error: "Glavna kategorija ne postoji" }); return; }
      updates["kategorija"] = String(kategorija);
    }
    if (redoslijed !== undefined) updates["redoslijed"] = typeof redoslijed === "number" ? redoslijed : existing.redoslijed;
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nema izmjena" }); return; }
    const newSlug = (updates["slug"] as string | undefined) ?? existing.slug;
    const slugChanged = newSlug !== existing.slug;
    if (slugChanged) {
      await db.transaction(async (tx) => {
        await tx.update(kvizTagoviTable).set(updates).where(eq(kvizTagoviTable.id, id));
        await tx.execute(sql`
          UPDATE pitanja_banka
          SET tagovi = (
            SELECT jsonb_agg(DISTINCT CASE WHEN x = ${existing.slug} THEN ${newSlug} ELSE x END)
            FROM jsonb_array_elements_text(tagovi) AS x
          )
          WHERE tagovi ? ${existing.slug};
        `);
      });
    } else {
      await db.update(kvizTagoviTable).set(updates).where(eq(kvizTagoviTable.id, id));
    }
    const [updated] = await db.select().from(kvizTagoviTable).where(eq(kvizTagoviTable.id, id));
    res.json(updated);
  } catch (err: any) {
    if (String(err?.message || "").toLowerCase().includes("unique")) {
      res.status(409).json({ error: "Tag sa istim slugom već postoji" });
      return;
    }
    console.error("[PUT /admin/kviz-tagovi/:id]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// DELETE /api/admin/kviz-tagovi/:id — obriši tag.
// Tag se uklanja iz `pitanja_banka.tagovi` svih pitanja (transakcija) da ne ostane
// "siroče" u jsonb nizu.
router.delete("/kviz-tagovi/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Neispravan id" }); return; }
    const [existing] = await db.select().from(kvizTagoviTable).where(eq(kvizTagoviTable.id, id));
    if (!existing) { res.json({ success: true }); return; }
    await db.transaction(async (tx) => {
      await tx.execute(sql`
        UPDATE pitanja_banka
        SET tagovi = COALESCE((
          SELECT jsonb_agg(x) FROM jsonb_array_elements_text(tagovi) AS x WHERE x <> ${existing.slug}
        ), '[]'::jsonb)
        WHERE tagovi ? ${existing.slug};
      `);
      await tx.delete(kvizTagoviTable).where(eq(kvizTagoviTable.id, id));
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE /admin/kviz-tagovi/:id]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/admin/banka-pitanja/:id
router.get("/banka-pitanja/:id", async (req, res) => {
  try {
    const [row] = await db.select().from(pitanjaBankaTable).where(eq(pitanjaBankaTable.id, parseInt(req.params.id)));
    if (!row) { res.status(404).json({ error: "Pitanje nije pronađeno" }); return; }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/admin/banka-pitanja/:id/usage — koje kvizove koristi
router.get("/banka-pitanja/:id/usage", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const usage = await db
      .select({
        kvizId: kvizoviTable.id,
        slug: kvizoviTable.slug,
        naslov: kvizoviTable.naslov,
        modul: kvizoviTable.modul,
      })
      .from(kvizPitanjaTable)
      .innerJoin(kvizoviTable, eq(kvizoviTable.id, kvizPitanjaTable.kvizId))
      .where(eq(kvizPitanjaTable.pitanjeId, id));
    res.json({ count: usage.length, kvizovi: usage });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

function normalizePitanjeBody(body: any) {
  const pitanje = String(body?.pitanje || "").trim();
  const allowed = ["single", "multiple", "truefalse", "reorder", "dragDrop", "markWords"];
  const vrsta = (allowed.includes(body?.vrsta) ? body.vrsta : "single") as
    "single" | "multiple" | "truefalse" | "reorder" | "dragDrop" | "markWords";

  let opcije: string[] = Array.isArray(body?.opcije) ? body.opcije.map((o: any) => String(o)) : [];
  let correctIndex = 0;
  let correctIndexes: number[] | null = null;
  let correctOrder: number[] | null = null;
  let meta: {
    template?: string[]; words?: string[]; correct?: string[];
    text?: string; incorrect?: string[];
    didaktickiTip?: "prisjecanje" | "razlikovanje" | "primjena" | "redoslijed";
    retryMode?: "immediate";
    retryPrompt?: string;
    sourceQuestion?: string;
    pilotKey?: string;
  } | null = null;

  if (vrsta === "truefalse") {
    opcije = ["Da", "Ne"];
    const ci = parseInt(body?.correctIndex ?? 0) || 0;
    correctIndex = ci === 1 ? 1 : 0;
  } else if (vrsta === "reorder") {
    // correctOrder = [1..N permutacija] paralelno sa opcije[]
    if (Array.isArray(body?.correctOrder)) {
      correctOrder = body.correctOrder.map((n: any) => Number(n) || 0);
    }
    correctIndex = 0;
  } else if (vrsta === "multiple") {
    if (Array.isArray(body?.correctIndexes) && body.correctIndexes.length > 0) {
      correctIndexes = Array.from(new Set<number>(body.correctIndexes.map((n: any) => parseInt(n) || 0)))
        .filter((n) => n >= 0 && n < opcije.length)
        .sort((a, b) => a - b);
    }
    correctIndex = correctIndexes && correctIndexes.length > 0 ? correctIndexes[0]! : 0;
  } else if (vrsta === "dragDrop") {
    // dragDrop ne koristi opcije/correctIndex — sve je u meta
    opcije = [];
    const m = body?.meta || {};
    meta = {
      template: Array.isArray(m.template) ? m.template.map((t: any) => String(t)) : [],
      words: Array.isArray(m.words) ? m.words.map((w: any) => String(w)) : [],
      correct: Array.isArray(m.correct) ? m.correct.map((w: any) => String(w)) : [],
    };
  } else if (vrsta === "markWords") {
    // markWords ne koristi opcije/correctIndex — sve je u meta
    opcije = [];
    const m = body?.meta || {};
    meta = {
      text: typeof m.text === "string" ? m.text : "",
      words: Array.isArray(m.words) ? m.words.map((w: any) => String(w)) : [],
      incorrect: Array.isArray(m.incorrect) ? m.incorrect.map((w: any) => String(w)) : [],
    };
  } else {
    correctIndex = Math.max(0, Math.min(Math.max(0, opcije.length - 1), parseInt(body?.correctIndex ?? 0) || 0));
  }

  const rawMeta = body?.meta && typeof body.meta === "object" ? body.meta : {};
  const didaktickiTipovi = ["prisjecanje", "razlikovanje", "primjena", "redoslijed"] as const;
  const didaktickiTip = didaktickiTipovi.includes(rawMeta.didaktickiTip)
    ? rawMeta.didaktickiTip as typeof didaktickiTipovi[number]
    : undefined;
  const retryMode = rawMeta.retryMode === "immediate" ? "immediate" as const : undefined;
  const retryPrompt = typeof rawMeta.retryPrompt === "string"
    ? rawMeta.retryPrompt.trim().slice(0, 500) || undefined
    : undefined;
  const sourceQuestion = typeof rawMeta.sourceQuestion === "string"
    ? rawMeta.sourceQuestion.trim().slice(0, 1000) || undefined
    : undefined;
  const pilotKey = typeof rawMeta.pilotKey === "string"
    ? rawMeta.pilotKey.trim().slice(0, 120) || undefined
    : undefined;
  if (meta || didaktickiTip || retryMode || retryPrompt || sourceQuestion || pilotKey) {
    meta = {
      ...(meta ?? {}),
      ...(didaktickiTip ? { didaktickiTip } : {}),
      ...(retryMode ? { retryMode } : {}),
      ...(retryPrompt ? { retryPrompt } : {}),
      ...(sourceQuestion ? { sourceQuestion } : {}),
      ...(pilotKey ? { pilotKey } : {}),
    };
  }

  const objasnjenje = String(body?.objasnjenje || "").trim();
  const slika = body?.slika ? String(body.slika) : null;
  const kategorija = body?.kategorija ? String(body.kategorija) : null;
  const tagovi = Array.isArray(body?.tagovi) ? body.tagovi.map((t: any) => String(t).trim().toLowerCase()).filter(Boolean) : (body?.tagovi ? [String(body.tagovi).trim().toLowerCase()] : []);
  const lekcijaId = body?.lekcijaId ? parseInt(body.lekcijaId) || null : null;
  const tezina = body?.tezina ? Math.max(1, Math.min(3, parseInt(body.tezina) || 1)) : 1;
  return { pitanje, opcije, correctIndex, correctIndexes, correctOrder, meta, objasnjenje, slika, vrsta, kategorija, tagovi, lekcijaId, tezina };
}

function validatePitanjeData(d: ReturnType<typeof normalizePitanjeBody>): string | null {
  if (!d.pitanje) return "Tekst pitanja je obavezan";
  if (d.vrsta === "truefalse") {
    return null; // opcije su uvijek ["Da","Ne"]
  }
  if (d.vrsta === "dragDrop") {
    const m = d.meta || {};
    const template = Array.isArray(m.template) ? m.template : [];
    const words = Array.isArray(m.words) ? m.words : [];
    const correct = Array.isArray(m.correct) ? m.correct : [];
    const dropCount = template.filter((t) => t === "DROP").length;
    if (template.length === 0) return "Šablon (template) je obavezan";
    if (dropCount === 0) return "Šablon mora imati barem jednu prazninu (DROP)";
    if (words.length < dropCount) return "Pool riječi mora imati minimum onoliko riječi koliko ima praznina";
    if (correct.length !== dropCount) return `Tačan slijed mora imati ${dropCount} riječi (po jednu za svaku prazninu)`;
    if (correct.some((c) => !words.includes(c))) return "Sve tačne riječi moraju biti u pool-u";
    return null;
  }
  if (d.vrsta === "markWords") {
    const m = d.meta || {};
    const words = Array.isArray(m.words) ? m.words : [];
    const incorrect = Array.isArray(m.incorrect) ? m.incorrect : [];
    if (words.length < 2) return "Minimum 2 riječi u tekstu";
    if (incorrect.length === 0) return "Označi minimum 1 pogrešnu riječ";
    if (incorrect.some((w) => !words.includes(w))) return "Sve pogrešne riječi moraju biti u tekstu";
    return null;
  }
  if (d.opcije.length < 2) return "Minimum 2 opcije";
  if (d.opcije.some((o) => !o.trim())) return "Sve opcije moraju imati tekst";
  if (d.vrsta === "reorder") {
    if (!d.correctOrder || d.correctOrder.length !== d.opcije.length) {
      return "Redoslijed mora imati istu dužinu kao opcije";
    }
    const sorted = [...d.correctOrder].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] !== i + 1) return "Redoslijed mora biti permutacija 1..N";
    }
  }
  if (d.vrsta === "multiple" && (!d.correctIndexes || d.correctIndexes.length < 2)) {
    return "Za 'više tačnih' označi minimum 2 tačna odgovora";
  }
  return null;
}

// POST /api/admin/banka-pitanja — kreira novo pitanje
router.post("/banka-pitanja", async (req, res) => {
  try {
    const data = normalizePitanjeBody(req.body);
    const err = validatePitanjeData(data);
    if (err) { res.status(400).json({ error: err }); return; }
    const userId = (req as any).user?.id;
    const [created] = await db.insert(pitanjaBankaTable).values({
      ...data,
      createdBy: userId || null,
    }).returning();
    res.status(201).json(created);
  } catch (err: any) {
    if (String(err?.message || "").toLowerCase().includes("unique")) {
      res.status(409).json({ error: "Pitanje sa istim tekstom već postoji u banci" });
      return;
    }
    console.error("[POST /banka-pitanja]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/admin/banka-pitanja/:id
router.put("/banka-pitanja/:id", async (req, res) => {
  try {
    const data = normalizePitanjeBody(req.body);
    const err = validatePitanjeData(data);
    if (err) { res.status(400).json({ error: err }); return; }
    await db.update(pitanjaBankaTable).set({
      ...data,
      updatedAt: new Date(),
    }).where(eq(pitanjaBankaTable.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (err: any) {
    if (String(err?.message || "").toLowerCase().includes("unique")) {
      res.status(409).json({ error: "Drugo pitanje sa istim tekstom već postoji" });
      return;
    }
    console.error("[PUT /banka-pitanja/:id]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// DELETE /api/admin/banka-pitanja/:id — CASCADE briše iz svih kvizova.
// Rezultati u kviz_rezultati ostaju (snapshot vrijednosti).
router.delete("/banka-pitanja/:id", async (req, res) => {
  try {
    await db.delete(pitanjaBankaTable).where(eq(pitanjaBankaTable.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE /banka-pitanja/:id]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// ── KVIZ ↔ PITANJA management ───────────────────────────────────────────────
// Sve rute pretpostavljaju da kviz već koristi banku (ili će prelaziti).

// GET /api/admin/kvizovi/:id/pitanja — vrati pitanja kviza iz banke
router.get("/kvizovi/:id/pitanja", async (req, res) => {
  try {
    const kvizId = parseInt(req.params.id);
    const rows = await db
      .select({
        id: pitanjaBankaTable.id,
        pitanje: pitanjaBankaTable.pitanje,
        opcije: pitanjaBankaTable.opcije,
        correctIndex: pitanjaBankaTable.correctIndex,
        vrsta: pitanjaBankaTable.vrsta,
        meta: pitanjaBankaTable.meta,
        kategorija: pitanjaBankaTable.kategorija,
        redoslijed: kvizPitanjaTable.redoslijed,
        linkId: kvizPitanjaTable.id,
      })
      .from(kvizPitanjaTable)
      .innerJoin(pitanjaBankaTable, eq(pitanjaBankaTable.id, kvizPitanjaTable.pitanjeId))
      .where(eq(kvizPitanjaTable.kvizId, kvizId))
      .orderBy(asc(kvizPitanjaTable.redoslijed), asc(kvizPitanjaTable.id));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/admin/kvizovi/:id/dodaj-pitanja  body: { pitanjeIds: number[] }
// Bulk dodavanje. Postojeće linkove preskače (UNIQUE constraint).
router.post("/kvizovi/:id/dodaj-pitanja", async (req, res) => {
  try {
    const kvizId = parseInt(req.params.id);
    const ids: number[] = Array.isArray(req.body?.pitanjeIds) ? req.body.pitanjeIds.map((x: any) => parseInt(x)).filter(Boolean) : [];
    if (ids.length === 0) { res.status(400).json({ error: "pitanjeIds je obavezan niz" }); return; }
    // Atomski u transakciji — dva paralelna admin requestova ne smiju
    // dodijeliti isti `redoslijed`. Lockujemo postojeće redove kviza FOR UPDATE
    // da MAX(redoslijed) vidi konzistentnu sliku do COMMIT-a.
    const dodano = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM ${kvizPitanjaTable} WHERE ${kvizPitanjaTable.kvizId} = ${kvizId} FOR UPDATE`);
      const [{ maxR }] = await tx
        .select({ maxR: sql<number>`COALESCE(MAX(${kvizPitanjaTable.redoslijed}), -1)::int` })
        .from(kvizPitanjaTable)
        .where(eq(kvizPitanjaTable.kvizId, kvizId));
      let next = (maxR ?? -1) + 1;
      const values = ids.map((pid) => ({ kvizId, pitanjeId: pid, redoslijed: next++ }));
      await tx.insert(kvizPitanjaTable).values(values).onConflictDoNothing();
      return values.length;
    });
    res.json({ success: true, dodano });
  } catch (err) {
    console.error("[POST /kvizovi/:id/dodaj-pitanja]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// DELETE /api/admin/kvizovi/:id/pitanja/:pitanjeId — ukloni pitanje iz kviza
router.delete("/kvizovi/:id/pitanja/:pitanjeId", async (req, res) => {
  try {
    await db.delete(kvizPitanjaTable).where(and(
      eq(kvizPitanjaTable.kvizId, parseInt(req.params.id)),
      eq(kvizPitanjaTable.pitanjeId, parseInt(req.params.pitanjeId)),
    ));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/admin/kvizovi/:id/premjesti-pitanje  body: { pitanjeId, ciljniKvizId }
// Premještanje = ukloni iz izvornog + dodaj u ciljni (atomski po mogućnosti).
router.post("/kvizovi/:id/premjesti-pitanje", async (req, res) => {
  try {
    const izvorniKvizId = parseInt(req.params.id);
    const pitanjeId = parseInt(req.body?.pitanjeId);
    const ciljniKvizId = parseInt(req.body?.ciljniKvizId);
    if (!pitanjeId || !ciljniKvizId) { res.status(400).json({ error: "pitanjeId i ciljniKvizId su obavezni" }); return; }
    if (izvorniKvizId === ciljniKvizId) { res.status(400).json({ error: "Izvorni i ciljni kviz su isti" }); return; }
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM ${kvizPitanjaTable} WHERE ${kvizPitanjaTable.kvizId} = ${ciljniKvizId} FOR UPDATE`);
      const [{ maxR }] = await tx
        .select({ maxR: sql<number>`COALESCE(MAX(${kvizPitanjaTable.redoslijed}), -1)::int` })
        .from(kvizPitanjaTable)
        .where(eq(kvizPitanjaTable.kvizId, ciljniKvizId));
      await tx.insert(kvizPitanjaTable).values({
        kvizId: ciljniKvizId,
        pitanjeId,
        redoslijed: (maxR ?? -1) + 1,
      }).onConflictDoNothing();
      await tx.delete(kvizPitanjaTable).where(and(
        eq(kvizPitanjaTable.kvizId, izvorniKvizId),
        eq(kvizPitanjaTable.pitanjeId, pitanjeId),
      ));
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[POST /kvizovi/:id/premjesti-pitanje]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/admin/kvizovi/:id/redoslijed  body: { pitanjeIds: number[] }
// Postavlja redoslijed kviz_pitanja prema poslanom nizu ID-jeva pitanja.
router.put("/kvizovi/:id/redoslijed", async (req, res) => {
  try {
    const kvizId = parseInt(req.params.id);
    const ids: number[] = Array.isArray(req.body?.pitanjeIds) ? req.body.pitanjeIds.map((x: any) => parseInt(x)).filter(Boolean) : [];
    for (let i = 0; i < ids.length; i++) {
      await db.update(kvizPitanjaTable).set({ redoslijed: i }).where(and(
        eq(kvizPitanjaTable.kvizId, kvizId),
        eq(kvizPitanjaTable.pitanjeId, ids[i]!),
      ));
    }
    res.json({ success: true });
  } catch (err) {
    console.error("[PUT /kvizovi/:id/redoslijed]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/admin/analytics — comprehensive analytics for admin dashboard
// Resilient: every query is isolated; if one fails, others still return.
router.get("/analytics", async (req, res) => {
  const errors: Record<string, string> = {};
  const safe = async <T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch (e: any) {
      const msg = e?.message || String(e);
      errors[name] = msg;
      console.error(`Analytics[${name}] error:`, msg);
      return fallback;
    }
  };

  // Period: "danas" | "7d" | "30d" (default 30d). "danas" = od ponoći po Sarajevo vremenu.
  const period = ((req.query.period as string) || "30d");
  const now = new Date();
  let windowStart: Date;
  if (period === "danas") {
    const saraWall = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Sarajevo" }));
    const msOdPonoci = saraWall.getHours() * 3600000 + saraWall.getMinutes() * 60000 + saraWall.getSeconds() * 1000 + saraWall.getMilliseconds();
    windowStart = new Date(now.getTime() - msOdPonoci);
  } else if (period === "7d") {
    windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else {
    windowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  const duration = now.getTime() - windowStart.getTime();
  const prevStart = new Date(windowStart.getTime() - duration);
  const granularity: "hour" | "day" = period === "danas" ? "hour" : "day";

  const bucketPosjete = granularity === "hour"
    ? sql<string>`to_char(${posjeteTable.createdAt}, 'HH24:00')`
    : sql<string>`to_char(${posjeteTable.createdAt}, 'YYYY-MM-DD')`;
  const bucketReg = granularity === "hour"
    ? sql<string>`to_char(${usersTable.createdAt}, 'HH24:00')`
    : sql<string>`to_char(${usersTable.createdAt}, 'YYYY-MM-DD')`;

  // ── KPI sažeci (tekući period + prethodni jednaki period za % promjenu) ──
  const posjeteAgg = (await safe("posjeteAgg", () =>
    db.select({
      broj: sql<number>`count(*)::int`,
      uniq: sql<number>`count(distinct ${posjeteTable.ip})::int`,
    }).from(posjeteTable).where(gte(posjeteTable.createdAt, windowStart)),
    [] as { broj: number; uniq: number }[],
  ))[0] ?? { broj: 0, uniq: 0 };

  const posjetePrevAgg = (await safe("posjetePrevAgg", () =>
    db.select({
      broj: sql<number>`count(*)::int`,
      uniq: sql<number>`count(distinct ${posjeteTable.ip})::int`,
    }).from(posjeteTable).where(and(gte(posjeteTable.createdAt, prevStart), lt(posjeteTable.createdAt, windowStart))),
    [] as { broj: number; uniq: number }[],
  ))[0] ?? { broj: 0, uniq: 0 };

  const regNow = (await safe("regNow", () =>
    db.select({ broj: sql<number>`count(*)::int` }).from(usersTable).where(gte(usersTable.createdAt, windowStart)),
    [] as { broj: number }[],
  ))[0]?.broj ?? 0;
  const regPrev = (await safe("regPrev", () =>
    db.select({ broj: sql<number>`count(*)::int` }).from(usersTable).where(and(gte(usersTable.createdAt, prevStart), lt(usersTable.createdAt, windowStart))),
    [] as { broj: number }[],
  ))[0]?.broj ?? 0;

  const kvizNow = (await safe("kvizNow", () =>
    db.select({ broj: sql<number>`count(*)::int` }).from(kvizRezultatiTable).where(gte(kvizRezultatiTable.completedAt, windowStart)),
    [] as { broj: number }[],
  ))[0]?.broj ?? 0;
  const kvizPrev = (await safe("kvizPrev", () =>
    db.select({ broj: sql<number>`count(*)::int` }).from(kvizRezultatiTable).where(and(gte(kvizRezultatiTable.completedAt, prevStart), lt(kvizRezultatiTable.completedAt, windowStart))),
    [] as { broj: number }[],
  ))[0]?.broj ?? 0;

  const kpi = {
    posjete: posjeteAgg.broj, posjetePrev: posjetePrevAgg.broj,
    jedinstveni: posjeteAgg.uniq, jedinstveniPrev: posjetePrevAgg.uniq,
    registracije: regNow, registracijePrev: regPrev,
    kvizovi: kvizNow, kvizoviPrev: kvizPrev,
  };

  const registracijePoMjesecu = await safe("registracijePoMjesecu", () =>
    db.select({
      datum: bucketReg,
      broj: sql<number>`count(*)::int`,
    }).from(usersTable)
      .where(gte(usersTable.createdAt, windowStart))
      .groupBy(bucketReg)
      .orderBy(bucketReg),
    [] as { datum: string; broj: number }[],
  );

  const posjetePoDrzavi = await safe("posjetePoDrzavi", () =>
    db.select({
      country: posjeteTable.country,
      broj: sql<number>`count(*)::int`,
    }).from(posjeteTable)
      .where(and(gte(posjeteTable.createdAt, windowStart), isNotNull(posjeteTable.country), sql`${posjeteTable.country} <> 'Local'`))
      .groupBy(posjeteTable.country)
      .orderBy(sql`count(*) desc`)
      .limit(20),
    [] as { country: string | null; broj: number }[],
  );

  const aktivnostPosmjenama = await safe("aktivnostPosmjenama", () =>
    db.select({
      datum: bucketPosjete,
      broj: sql<number>`count(*)::int`,
    }).from(posjeteTable)
      .where(gte(posjeteTable.createdAt, windowStart))
      .groupBy(bucketPosjete)
      .orderBy(bucketPosjete),
    [] as { datum: string; broj: number }[],
  );

  const najposjecenijeStranice = await safe("najposjecenijeStranice", () =>
    db.select({
      path: posjeteTable.path,
      broj: sql<number>`count(*)::int`,
    }).from(posjeteTable)
      .where(and(
        gte(posjeteTable.createdAt, windowStart),
        sql`split_part(${posjeteTable.path}, '/', 2) = any(array[
          '', 'vodic', 'login', 'registracija', 'zaboravljena-sifra', 'reset-sifra',
          'arapsko-pismo', 'lesson', 'karta-harfova', 'napredak',
          'ilmihal', 'nivo1-mapa', 'nivo2-mapa', 'nivo3-mapa', 'nivo2', 'medaljon', 'krunisanje',
          'kvizovi', 'citaonica', 'kuran', 'roditelj', 'ucenik', 'igrice',
          'popravi-sace', 'misije', 'poruke', 'admin', 'muallim'
        ])`,
      ))
      .groupBy(posjeteTable.path)
      .orderBy(sql`count(*) desc`)
      .limit(8),
    [] as { path: string; broj: number }[],
  );

  const deviceExpr = sql<string>`case
    when ${posjeteTable.userAgent} ilike '%ipad%' or ${posjeteTable.userAgent} ilike '%tablet%' or (${posjeteTable.userAgent} ilike '%android%' and ${posjeteTable.userAgent} not ilike '%mobile%') then 'Tablet'
    when ${posjeteTable.userAgent} ilike '%mobile%' or ${posjeteTable.userAgent} ilike '%iphone%' or ${posjeteTable.userAgent} ilike '%android%' then 'Mobitel'
    else 'Računar' end`;
  const uredjaji = await safe("uredjaji", () =>
    db.select({
      tip: deviceExpr,
      broj: sql<number>`count(*)::int`,
    }).from(posjeteTable)
      .where(and(gte(posjeteTable.createdAt, windowStart), isNotNull(posjeteTable.userAgent)))
      .groupBy(deviceExpr)
      .orderBy(sql`count(*) desc`),
    [] as { tip: string; broj: number }[],
  );

  const kvizRezultati = await safe("kvizRezultati", () =>
    db.select({
      kvizNaslov: kvizRezultatiTable.kvizNaslov,
      pokusaji: sql<number>`count(*)::int`,
      prosjecniProcenat: sql<number>`round(avg(${kvizRezultatiTable.procenat}))::int`,
      prosjecniBodovi: sql<number>`round(avg(${kvizRezultatiTable.bodovi}))::int`,
      najvisiBodovi: sql<number>`max(${kvizRezultatiTable.procenat})::int`,
    }).from(kvizRezultatiTable)
      .groupBy(kvizRezultatiTable.kvizNaslov)
      .orderBy(sql`count(*) desc`),
    [] as { kvizNaslov: string; pokusaji: number; prosjecniProcenat: number; prosjecniBodovi: number; najvisiBodovi: number }[],
  );

  const korisnikStats = await safe("korisnikStats", () =>
    db.select({
      role: usersTable.role,
      aktivni: sql<number>`count(*) filter (where ${usersTable.isActive} = true)::int`,
      neaktivni: sql<number>`count(*) filter (where ${usersTable.isActive} = false)::int`,
    }).from(usersTable)
      .groupBy(usersTable.role),
    [] as { role: string; aktivni: number; neaktivni: number }[],
  );

  const nedavniRezultati = await safe("nedavniRezultati", () =>
    db.select({
      id: kvizRezultatiTable.id,
      userId: kvizRezultatiTable.userId,
      kvizNaslov: kvizRezultatiTable.kvizNaslov,
      tacniOdgovori: kvizRezultatiTable.tacniOdgovori,
      ukupnoPitanja: kvizRezultatiTable.ukupnoPitanja,
      procenat: kvizRezultatiTable.procenat,
      bodovi: kvizRezultatiTable.bodovi,
      completedAt: kvizRezultatiTable.completedAt,
      username: usersTable.username,
      displayName: usersTable.displayName,
    }).from(kvizRezultatiTable)
      .leftJoin(usersTable, eq(kvizRezultatiTable.userId, usersTable.id))
      .orderBy(desc(kvizRezultatiTable.completedAt))
      .limit(50),
    [] as {
      id: number;
      userId: number;
      kvizNaslov: string;
      tacniOdgovori: number;
      ukupnoPitanja: number;
      procenat: number;
      bodovi: number;
      completedAt: Date | null;
      username: string | null;
      displayName: string | null;
    }[],
  );

  res.json({
    period,
    granularity,
    kpi,
    registracijePoMjesecu,
    posjetePoDrzavi,
    najposjecenijeStranice,
    uredjaji,
    kvizRezultati,
    aktivnostPosmjenama,
    korisnikStats,
    nedavniRezultati,
    ...(Object.keys(errors).length > 0 ? { _errors: errors } : {}),
  });
});

// GET /api/admin/online — ko je trenutno online (aktivan u zadnjih 5 min) i odakle
// "Online" = posjetilac (po IP-u) sa zabilježenom posjetom u zadnjih 5 minuta.
// Pokriva i prijavljene korisnike i goste; lokacija dolazi iz geolokacije posjete.
router.get("/online", async (_req, res) => {
  try {
    const petMinutaPrije = new Date(Date.now() - 5 * 60 * 1000);

    const ukupnoRows = await db.select({
      broj: sql<number>`count(distinct ${posjeteTable.ip})::int`,
    }).from(posjeteTable)
      .where(gte(posjeteTable.createdAt, petMinutaPrije));
    const ukupno = ukupnoRows[0]?.broj ?? 0;

    const poLokaciji = await db.select({
      country: posjeteTable.country,
      city: posjeteTable.city,
      broj: sql<number>`count(distinct ${posjeteTable.ip})::int`,
    }).from(posjeteTable)
      .where(and(gte(posjeteTable.createdAt, petMinutaPrije), sql`${posjeteTable.country} is distinct from 'Local'`))
      .groupBy(posjeteTable.country, posjeteTable.city)
      .orderBy(sql`count(distinct ${posjeteTable.ip}) desc`)
      .limit(50);

    res.json({ ukupno, poLokaciji });
  } catch (e: any) {
    console.error("Online stats error:", e?.message || e);
    res.json({ ukupno: 0, poLokaciji: [], _error: e?.message || String(e) });
  }
});

// GET /api/admin/kviz-statistike — quiz-centric stats: all quizzes with attempt counts and accuracy
router.get("/kviz-statistike", async (req, res) => {
  try {
    const sviKvizovi = await db.select({
      id: kvizoviTable.id,
      naslov: kvizoviTable.naslov,
      modul: kvizoviTable.modul,
      nivo: kvizoviTable.nivo,
    }).from(kvizoviTable).orderBy(kvizoviTable.naslov);

    const rezultatiStats = await db.select({
      kvizId: kvizRezultatiTable.kvizId,
      pokusaji: sql<number>`count(*)::int`,
      prosjecniProcenat: sql<number>`round(avg(${kvizRezultatiTable.procenat}))::int`,
      najvisiBodovi: sql<number>`max(${kvizRezultatiTable.procenat})::int`,
      najniziBodovi: sql<number>`min(${kvizRezultatiTable.procenat})::int`,
    }).from(kvizRezultatiTable)
      .groupBy(kvizRezultatiTable.kvizId);

    const statsMap = Object.fromEntries(rezultatiStats.map(r => [r.kvizId, r]));

    const combined = sviKvizovi.map(k => ({
      id: k.id,
      naslov: k.naslov,
      kategorija: k.nivo != null ? `${k.modul} · nivo ${k.nivo}` : k.modul,
      pokusaji: statsMap[k.id]?.pokusaji || 0,
      prosjecniProcenat: statsMap[k.id]?.prosjecniProcenat || 0,
      najvisiBodovi: statsMap[k.id]?.najvisiBodovi || 0,
      najniziBodovi: statsMap[k.id]?.najniziBodovi || 0,
    }));

    res.json(combined);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/admin/muallim-pregled — muallim overview with groups and student counts
router.get("/muallim-pregled", async (req, res) => {
  try {
    const muallimi = await db.select({
      id: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      email: usersTable.email,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
      isGlavni: muallimProfiliTable.isGlavni,
      mektebId: muallimProfiliTable.mektebId,
      mektebNaziv: mektebiTable.naziv,
      mektebGrad: mektebiTable.grad,
      dozvoljenoMuallima: mektebiTable.dozvoljenoMuallima,
    }).from(usersTable)
      .leftJoin(muallimProfiliTable, eq(muallimProfiliTable.userId, usersTable.id))
      .leftJoin(mektebiTable, eq(mektebiTable.id, muallimProfiliTable.mektebId))
      .where(eq(usersTable.role, "muallim"))
      .orderBy(usersTable.displayName);

    const grupe = await db.select({
      id: grupeTable.id,
      muallimId: grupeTable.muallimId,
      naziv: grupeTable.naziv,
      skolskaGodina: grupeTable.skolskaGodina,
      isActive: grupeTable.isActive,
    }).from(grupeTable);

    const ucenikProfili = await db.select({
      userId: ucenikProfiliTable.userId,
      muallimId: ucenikProfiliTable.muallimId,
      grupaId: ucenikProfiliTable.grupaId,
    }).from(ucenikProfiliTable).where(eq(ucenikProfiliTable.isArchived, false));

    const ucenikUsers = await db.select({
      id: usersTable.id,
      isActive: usersTable.isActive,
    }).from(usersTable).where(eq(usersTable.role, "ucenik"));

    const ucenikActiveMap = Object.fromEntries(ucenikUsers.map(u => [u.id, u.isActive]));

    const result = muallimi.map(m => {
      const mGrupe = grupe.filter(g => g.muallimId === m.id);
      const mUcenici = ucenikProfili.filter(u => u.muallimId === m.id);
      const aktivniUcenici = mUcenici.filter(u => ucenikActiveMap[u.userId] === true).length;

      return {
        ...m,
        brojGrupa: mGrupe.length,
        brojUcenika: mUcenici.length,
        aktivniUcenici,
        grupe: mGrupe.map(g => {
          const gUcenici = mUcenici.filter(u => u.grupaId === g.id);
          return {
            id: g.id,
            naziv: g.naziv,
            skolskaGodina: g.skolskaGodina,
            isActive: g.isActive,
            brojUcenika: gUcenici.length,
            aktivniUcenika: gUcenici.filter(u => ucenikActiveMap[u.userId] === true).length,
          };
        }),
      };
    });

    res.json(result);
  } catch (err) {
    console.error("Muallim pregled error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/admin/ucenik/:id/rasporedi — reassign student to different muallim/group
router.put("/ucenik/:id/rasporedi", async (req, res) => {
  try {
    const ucenikId = parseInt(req.params.id);
    const { muallimId, grupaId } = req.body;

    if (!muallimId || !grupaId) {
      res.status(400).json({ error: "muallimId i grupaId su obavezni" });
      return;
    }

    const [ucenik] = await db.select().from(usersTable).where(and(eq(usersTable.id, ucenikId), eq(usersTable.role, "ucenik")));
    if (!ucenik) {
      res.status(404).json({ error: "Učenik nije pronađen" });
      return;
    }

    const [grupa] = await db.select().from(grupeTable).where(and(eq(grupeTable.id, grupaId), eq(grupeTable.muallimId, muallimId)));
    if (!grupa) {
      res.status(404).json({ error: "Grupa nije pronađena ili ne pripada odabranom muallimu" });
      return;
    }

    const [profil] = await db.select().from(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, ucenikId));
    if (!profil) {
      res.status(404).json({ error: "Profil učenika nije pronađen" });
      return;
    }

    const stariMuallimId = profil.muallimId;
    const muallimChanged = stariMuallimId !== null && stariMuallimId !== muallimId;

    if (muallimChanged) {
      const [noviMuallimProfil] = await db.select().from(muallimProfiliTable).where(eq(muallimProfiliTable.userId, muallimId));
      if (noviMuallimProfil && noviMuallimProfil.licencesUsed >= noviMuallimProfil.licenceCount) {
        res.status(400).json({ error: "Novi muallim nema slobodnih licenci" });
        return;
      }
    }

    await db.update(ucenikProfiliTable).set({ muallimId, grupaId }).where(eq(ucenikProfiliTable.userId, ucenikId));

    if (muallimChanged) {
      if (stariMuallimId) {
        await db.update(muallimProfiliTable)
          .set({ licencesUsed: sql`GREATEST(${muallimProfiliTable.licencesUsed} - 1, 0)` })
          .where(eq(muallimProfiliTable.userId, stariMuallimId));
      }
      await db.update(muallimProfiliTable)
        .set({ licencesUsed: sql`${muallimProfiliTable.licencesUsed} + 1` })
        .where(eq(muallimProfiliTable.userId, muallimId));
    }

    res.json({ success: true, message: `Učenik raspoređen u grupu "${grupa.naziv}"` });
  } catch (err) {
    console.error("Rasporedi error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/admin/grupe-all — all groups with muallim names (for reassignment dropdown)
router.get("/grupe-all", async (req, res) => {
  try {
    const grupe = await db.select({
      id: grupeTable.id,
      naziv: grupeTable.naziv,
      muallimId: grupeTable.muallimId,
      muallimName: usersTable.displayName,
      isActive: grupeTable.isActive,
    }).from(grupeTable)
      .leftJoin(usersTable, eq(grupeTable.muallimId, usersTable.id))
      .orderBy(usersTable.displayName, grupeTable.naziv);

    res.json(grupe);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

router.delete("/korisnik/:id", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) { res.status(400).json({ error: "Nevažeći ID" }); return; }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) { res.status(404).json({ error: "Korisnik nije pronađen" }); return; }
    if (user.role === "admin") { res.status(403).json({ error: "Ne možete obrisati admin korisnika" }); return; }

    await db.transaction(async (tx) => {
      if (user.role === "ucenik") {
        const [profil] = await tx.select().from(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, userId));
        if (profil?.muallimId) {
          await tx.update(muallimProfiliTable)
            .set({ licencesUsed: sql`GREATEST(${muallimProfiliTable.licencesUsed} - 1, 0)` })
            .where(eq(muallimProfiliTable.userId, profil.muallimId));
        }
      }

      await tx.delete(kvizRezultatiTable).where(eq(kvizRezultatiTable.userId, userId));
      await tx.delete(korisnikNapredakTable).where(eq(korisnikNapredakTable.userId, userId));
      try { await tx.delete(studentProgressTable).where(eq(studentProgressTable.studentId, String(userId))); } catch {}
      try { await tx.delete(exerciseSessionsTable).where(eq(exerciseSessionsTable.studentId, String(userId))); } catch {}
      await tx.delete(certifikatiTable).where(eq(certifikatiTable.ucenikId, userId));
      await tx.delete(priustvoTable).where(eq(priustvoTable.ucenikId, userId));
      await tx.delete(ocjeneTable).where(eq(ocjeneTable.ucenikId, userId));
      await tx.delete(porukeTable).where(or(eq(porukeTable.posiljateljId, userId), eq(porukeTable.primateljId, userId)));
      await tx.delete(roditeljUcenikTable).where(or(eq(roditeljUcenikTable.roditeljId, userId), eq(roditeljUcenikTable.ucenikId, userId)));
      await tx.delete(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, userId));
      await tx.delete(roditeljProfiliTable).where(eq(roditeljProfiliTable.userId, userId));
      await tx.delete(pretplateTable).where(eq(pretplateTable.userId, userId));

      if (user.role === "muallim") {
        const muallimGrupe = await tx.select({ id: grupeTable.id }).from(grupeTable).where(eq(grupeTable.muallimId, userId));
        const grupaIds = muallimGrupe.map(g => g.id);
        if (grupaIds.length > 0) {
          await tx.update(ucenikProfiliTable).set({ grupaId: null, muallimId: null }).where(inArray(ucenikProfiliTable.grupaId, grupaIds));
          await tx.update(ocjeneTable).set({ grupaId: null }).where(inArray(ocjeneTable.grupaId, grupaIds));
        }
        await tx.update(ocjeneTable).set({ muallimId: 0 }).where(eq(ocjeneTable.muallimId, userId));
        await tx.update(priustvoTable).set({ muallimId: 0 }).where(eq(priustvoTable.muallimId, userId));
        await tx.delete(mektebKalendarTable).where(eq(mektebKalendarTable.muallimId, userId));
        await tx.delete(planLekcijaTable).where(eq(planLekcijaTable.muallimId, userId));
        await tx.delete(zadaceTable).where(eq(zadaceTable.muallimId, userId));
        await tx.delete(grupeTable).where(eq(grupeTable.muallimId, userId));
        await tx.delete(muallimProfiliTable).where(eq(muallimProfiliTable.userId, userId));
      }

      if (user.role === "roditelj") {
        await tx.delete(roditeljProfiliTable).where(eq(roditeljProfiliTable.userId, userId));
      }

      try { await tx.delete(posjeteTable).where(eq(posjeteTable.userId, userId)); } catch {}

      await tx.delete(usersTable).where(eq(usersTable.id, userId));
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Delete user error:", err);
    const detail = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Greška pri brisanju korisnika", detail });
  }
});

router.get("/rjecnik", async (_req, res) => {
  try {
    const rows = await db.select().from(rjecnikTable).orderBy(asc(rjecnikTable.rijec));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

router.post("/rjecnik", async (req, res) => {
  try {
    const { rijec, definicija } = req.body;
    if (!rijec || !definicija) return res.status(400).json({ error: "Riječ i definicija su obavezne" });
    const trimmed = rijec.trim().toLowerCase();
    const existing = await db.select().from(rjecnikTable).where(eq(rjecnikTable.rijec, trimmed));
    if (existing.length > 0) return res.status(409).json({ error: "Riječ već postoji u rječniku" });
    const [row] = await db.insert(rjecnikTable).values({ rijec: trimmed, definicija: definicija.trim() }).returning();
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Greška pri dodavanju riječi" });
  }
  return;
});

router.put("/rjecnik/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { rijec, definicija } = req.body;
    if (!rijec || !definicija) return res.status(400).json({ error: "Riječ i definicija su obavezne" });
    const trimmed = rijec.trim().toLowerCase();
    const dup = await db.select().from(rjecnikTable).where(and(eq(rjecnikTable.rijec, trimmed), sql`id != ${id}`));
    if (dup.length > 0) return res.status(409).json({ error: "Druga riječ s istim nazivom već postoji" });
    const [row] = await db.update(rjecnikTable).set({ rijec: trimmed, definicija: definicija.trim() }).where(eq(rjecnikTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Riječ nije pronađena" });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Greška pri ažuriranju riječi" });
  }
  return;
});

router.delete("/rjecnik/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(rjecnikTable).where(eq(rjecnikTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Greška pri brisanju riječi" });
  }
});

router.post("/system/seed-demo", async (req, res) => {
  try {
    const confirm = (req.body?.confirm ?? "").toString();
    if (confirm !== "DEMO") {
      res.status(400).json({ error: "Potvrda nije ispravna. Pošalji { confirm: \"DEMO\" }." });
      return;
    }
    const before = await db.select({ c: sql<number>`count(*)::int` }).from(usersTable);
    const beforeCount = before[0]?.c ?? 0;

    const { seedDemo } = await import("@workspace/scripts/seed-demo");
    await seedDemo();

    const after = await db.select({ c: sql<number>`count(*)::int` }).from(usersTable);
    const afterCount = after[0]?.c ?? 0;
    const added = afterCount - beforeCount;

    res.json({
      ok: true,
      message: added > 0
        ? `Demo podaci dodani. ${added} novih korisnika.`
        : "Demo podaci ažurirani (svi nalozi već postojali — ponovno seedovani).",
      addedUsers: added,
      totalUsers: afterCount,
      logins: {
        muallim: "demo.muallim / demo123",
        ucenik: "demo.amina.hasic / demo123 (i ostali)",
        roditelj: "demo.roditelj.amir / demo123, demo.roditelj.fatma / demo123",
      },
    });
  } catch (err: any) {
    console.error("[admin/system/seed-demo] greška:", err);
    res.status(500).json({ error: "Greška pri učitavanju demo podataka", detail: err?.message ?? String(err) });
  }
});

router.post("/rjecnik/seed", async (_req, res) => {
  try {
    const before = await db.select({ c: sql<number>`count(*)::int` }).from(rjecnikTable);
    const { RJECNIK } = await import("./rjecnik-seed.js");
    const values = Object.entries(RJECNIK).map(([rijec, definicija]) => ({ rijec, definicija: definicija as string }));
    await db.insert(rjecnikTable).values(values).onConflictDoNothing();
    const after = await db.select({ c: sql<number>`count(*)::int` }).from(rjecnikTable);
    const added = after[0].c - before[0].c;
    res.json({ message: added > 0 ? `Dodano ${added} novih riječi` : "Sve riječi već postoje", count: after[0].c, added });
  } catch (err: any) {
    console.error("Seed error:", err);
    res.status(500).json({ error: "Greška pri seedanju rječnika" });
  }
});

// === MEDENA STAZA — admin CRUD za pitanja ======================================
const KATEGORIJE_SET = new Set<string>(MEDENA_KATEGORIJE);

// GET /admin/igra-pitanja/stats — broj aktivnih + ukupno po kategoriji
router.get("/igra-pitanja/stats", async (_req, res) => {
  try {
    const rows = await db
      .select({
        kategorija: igraPitanjaTable.kategorija,
        ukupno: sql<number>`count(*)::int`,
        aktivnih: sql<number>`count(*) filter (where ${igraPitanjaTable.aktivno} = true)::int`,
      })
      .from(igraPitanjaTable)
      .groupBy(igraPitanjaTable.kategorija);
    const byKat: Record<string, { ukupno: number; aktivnih: number }> = {};
    for (const k of MEDENA_KATEGORIJE) byKat[k] = { ukupno: 0, aktivnih: 0 };
    for (const r of rows) byKat[r.kategorija] = { ukupno: r.ukupno, aktivnih: r.aktivnih };
    res.json({ kategorije: MEDENA_KATEGORIJE, stats: byKat });
  } catch (err) {
    console.error("[admin/igra-pitanja/stats] greška:", err);
    res.status(500).json({ error: "Greška pri učitavanju statistike" });
  }
});

// GET /admin/igra-pitanja?kategorija=X — lista (do 200)
router.get("/igra-pitanja", async (req, res) => {
  try {
    const kat = String(req.query.kategorija || "");
    if (!KATEGORIJE_SET.has(kat)) {
      res.status(400).json({ error: "Neispravna kategorija", validne: MEDENA_KATEGORIJE });
      return;
    }
    const rows = await db
      .select()
      .from(igraPitanjaTable)
      .where(eq(igraPitanjaTable.kategorija, kat))
      .orderBy(desc(igraPitanjaTable.id))
      .limit(200);
    res.json({ pitanja: rows });
  } catch (err) {
    console.error("[admin/igra-pitanja list] greška:", err);
    res.status(500).json({ error: "Greška pri učitavanju pitanja" });
  }
});

function validatePitanjeBody(body: unknown): { ok: true; data: {
  kategorija: MedenaKategorija; pitanje: string; opcije: string[];
  correctIndex: number; objasnjenje: string; tezina: number; aktivno: boolean;
} } | { ok: false; error: string } {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return { ok: false, error: "Nedostaje body" };
  const kategorija = String(b.kategorija || "");
  if (!KATEGORIJE_SET.has(kategorija)) return { ok: false, error: "Neispravna kategorija" };
  const pitanje = String(b.pitanje || "").trim();
  if (pitanje.length < 3) return { ok: false, error: "Pitanje je prekratko (min 3 znaka)" };
  if (pitanje.length > 500) return { ok: false, error: "Pitanje je predugo (max 500 znakova)" };
  const opcijeRaw = b.opcije;
  if (!Array.isArray(opcijeRaw) || opcijeRaw.length !== 4) return { ok: false, error: "Mora biti tačno 4 opcije" };
  const opcije: string[] = [];
  for (const o of opcijeRaw) {
    const s = String(o ?? "").trim();
    if (s.length === 0) return { ok: false, error: "Sve 4 opcije moraju imati tekst" };
    if (s.length > 200) return { ok: false, error: "Opcija je preduga (max 200)" };
    opcije.push(s);
  }
  const correctIndex = Number(b.correctIndex);
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
    return { ok: false, error: "correctIndex mora biti 0-3" };
  }
  const objasnjenje = String(b.objasnjenje || "").trim().slice(0, 1000);
  let tezina = Number(b.tezina);
  if (!Number.isInteger(tezina) || tezina < 1 || tezina > 3) tezina = 1;
  const aktivno = b.aktivno === undefined ? true : Boolean(b.aktivno);
  return { ok: true, data: { kategorija: kategorija as MedenaKategorija, pitanje, opcije, correctIndex, objasnjenje, tezina, aktivno } };
}

// POST /admin/igra-pitanja — kreiraj
router.post("/igra-pitanja", async (req, res) => {
  try {
    const v = validatePitanjeBody(req.body);
    if (!v.ok) {
      res.status(400).json({ error: v.error });
      return;
    }
    const inserted = await db.insert(igraPitanjaTable).values(v.data).returning();
    res.json({ ok: true, pitanje: inserted[0] });
  } catch (err) {
    console.error("[admin/igra-pitanja create] greška:", err);
    res.status(500).json({ error: "Greška pri kreiranju pitanja" });
  }
});

// PUT /admin/igra-pitanja/:id — update
router.put("/igra-pitanja/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Neispravan id" });
      return;
    }
    const v = validatePitanjeBody(req.body);
    if (!v.ok) {
      res.status(400).json({ error: v.error });
      return;
    }
    const updated = await db
      .update(igraPitanjaTable)
      .set({ ...v.data, updatedAt: new Date() })
      .where(eq(igraPitanjaTable.id, id))
      .returning();
    if (updated.length === 0) {
      res.status(404).json({ error: "Pitanje nije pronađeno" });
      return;
    }
    res.json({ ok: true, pitanje: updated[0] });
  } catch (err) {
    console.error("[admin/igra-pitanja update] greška:", err);
    res.status(500).json({ error: "Greška pri ažuriranju pitanja" });
  }
});

// DELETE /admin/igra-pitanja/:id — hard delete
router.delete("/igra-pitanja/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Neispravan id" });
      return;
    }
    const deleted = await db.delete(igraPitanjaTable).where(eq(igraPitanjaTable.id, id)).returning();
    if (deleted.length === 0) {
      res.status(404).json({ error: "Pitanje nije pronađeno" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[admin/igra-pitanja delete] greška:", err);
    res.status(500).json({ error: "Greška pri brisanju pitanja" });
  }
});

// === CSV import/export pitanja ================================================
// CSV format (UTF-8 + BOM za Excel):
//   kategorija,pitanje,opcija1,opcija2,opcija3,opcija4,correctIndex,objasnjenje,tezina,aktivno
// Vrijednosti u dvostrukim navodnicima, navodnik se escape-uje kao "" (RFC 4180).

const CSV_COLUMNS = [
  "kategorija", "pitanje", "opcija1", "opcija2", "opcija3", "opcija4",
  "correctIndex", "objasnjenje", "tezina", "aktivno",
] as const;

function csvEscape(val: string): string {
  if (/[",\n\r]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
  return val;
}

function rowsToCsv(rows: Array<Record<string, string>>): string {
  const lines: string[] = [];
  lines.push(CSV_COLUMNS.join(","));
  for (const r of rows) {
    lines.push(CSV_COLUMNS.map((c) => csvEscape(r[c] ?? "")).join(","));
  }
  // \r\n + UTF-8 BOM tako da Excel ispravno otvori dijakritike (š, č, ž).
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

// Parser RFC 4180 CSV-a. Vraća array redova (svaki red je array stringova).
function parseCsv(text: string): string[][] {
  // Skini opcioni BOM
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ",") { cur.push(field); field = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; i++; continue; }
    field += c; i++;
  }
  // Zadnji red bez terminatora
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  // Ukloni potpuno prazne redove (npr. trailing newline)
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ""));
}

// GET /admin/igra-pitanja/export.csv — sva pitanja kao CSV
router.get("/igra-pitanja/export.csv", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(igraPitanjaTable)
      .orderBy(asc(igraPitanjaTable.kategorija), asc(igraPitanjaTable.id));
    const out = rows.map((p) => {
      const opcije = Array.isArray(p.opcije) ? p.opcije : [];
      return {
        kategorija: p.kategorija,
        pitanje: p.pitanje,
        opcija1: opcije[0] ?? "",
        opcija2: opcije[1] ?? "",
        opcija3: opcije[2] ?? "",
        opcija4: opcije[3] ?? "",
        correctIndex: String(p.correctIndex),
        objasnjenje: p.objasnjenje ?? "",
        tezina: String(p.tezina),
        aktivno: p.aktivno ? "1" : "0",
      };
    });
    const csv = rowsToCsv(out);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="igra-pitanja-${stamp}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error("[admin/igra-pitanja/export] greška:", err);
    res.status(500).json({ error: "Greška pri izvozu CSV-a" });
  }
});

// POST /admin/igra-pitanja/import — multipart CSV upload
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.csv$/i.test(file.originalname)) cb(null, true);
    else cb(new Error("Dozvoljen je samo .csv fajl"));
  },
});

router.post("/igra-pitanja/import", (req, res) => {
  csvUpload.single("file")(req, res, async (err) => {
    if (err) {
      const msg = err instanceof multer.MulterError
        ? (err.code === "LIMIT_FILE_SIZE" ? "CSV prevelik (max 5MB)" : err.message)
        : err.message || "Greška pri uploadu";
      return res.status(400).json({ error: msg });
    }
    if (!req.file) return res.status(400).json({ error: "Nema fajla" });

    try {
      const text = req.file.buffer.toString("utf-8");
      const rows = parseCsv(text);
      if (rows.length === 0) return res.status(400).json({ error: "CSV je prazan" });

      const header = rows[0].map((h) => h.trim().toLowerCase());
      const idx: Record<string, number> = {};
      for (const col of CSV_COLUMNS) {
        const found = header.indexOf(col.toLowerCase());
        if (found === -1) {
          return res.status(400).json({ error: `Nedostaje kolona u CSV-u: ${col}` });
        }
        idx[col] = found;
      }

      let inserted = 0;
      let updated = 0;
      const errors: Array<{ red: number; razlog: string }> = [];

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const lineNum = r + 1; // 1-based + header
        const get = (c: string) => (row[idx[c]] ?? "").trim();

        const kategorija = get("kategorija");
        const pitanje = get("pitanje");
        const opcije = [get("opcija1"), get("opcija2"), get("opcija3"), get("opcija4")];
        const correctIndexStr = get("correctIndex");
        const objasnjenje = get("objasnjenje");
        const tezinaStr = get("tezina");
        const aktivnoStr = get("aktivno").toLowerCase();

        // Preskoči potpuno prazan red
        if (!kategorija && !pitanje && opcije.every((o) => !o)) continue;

        if (!KATEGORIJE_SET.has(kategorija)) {
          errors.push({ red: lineNum, razlog: `Neispravna kategorija "${kategorija}" (dozvoljene: ${MEDENA_KATEGORIJE.join(", ")})` });
          continue;
        }
        if (pitanje.length < 3 || pitanje.length > 500) {
          errors.push({ red: lineNum, razlog: "Pitanje mora imati 3–500 znakova" });
          continue;
        }
        if (opcije.some((o) => o.length === 0)) {
          errors.push({ red: lineNum, razlog: "Sve 4 opcije moraju biti popunjene" });
          continue;
        }
        if (opcije.some((o) => o.length > 200)) {
          errors.push({ red: lineNum, razlog: "Opcija je preduga (max 200 znakova)" });
          continue;
        }
        const correctIndex = Number(correctIndexStr);
        if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
          errors.push({ red: lineNum, razlog: "correctIndex mora biti 0–3" });
          continue;
        }
        let tezina = Number(tezinaStr);
        if (!Number.isInteger(tezina) || tezina < 1 || tezina > 3) tezina = 1;
        const aktivno = aktivnoStr === "" ? true : ["1", "true", "da", "yes"].includes(aktivnoStr);

        const values = {
          kategorija: kategorija as MedenaKategorija,
          pitanje,
          opcije,
          correctIndex,
          objasnjenje: objasnjenje.slice(0, 1000),
          tezina,
          aktivno,
        };

        try {
          // Deterministički: prvo provjeri postoji li red sa (kategorija, pitanje),
          // pa eksplicitno INSERT ili UPDATE — tako precizno brojimo dodano/ažurirano.
          const existing = await db
            .select({ id: igraPitanjaTable.id })
            .from(igraPitanjaTable)
            .where(and(
              eq(igraPitanjaTable.kategorija, values.kategorija),
              eq(igraPitanjaTable.pitanje, values.pitanje),
            ))
            .limit(1);
          if (existing.length > 0) {
            await db
              .update(igraPitanjaTable)
              .set({
                opcije: values.opcije,
                correctIndex: values.correctIndex,
                objasnjenje: values.objasnjenje,
                tezina: values.tezina,
                aktivno: values.aktivno,
                updatedAt: new Date(),
              })
              .where(eq(igraPitanjaTable.id, existing[0].id));
            updated++;
          } else {
            await db.insert(igraPitanjaTable).values(values);
            inserted++;
          }
        } catch (e: any) {
          errors.push({ red: lineNum, razlog: `DB greška: ${e?.message ?? String(e)}` });
        }
      }

      res.json({
        ok: true,
        inserted,
        updated,
        errorsCount: errors.length,
        errors: errors.slice(0, 50), // ograniči odgovor
      });
    } catch (e: any) {
      console.error("[admin/igra-pitanja/import] greška:", e);
      res.status(500).json({ error: "Greška pri obradi CSV-a", detail: e?.message ?? String(e) });
    }
    return;
  });
});

// GET /admin/statistika-sadrzaja — pregled završetaka i ocjena po lekciji i prilogu.
// Vraća { lekcije: [...], prilozi: [...] } — admin tab "Statistika sadržaja".
router.get("/statistika-sadrzaja", async (_req, res) => {
  try {
    const lekcijeRes: any = await db.execute(sql`
      SELECT
        l.id,
        l.naslov,
        l.nivo,
        l.slug,
        l.redoslijed,
        COALESCE(l.uvjeti_ids, '[]'::jsonb) AS uvjeti_ids,
        COALESCE(c.zavrseno, 0)::int AS zavrseno,
        COALESCE(o.avg_ocjena, 0)::float AS avg_ocjena,
        COALESCE(o.broj_ocjena, 0)::int AS broj_ocjena
      FROM ilmihal_lekcije l
      LEFT JOIN (
        SELECT content_id AS lekcija_id, COUNT(*)::int AS zavrseno
        FROM korisnik_napredak
        WHERE zavrsen = TRUE AND content_type = 'lekcija'
        GROUP BY content_id
      ) c ON c.lekcija_id = l.id
      LEFT JOIN (
        SELECT sadrzaj_id, AVG(ocjena)::float AS avg_ocjena, COUNT(*)::int AS broj_ocjena
        FROM ocjene_sadrzaja
        WHERE tip_sadrzaja = 'lekcija'
        GROUP BY sadrzaj_id
      ) o ON o.sadrzaj_id = l.id
      ORDER BY l.nivo NULLS LAST, l.redoslijed NULLS LAST, l.id;
    `);
    const priloziRes: any = await db.execute(sql`
      SELECT
        p.id,
        p.original_name AS naziv,
        p.kind,
        p.lekcija_id,
        l.naslov AS lekcija_naslov,
        l.nivo AS lekcija_nivo,
        COALESCE(ec.zavrseno, 0)::int AS zavrseno,
        COALESCE(o.avg_ocjena, 0)::float AS avg_ocjena,
        COALESCE(o.broj_ocjena, 0)::int AS broj_ocjena
      FROM prilozi p
      LEFT JOIN ilmihal_lekcije l ON l.id = p.lekcija_id
      LEFT JOIN (
        SELECT prilozi_id, COUNT(*)::int AS zavrseno
        FROM embed_completions GROUP BY prilozi_id
      ) ec ON ec.prilozi_id = p.id
      LEFT JOIN (
        SELECT sadrzaj_id, AVG(ocjena)::float AS avg_ocjena, COUNT(*)::int AS broj_ocjena
        FROM ocjene_sadrzaja
        WHERE tip_sadrzaja = 'prilog'
        GROUP BY sadrzaj_id
      ) o ON o.sadrzaj_id = p.id
      ORDER BY l.nivo NULLS LAST, p.lekcija_id, p.id;
    `);
    const kvizoviRes: any = await db.execute(sql`
      SELECT
        k.id,
        k.naslov,
        k.kategorija,
        COALESCE(kr.broj_pokusaja, 0)::int AS broj_pokusaja,
        COALESCE(kr.prosjek_postotak, 0)::float AS prosjek_postotak,
        COALESCE(o.avg_ocjena, 0)::float AS avg_ocjena,
        COALESCE(o.broj_ocjena, 0)::int AS broj_ocjena
      FROM kvizovi k
      LEFT JOIN (
        SELECT kviz_id, COUNT(*)::int AS broj_pokusaja,
               AVG(CASE WHEN ukupno_pitanja > 0 THEN (tacni_odgovori::float / ukupno_pitanja * 100) ELSE 0 END) AS prosjek_postotak
        FROM kviz_rezultati GROUP BY kviz_id
      ) kr ON kr.kviz_id = k.id
      LEFT JOIN (
        SELECT sadrzaj_id, AVG(ocjena)::float AS avg_ocjena, COUNT(*)::int AS broj_ocjena
        FROM ocjene_sadrzaja
        WHERE tip_sadrzaja = 'kviz'
        GROUP BY sadrzaj_id
      ) o ON o.sadrzaj_id = k.id
      ORDER BY k.kategorija, k.id;
    `);
    res.json({
      lekcije: lekcijeRes.rows ?? [],
      prilozi: priloziRes.rows ?? [],
      kvizovi: kvizoviRes.rows ?? [],
    });
  } catch (err: any) {
    console.error("[admin/statistika-sadrzaja] greška:", err);
    res.status(500).json({ error: "Greška servera", detail: err?.message });
  }
});

// POST /admin/system/seed-medena-pitanja — pokreni seed (160 pitanja)
router.post("/system/seed-medena-pitanja", async (_req, res) => {
  try {
    const { seedMedenaPitanja } = await import("@workspace/scripts/seed-medena-pitanja");
    const result = await seedMedenaPitanja();
    res.json({
      ok: true,
      message: `Učitano ${result.total} pitanja u banku.`,
      total: result.total,
      perKategorija: result.perKategorija,
    });
  } catch (err) {
    const e = err as Error;
    console.error("[admin/system/seed-medena-pitanja] greška:", err);
    res.status(500).json({ error: "Greška pri seed-u pitanja", detail: e?.message ?? String(err) });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Task #126 — Etape (medaljon kviz konfiguracija) + Krunisanja (CRUD)
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/admin/etape/nivo/:n — lista svih medaljona/etapa za jedan nivo
// sa pridruženim brojem pitanja i brojem polaganja (audit).
router.get("/etape/nivo/:n", async (req, res) => {
  try {
    const nivo = Number(req.params.n);
    if (!Number.isInteger(nivo) || nivo < 1 || nivo > 3) {
      return res.status(400).json({ error: "Nivo mora biti 1, 2 ili 3" });
    }
    const etape = await db
      .select()
      .from(medaljoniTable)
      .where(eq(medaljoniTable.nivo, nivo))
      .orderBy(asc(medaljoniTable.posAfterRedoslijed));
    res.json({ etape });
  } catch (err) {
    console.error("[admin/etape/nivo] error", err);
    res.status(500).json({ error: "Greška" });
  }
  return;
});

// GET /api/admin/etape/:medaljonId/banka — pitanja iz banke filtrirana po
// lekcijama koje pripadaju ovoj etapi (redoslijed u (prevPos, posAfterRedoslijed]
// istog nivoa). Koristi se u admin UI-ju za odabir pitanja umjesto ručnog
// unosa ID-jeva.
router.get("/etape/:medaljonId/banka", async (req, res) => {
  try {
    const id = Number(req.params.medaljonId);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid ID" });
    const [med] = await db.select().from(medaljoniTable).where(eq(medaljoniTable.id, id)).limit(1);
    if (!med) return res.status(404).json({ error: "Etapa ne postoji" });
    const [prev] = await db
      .select({ pos: medaljoniTable.posAfterRedoslijed })
      .from(medaljoniTable)
      .where(and(eq(medaljoniTable.nivo, med.nivo), lt(medaljoniTable.posAfterRedoslijed, med.posAfterRedoslijed)))
      .orderBy(desc(medaljoniTable.posAfterRedoslijed))
      .limit(1);
    const startPos = prev?.pos ?? -999999;
    const lekcije = await db
      .select({ id: ilmihalLekcijeTable.id, naslov: ilmihalLekcijeTable.naslov, redoslijed: ilmihalLekcijeTable.redoslijed })
      .from(ilmihalLekcijeTable)
      .where(and(
        eq(ilmihalLekcijeTable.nivo, med.nivo),
        gt(ilmihalLekcijeTable.redoslijed, startPos),
        lte(ilmihalLekcijeTable.redoslijed, med.posAfterRedoslijed),
      ))
      .orderBy(asc(ilmihalLekcijeTable.redoslijed));
    const lekcijaIds = lekcije.map((l) => l.id);
    const pitanja = lekcijaIds.length === 0 ? [] : await db
      .select({
        id: pitanjaBankaTable.id,
        pitanje: pitanjaBankaTable.pitanje,
        vrsta: pitanjaBankaTable.vrsta,
        lekcijaId: pitanjaBankaTable.lekcijaId,
      })
      .from(pitanjaBankaTable)
      .where(inArray(pitanjaBankaTable.lekcijaId, lekcijaIds))
      .orderBy(asc(pitanjaBankaTable.lekcijaId), asc(pitanjaBankaTable.id));
    res.json({ lekcije, pitanja });
  } catch (err) {
    console.error("[admin/etape/banka] error", err);
    res.status(500).json({ error: "Greška" });
  }
  return;
});

// GET /api/admin/krunisanja/:id/banka — pitanja iz banke za sve lekcije nivoa
// (krunisanje pokriva cijeli nivo).
router.get("/krunisanja/:id/banka", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid ID" });
    const [krun] = await db.select().from(krunisanjaTable).where(eq(krunisanjaTable.id, id)).limit(1);
    if (!krun) return res.status(404).json({ error: "Krunisanje ne postoji" });
    const lekcije = await db
      .select({ id: ilmihalLekcijeTable.id, naslov: ilmihalLekcijeTable.naslov, redoslijed: ilmihalLekcijeTable.redoslijed })
      .from(ilmihalLekcijeTable)
      .where(eq(ilmihalLekcijeTable.nivo, krun.nivo))
      .orderBy(asc(ilmihalLekcijeTable.redoslijed));
    const lekcijaIds = lekcije.map((l) => l.id);
    const pitanja = lekcijaIds.length === 0 ? [] : await db
      .select({
        id: pitanjaBankaTable.id,
        pitanje: pitanjaBankaTable.pitanje,
        vrsta: pitanjaBankaTable.vrsta,
        lekcijaId: pitanjaBankaTable.lekcijaId,
      })
      .from(pitanjaBankaTable)
      .where(inArray(pitanjaBankaTable.lekcijaId, lekcijaIds))
      .orderBy(asc(pitanjaBankaTable.lekcijaId), asc(pitanjaBankaTable.id));
    res.json({ lekcije, pitanja });
  } catch (err) {
    console.error("[admin/krunisanja/banka] error", err);
    res.status(500).json({ error: "Greška" });
  }
  return;
});

// PUT /api/admin/etape/:medaljonId — ažuriraj konfiguraciju kviza za etapu
// Body: { kvizPitanjaIds?: number[], pragProlazaPercent?: number, isGating?: boolean,
//         naziv?: string, opis?: string, contentHtml?: string }
router.put("/etape/:medaljonId", async (req, res) => {
  try {
    const id = Number(req.params.medaljonId);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid ID" });
    const patch: Partial<typeof medaljoniTable.$inferInsert> = {};
    if (Array.isArray(req.body?.kvizPitanjaIds)) {
      patch.kvizPitanjaIds = req.body.kvizPitanjaIds.map((x: unknown) => Number(x)).filter((n: number) => Number.isInteger(n));
    }
    if (typeof req.body?.pragProlazaPercent === "number") {
      patch.pragProlazaPercent = Math.max(0, Math.min(100, Math.round(req.body.pragProlazaPercent)));
    }
    if (typeof req.body?.isGating === "boolean") patch.isGating = req.body.isGating;
    if (typeof req.body?.naziv === "string") patch.naziv = req.body.naziv;
    if (typeof req.body?.opis === "string") patch.opis = req.body.opis;
    if (typeof req.body?.contentHtml === "string") patch.contentHtml = req.body.contentHtml;
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: "Nema polja za update" });
    const [updated] = await db
      .update(medaljoniTable)
      .set(patch)
      .where(eq(medaljoniTable.id, id))
      .returning();
    res.json({ ok: true, etapa: updated });
  } catch (err) {
    console.error("[admin/etape/put] error", err);
    res.status(500).json({ error: "Greška" });
  }
  return;
});

// GET /api/admin/krunisanja/nivo/:n — vrati krunisanje + krunske lekcije za nivo
router.get("/krunisanja/nivo/:n", async (req, res) => {
  try {
    const nivo = Number(req.params.n);
    if (!Number.isInteger(nivo) || nivo < 1 || nivo > 3) {
      return res.status(400).json({ error: "Nivo mora biti 1, 2 ili 3" });
    }
    const [krunisanje] = await db
      .select()
      .from(krunisanjaTable)
      .where(eq(krunisanjaTable.nivo, nivo))
      .limit(1);
    if (!krunisanje) return res.status(404).json({ error: "Krunisanje ne postoji (seed-uje se na restartu)" });
    const lekcije = await db
      .select()
      .from(krunisanjeLekcijeTable)
      .where(eq(krunisanjeLekcijeTable.krunisanjeId, krunisanje.id))
      .orderBy(asc(krunisanjeLekcijeTable.redoslijed));
    res.json({ krunisanje, lekcije });
  } catch (err) {
    console.error("[admin/krunisanja/nivo] error", err);
    res.status(500).json({ error: "Greška" });
  }
  return;
});

// PUT /api/admin/krunisanja/:id — update konfiguracije krunisanja
router.put("/krunisanja/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid ID" });
    const patch: Partial<typeof krunisanjaTable.$inferInsert> = {};
    if (typeof req.body?.naslov === "string") patch.naslov = req.body.naslov;
    if (typeof req.body?.opisHtml === "string") patch.opisHtml = req.body.opisHtml;
    if (typeof req.body?.ikona === "string") patch.ikona = req.body.ikona;
    if (typeof req.body?.boja === "string") patch.boja = req.body.boja;
    if (Array.isArray(req.body?.kvizPitanjaIds)) {
      patch.kvizPitanjaIds = req.body.kvizPitanjaIds.map((x: unknown) => Number(x)).filter((n: number) => Number.isInteger(n));
    }
    if (typeof req.body?.pragProlazaPercent === "number") {
      patch.pragProlazaPercent = Math.max(0, Math.min(100, Math.round(req.body.pragProlazaPercent)));
    }
    if (typeof req.body?.isGating === "boolean") patch.isGating = req.body.isGating;
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: "Nema polja za update" });
    const [updated] = await db
      .update(krunisanjaTable)
      .set(patch)
      .where(eq(krunisanjaTable.id, id))
      .returning();
    res.json({ ok: true, krunisanje: updated });
  } catch (err) {
    console.error("[admin/krunisanja/put] error", err);
    res.status(500).json({ error: "Greška" });
  }
  return;
});

// POST /api/admin/krunisanja/:id/lekcije — kreiraj krunsku lekciju
router.post("/krunisanja/:id/lekcije", async (req, res) => {
  try {
    const krunisanjeId = Number(req.params.id);
    const naslov: string = String(req.body?.naslov || "").trim();
    if (!naslov) return res.status(400).json({ error: "Naslov je obavezan" });
    const slug: string =
      String(req.body?.slug || "").trim() ||
      `krunisanje-${krunisanjeId}-${naslov
        .toLowerCase()
        .replace(/[čć]/g, "c")
        .replace(/[š]/g, "s")
        .replace(/[ž]/g, "z")
        .replace(/[đ]/g, "d")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60)}-${Date.now().toString().slice(-6)}`;
    const redoslijed = Number(req.body?.redoslijed ?? 100);
    const [lekcija] = await db
      .insert(krunisanjeLekcijeTable)
      .values({
        krunisanjeId,
        slug,
        naslov,
        contentHtml: String(req.body?.contentHtml ?? ""),
        redoslijed,
        isPublished: req.body?.isPublished !== false,
      })
      .returning();
    res.json({ ok: true, lekcija });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin/krunisanja/lekcije/post] error", err);
    res.status(500).json({ error: msg.includes("unique") ? "Slug već postoji" : "Greška pri kreiranju" });
  }
  return;
});

// PUT /api/admin/krunisanja/lekcije/:lekcijaId
router.put("/krunisanja/lekcije/:lekcijaId", async (req, res) => {
  try {
    const id = Number(req.params.lekcijaId);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid ID" });
    const patch: Partial<typeof krunisanjeLekcijeTable.$inferInsert> = {};
    if (typeof req.body?.naslov === "string") patch.naslov = req.body.naslov;
    if (typeof req.body?.contentHtml === "string") patch.contentHtml = req.body.contentHtml;
    if (typeof req.body?.redoslijed === "number") patch.redoslijed = req.body.redoslijed;
    if (typeof req.body?.isPublished === "boolean") patch.isPublished = req.body.isPublished;
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: "Nema polja za update" });
    const [updated] = await db
      .update(krunisanjeLekcijeTable)
      .set(patch)
      .where(eq(krunisanjeLekcijeTable.id, id))
      .returning();
    res.json({ ok: true, lekcija: updated });
  } catch (err) {
    console.error("[admin/krunisanja/lekcije/put] error", err);
    res.status(500).json({ error: "Greška" });
  }
  return;
});

// DELETE /api/admin/krunisanja/lekcije/:lekcijaId
router.delete("/krunisanja/lekcije/:lekcijaId", async (req, res) => {
  try {
    const id = Number(req.params.lekcijaId);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid ID" });
    await db.delete(krunisanjeLekcijeTable).where(eq(krunisanjeLekcijeTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("[admin/krunisanja/lekcije/delete] error", err);
    res.status(500).json({ error: "Greška" });
  }
  return;
});

// Suppressors za nove tabele importovane ali korištene samo u join statistici (kasnije)
void etapaPolaganjaTable;
void studentKrunisanjaTable;

// POST /api/admin/sync-kvizovi-jsonb-u-banku?dryRun=1 — jednokratni backfill:
// uzima izmjene iz legacy `kvizovi.pitanja` JSONB-a (gdje je admin uređivao
// kroz stari "Uredi kviz" modal) i prepisuje ih u `pitanja_banka`. Vidi
// scripts/src/sync-kvizovi-jsonb-u-banku.ts za detalje algoritma.
router.post("/sync-kvizovi-jsonb-u-banku", async (req, res) => {
  try {
    const dryRun = req.query["dryRun"] === "1" || req.query["dryRun"] === "true";
    const { syncKvizoviUBanku } = await import("@workspace/scripts/sync-kvizovi-jsonb-u-banku");
    const result = await syncKvizoviUBanku({ silent: true, dryRun, skipBackup: true });
    res.json({ ok: true, dryRun, result });
  } catch (err: any) {
    console.error("[admin/sync-kvizovi-jsonb-u-banku] error", err);
    res.status(500).json({ error: err?.message || "Greška" });
  }
});

// ========================================================================
// PRIJEVODI — admin uređivanje UI (interfejs) i sadržaja bez diranja koda.
// Sve rute su admin-only (guard na vrhu fajla dozvoljava muallima samo za
// /prilozi i /upload). UI override-i idu u ui_prijevodi (po jezik+kljuc), a
// sadržaj se uređuje direktno u content_prijevodi.
// ========================================================================
const PRIJEVOD_JEZICI = new Set(["sq", "de", "en", "tr", "ar"]);

// --- UI/interfejs override-i ---
router.get("/prijevodi/ui", async (_req, res) => {
  try {
    const result = (await db.execute(
      sql`SELECT jezik, kljuc, prijevod FROM ui_prijevodi ORDER BY jezik, kljuc`,
    )) as unknown as { rows: { jezik: string; kljuc: string; prijevod: string }[] };
    res.json({ rows: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Greška" });
  }
});

router.post("/prijevodi/ui", async (req, res) => {
  try {
    const jezik = String(req.body?.jezik || "").toLowerCase().trim();
    const kljuc = String(req.body?.kljuc ?? "");
    const prijevod = String(req.body?.prijevod ?? "");
    if (!PRIJEVOD_JEZICI.has(jezik)) return res.status(400).json({ error: "Nepoznat jezik" });
    if (!kljuc) return res.status(400).json({ error: "Ključ je obavezan" });
    if (!prijevod.trim()) return res.status(400).json({ error: "Prijevod ne smije biti prazan" });
    await db.execute(sql`
      INSERT INTO ui_prijevodi (jezik, kljuc, prijevod, updated_at)
      VALUES (${jezik}, ${kljuc}, ${prijevod}, NOW())
      ON CONFLICT (jezik, kljuc) DO UPDATE SET prijevod = EXCLUDED.prijevod, updated_at = NOW()
    `);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Greška" });
  }
  return;
});

// Ukloni override → UI se vraća na bundlani locale prijevod.
router.delete("/prijevodi/ui", async (req, res) => {
  try {
    const jezik = String(req.body?.jezik || "").toLowerCase().trim();
    const kljuc = String(req.body?.kljuc ?? "");
    if (!jezik || !kljuc) return res.status(400).json({ error: "Jezik i ključ su obavezni" });
    await db.execute(sql`DELETE FROM ui_prijevodi WHERE jezik = ${jezik} AND kljuc = ${kljuc}`);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Greška" });
  }
  return;
});

// --- Sadržaj (content_prijevodi) ---
// Pretraga po prevedenom tekstu; vraća snippet + bosanski izvor (radi konteksta).
router.get("/prijevodi/content", async (req, res) => {
  try {
    const lang = String(req.query["lang"] || "").toLowerCase().trim();
    const q = String(req.query["q"] || "").trim();
    const limit = Math.min(Number(req.query["limit"]) || 100, 300);
    if (!PRIJEVOD_JEZICI.has(lang)) return res.status(400).json({ error: "Nepoznat jezik" });
    if (q.length < 2) return res.json({ rows: [] });
    const like = `%${q}%`;
    const result = (await db.execute(sql`
      SELECT id, tabela, red_id, polje, LEFT(prijevod, 240) AS snippet, LENGTH(prijevod) AS len
      FROM content_prijevodi
      WHERE jezik = ${lang} AND prijevod ILIKE ${like}
      ORDER BY tabela, red_id
      LIMIT ${limit}
    `)) as unknown as { rows: { id: number; tabela: string; red_id: number; polje: string; snippet: string; len: number }[] };
    const rows = result.rows;

    // Dohvati bosanski izvor po grupama tabela (kolone whitelistane preko CT_TABLES).
    const byTabela = new Map<string, Set<number>>();
    for (const r of rows) {
      if (!CT_TABLES[r.tabela]) continue;
      let s = byTabela.get(r.tabela);
      if (!s) { s = new Set(); byTabela.set(r.tabela, s); }
      s.add(r.red_id);
    }
    const izvorMap = new Map<string, Map<number, Record<string, string>>>();
    for (const [tabela, idSet] of byTabela) {
      const cfg = CT_TABLES[tabela];
      if (!cfg) continue;
      const cols = cfg.fields.map((f) => f.col);
      const colSel = sql.join(cols.map((c) => sql.raw(`"${c}"`)), sql`, `);
      const idList = sql.join([...idSet].map((i) => sql`${i}`), sql`, `);
      const sres = (await db.execute(
        sql`SELECT id, ${colSel} FROM ${sql.raw(`"${tabela}"`)} WHERE id IN (${idList})`,
      )) as unknown as { rows: Record<string, unknown>[] };
      const m = new Map<number, Record<string, string>>();
      for (const sr of sres.rows) {
        const rec: Record<string, string> = {};
        for (const c of cols) rec[c] = sr[c] == null ? "" : String(sr[c]);
        m.set(Number(sr["id"]), rec);
      }
      izvorMap.set(tabela, m);
    }
    const enriched = rows.map((r) => ({
      id: r.id,
      tabela: r.tabela,
      redId: r.red_id,
      polje: r.polje,
      snippet: r.snippet,
      len: Number(r.len),
      izvor: (izvorMap.get(r.tabela)?.get(r.red_id)?.[r.polje] ?? "").slice(0, 240),
    }));
    res.json({ rows: enriched });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Greška" });
  }
  return;
});

// Pun red (prijevod + izvor) za uređivanje.
router.get("/prijevodi/content/:id", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Neispravan ID" });
    const result = (await db.execute(
      sql`SELECT id, tabela, red_id, polje, jezik, prijevod FROM content_prijevodi WHERE id = ${id}`,
    )) as unknown as { rows: { id: number; tabela: string; red_id: number; polje: string; jezik: string; prijevod: string }[] };
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: "Nije pronađeno" });
    let izvor = "";
    const cfg = CT_TABLES[row.tabela];
    if (cfg && cfg.fields.some((f) => f.col === row.polje)) {
      const sres = (await db.execute(
        sql`SELECT ${sql.raw(`"${row.polje}"`)} AS v FROM ${sql.raw(`"${row.tabela}"`)} WHERE id = ${row.red_id}`,
      )) as unknown as { rows: { v: unknown }[] };
      izvor = sres.rows[0]?.v == null ? "" : String(sres.rows[0].v);
    }
    res.json({ ...row, redId: row.red_id, izvor });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Greška" });
  }
  return;
});

router.put("/prijevodi/content/:id", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Neispravan ID" });
    const prijevod = String(req.body?.prijevod ?? "");
    if (!prijevod.trim()) return res.status(400).json({ error: "Prijevod ne smije biti prazan" });
    const upd = (await db.execute(
      sql`UPDATE content_prijevodi SET prijevod = ${prijevod}, updated_at = NOW() WHERE id = ${id} RETURNING id`,
    )) as unknown as { rows: { id: number }[] };
    if (upd.rows.length === 0) return res.status(404).json({ error: "Nije pronađeno" });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Greška" });
  }
  return;
});

// ── ZVJEZDICE KATEGORIJE ─────────────────────────────────────────────────────
// Admin definira listu razloga/kategorija za dodjelu zvjezdica.
// Muallim ih bira u dropdownu na kartici učenika.

router.get("/zvjezdice-kategorije", async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT id, tip, naziv, redoslijed FROM zvjezdice_kategorije ORDER BY tip, redoslijed, naziv
    `);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Greška" });
  }
});

router.post("/zvjezdice-kategorije", async (req, res) => {
  try {
    const { tip, naziv } = req.body;
    if (!["pozitivna", "negativna"].includes(tip) || !naziv?.trim()) {
      return res.status(400).json({ error: "Neispravan tip ili naziv" });
    }
    const result = await db.execute(sql`
      INSERT INTO zvjezdice_kategorije (tip, naziv) VALUES (${tip}, ${naziv.trim()})
      RETURNING id, tip, naziv, redoslijed
    `);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Greška" });
  }
  return;
});

router.delete("/zvjezdice-kategorije/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.execute(sql`DELETE FROM zvjezdice_kategorije WHERE id = ${id}`);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Greška" });
  }
});

export default router;
