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
} from "@workspace/db/schema";
import { eq, desc, asc, sql, gte, inArray, and, isNotNull, or } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth, requireRole("admin"));

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
      const [inserted] = await db.insert(prilozi).values({
        lekcijaId,
        originalName: req.file.originalname,
        storedName: req.file.filename,
        fileSize: req.file.size,
        mimeType: mimeMap[ext] || "application/octet-stream",
      }).returning();
      res.json(inserted);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
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
    const [inserted] = await db.insert(prilozi).values({
      lekcijaId,
      originalName: displayName,
      storedName: "",
      fileSize: 0,
      mimeType,
      kind: "url",
      externalUrl: url,
    }).returning();
    res.json(inserted);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
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

router.get("/prilozi/download/:id", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Neautorizovan pristup" });
    const jwt = await import("jsonwebtoken");
    const token = authHeader.replace("Bearer ", "");
    const decoded = jwt.default.verify(token, process.env.JWT_SECRET || "mekteb-secret-change-in-production") as any;
    if (decoded.role !== "admin" && decoded.role !== "muallim") {
      return res.status(403).json({ error: "Samo muallimi i admini mogu pristupiti materijalima" });
    }
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Nevažeći ID" });
    const [file] = await db.select().from(prilozi).where(eq(prilozi.id, id));
    if (!file) return res.status(404).json({ error: "Prilog nije pronađen" });
    const filePath = path.join(uploadsDir, file.storedName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Fajl nije pronađen na serveru" });
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.originalName)}"`);
    res.setHeader("Content-Type", file.mimeType);
    res.sendFile(filePath);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
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
      const [pre] = await db.insert(prilozi).values({
        lekcijaId,
        originalName: req.file.originalname,
        storedName: "h5p/pending",
        fileSize: req.file.size,
        mimeType: "application/x-h5p",
        kind: "h5p",
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
  });
});

router.delete("/prilozi/:id", async (req, res) => {
  try {
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
      let newHtml: string;

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
    res.json(profili);
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
    if (isActive !== undefined) updates.isActive = isActive;
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
      }
    }

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

router.post("/ilmihal", async (req, res) => {
  try {
    const { naslov, slug, nivo, redoslijed, contentHtml, kvizPitanja } = req.body;
    if (!naslov || !slug) return res.status(400).json({ error: "naslov and slug required" });
    const kviz = kvizPitanja ? (typeof kvizPitanja === "string" ? kvizPitanja : JSON.stringify(kvizPitanja)) : null;
    const [row] = await db.insert(ilmihalLekcijeTable).values({
      naslov, slug, nivo: nivo || 2, redoslijed: redoslijed || 0,
      contentHtml: contentHtml || "", kvizPitanja: kviz,
    }).returning({ id: ilmihalLekcijeTable.id });
    res.json({ success: true, id: row.id });
  } catch (err) {
    console.error("POST /ilmihal error:", err);
    res.status(500).json({ error: "Greška pri kreiranju lekcije" });
  }
});

router.put("/ilmihal/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { contentHtml, naslov, kvizPitanja, redoslijed, forceUnlock } = req.body;
    const [existing] = await db.select().from(ilmihalLekcijeTable).where(eq(ilmihalLekcijeTable.id, id));
    if (!existing) return res.status(404).json({ error: "Lekcija nije pronađena" });
    if (existing.locked && contentHtml !== undefined && !forceUnlock) {
      return res.status(423).json({ error: "Lekcija je zaključana. Otključajte je prije izmjene sadržaja.", locked: true });
    }
    const updates: Record<string, any> = {};
    if (contentHtml !== undefined) {
      // Auto-clean before save: remove duplicate priprema accordions, upgrade old design.
      const { regeneratePripremaInHtml } = await import("../lib/priprema-render.js");
      updates.contentHtml = regeneratePripremaInHtml(contentHtml);
    }
    if (naslov !== undefined) updates.naslov = naslov;
    if (redoslijed !== undefined) updates.redoslijed = redoslijed;
    if (kvizPitanja !== undefined) {
      updates.kvizPitanja = typeof kvizPitanja === "string" ? kvizPitanja : JSON.stringify(kvizPitanja);
    }
    await db.update(ilmihalLekcijeTable).set(updates).where(eq(ilmihalLekcijeTable.id, id));
    res.json({ success: true });
  } catch (err: any) {
    console.error("PUT /ilmihal/:id error:", err?.message, err?.stack);
    res.status(500).json({ error: "Greška servera", detail: err?.message });
  }
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
});

// POST /api/admin/ilmihal/restore-from-prod-seed
// Legacy: vrati content_html / naslov / audio / kviz iz seed snapshot-a.
// MATCH PO SLUG-u. NE dira `nivo` ni `redoslijed`. PRESKAČE sve lekcije gdje je locked = true.
router.post("/ilmihal/restore-from-prod-seed", async (req, res) => {
  try {
    const { dryRun, confirm } = (req.body || {}) as { dryRun?: boolean; confirm?: string };
    const { FULL_LEKCIJE } = await import("./full-data-seed.js");
    const REQUIRED_CONFIRM = "RESTORE-228-LESSONS";
    if (!dryRun && confirm !== REQUIRED_CONFIRM) {
      return res.status(400).json({
        error: "Potvrda je obavezna",
        detail: `Ovaj endpoint može pregaziti sadržaj svih ${FULL_LEKCIJE.length} lekcija (osim zaključanih). Da bi nastavio, pošalji u body-ju: { "confirm": "${REQUIRED_CONFIRM}" }. Za probni run bez izmjena pošalji { "dryRun": true }.`,
        requiredConfirm: REQUIRED_CONFIRM,
      });
    }
    const existing = await db.select({
      id: ilmihalLekcijeTable.id,
      slug: ilmihalLekcijeTable.slug,
      locked: ilmihalLekcijeTable.locked,
    }).from(ilmihalLekcijeTable);
    const bySlug = new Map(existing.map(r => [r.slug, r]));
    let updated = 0, skippedLocked = 0, notFound: string[] = [];
    for (const lek of FULL_LEKCIJE) {
      const row = bySlug.get(lek.slug);
      if (!row) { notFound.push(lek.slug); continue; }
      if (row.locked) { skippedLocked++; continue; }
      if (!dryRun) {
        await db.update(ilmihalLekcijeTable).set({
          naslov: lek.naslov,
          contentHtml: lek.content_html,
          audioSrc: lek.audio_src,
          kvizPitanja: lek.kviz_pitanja,
        }).where(eq(ilmihalLekcijeTable.id, row.id));
      }
      updated++;
    }
    res.json({
      success: true, dryRun: !!dryRun,
      seedTotal: FULL_LEKCIJE.length, dbTotal: existing.length,
      updated, skippedLocked,
      notFoundCount: notFound.length, notFound: notFound.slice(0, 20),
      note: "nivo i redoslijed nisu dirani; samo content_html, naslov, audio_src, kviz_pitanja",
    });
  } catch (err: any) {
    res.status(500).json({ error: "Restore failed", detail: err?.message });
  }
});

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

// POST /api/admin/ilmihal/sync-from-seed
// FULL UPSERT iz aktuelnog full-data-seed.ts (228 lekcija iz DEV baze):
//   - INSERT lekcije koje fale (slug ne postoji u prod bazi)
//   - UPDATE postojeće (sadržaj + nivo + redoslijed + naslov + audio + kviz) ALI samo gdje locked = false
//   - SKIP lekcije gdje je locked = true (ručno verifikovan sadržaj — sveto)
// Vraća detaljan izvještaj: koliko inserted, updated, skippedLocked, po nivoima.
router.post("/ilmihal/sync-from-seed", async (req, res) => {
  try {
    const { dryRun, syncRjecnik } = (req.body || {}) as { dryRun?: boolean; syncRjecnik?: boolean };
    const { FULL_LEKCIJE, FULL_RJECNIK } = await import("./full-data-seed.js");
    const existing = await db.select({
      id: ilmihalLekcijeTable.id,
      slug: ilmihalLekcijeTable.slug,
      locked: ilmihalLekcijeTable.locked,
    }).from(ilmihalLekcijeTable);
    const bySlug = new Map(existing.map(r => [r.slug, r]));
    let inserted = 0, updated = 0, skippedLocked = 0;
    const insertedSlugs: string[] = [];
    const insertedByNivo: Record<number, number> = {};
    for (const lek of FULL_LEKCIJE) {
      const row = bySlug.get(lek.slug);
      if (!row) {
        if (!dryRun) {
          await db.insert(ilmihalLekcijeTable).values({
            nivo: lek.nivo,
            slug: lek.slug,
            naslov: lek.naslov,
            contentHtml: lek.content_html,
            audioSrc: lek.audio_src,
            redoslijed: lek.redoslijed,
            isPublished: lek.is_published,
            kvizPitanja: lek.kviz_pitanja,
          });
        }
        inserted++;
        insertedSlugs.push(lek.slug);
        insertedByNivo[lek.nivo] = (insertedByNivo[lek.nivo] || 0) + 1;
        continue;
      }
      if (row.locked) { skippedLocked++; continue; }
      if (!dryRun) {
        await db.update(ilmihalLekcijeTable).set({
          nivo: lek.nivo,
          naslov: lek.naslov,
          contentHtml: lek.content_html,
          audioSrc: lek.audio_src,
          redoslijed: lek.redoslijed,
          isPublished: lek.is_published,
          kvizPitanja: lek.kviz_pitanja,
        }).where(eq(ilmihalLekcijeTable.id, row.id));
      }
      updated++;
    }

    let rjecnikInserted = 0;
    if (syncRjecnik) {
      for (const r of FULL_RJECNIK) {
        if (!dryRun) {
          const ins = (await db.execute(sql`
            INSERT INTO rjecnik (rijec, definicija)
            VALUES (${r.rijec}, ${r.definicija})
            ON CONFLICT (rijec) DO NOTHING
            RETURNING id
          `)) as unknown as { rows: { id: number }[] };
          if (ins.rows.length > 0) rjecnikInserted++;
        }
      }
    }

    res.json({
      success: true, dryRun: !!dryRun,
      seedTotal: FULL_LEKCIJE.length,
      dbTotalBefore: existing.length,
      inserted, updated, skippedLocked,
      insertedByNivo,
      insertedSlugs: insertedSlugs.slice(0, 50),
      rjecnik: syncRjecnik ? { seedTotal: FULL_RJECNIK.length, inserted: rjecnikInserted } : null,
      note: "Locked lekcije su preskočene. Insertovane su one koje su falile.",
    });
  } catch (err) {
    console.error("sync-from-seed error", err);
    res.status(500).json({ error: "Sync failed", detail: err instanceof Error ? err.message : String(err) });
  }
});

// POST /api/admin/ilmihal/restore-diac
// Jednokratni restore: učita restore-diac-31.json i UPSERTuje content_html
// za 31 lekciju kojima su nestale kvačice. Skipuje locked.
router.post("/ilmihal/restore-diac", async (req, res) => {
  try {
    const { dryRun, force } = (req.body || {}) as { dryRun?: boolean; force?: boolean };
    const fs = await import("fs");
    const path = await import("path");
    const url = await import("url");
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    // Try multiple candidate locations (dev: src/routes, prod: dist)
    const candidates = [
      path.resolve(here, "restore-diac-31.json"),
      path.resolve(here, "routes/restore-diac-31.json"),
      path.resolve(here, "../routes/restore-diac-31.json"),
      path.resolve(here, "../../src/routes/restore-diac-31.json"),
      path.resolve(process.cwd(), "dist/routes/restore-diac-31.json"),
      path.resolve(process.cwd(), "src/routes/restore-diac-31.json"),
      path.resolve(process.cwd(), "artifacts/api-server/dist/routes/restore-diac-31.json"),
      path.resolve(process.cwd(), "artifacts/api-server/src/routes/restore-diac-31.json"),
    ];
    let raw: string | null = null;
    for (const p of candidates) {
      if (fs.existsSync(p)) { raw = fs.readFileSync(p, "utf8"); break; }
    }
    if (!raw) throw new Error("restore-diac-31.json not found in any candidate path");
    const data = JSON.parse(raw) as Array<{ slug: string; content_html: string }>;
    const existing = await db.select({
      id: ilmihalLekcijeTable.id,
      slug: ilmihalLekcijeTable.slug,
      locked: ilmihalLekcijeTable.locked,
      contentHtml: ilmihalLekcijeTable.contentHtml,
    }).from(ilmihalLekcijeTable);
    const bySlug = new Map(existing.map(r => [r.slug, r]));
    let updated = 0, skippedLocked = 0, missing = 0;
    const report: Array<{ slug: string; oldDiac: number; newDiac: number; status: string }> = [];
    for (const lek of data) {
      const row = bySlug.get(lek.slug);
      const newDiac = (lek.content_html.match(/[čćšžđČĆŠŽĐ]/g) || []).length;
      if (!row) { missing++; report.push({ slug: lek.slug, oldDiac: 0, newDiac, status: "MISSING" }); continue; }
      const oldDiac = (row.contentHtml?.match(/[čćšžđČĆŠŽĐ]/g) || []).length;
      if (row.locked && !force) { skippedLocked++; report.push({ slug: lek.slug, oldDiac, newDiac, status: "LOCKED" }); continue; }
      if (!dryRun) {
        await db.update(ilmihalLekcijeTable)
          .set({ contentHtml: lek.content_html })
          .where(eq(ilmihalLekcijeTable.id, row.id));
      }
      updated++;
      report.push({ slug: lek.slug, oldDiac, newDiac, status: dryRun ? "WOULD-UPDATE" : "UPDATED" });
    }
    res.json({ success: true, dryRun: !!dryRun, total: data.length, updated, skippedLocked, missing, report });
  } catch (err) {
    console.error("restore-diac error", err);
    res.status(500).json({ error: "Restore failed", detail: err instanceof Error ? err.message : String(err) });
  }
});

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
});

// PUT /api/admin/kvizovi/:id — Update quiz questions/title
router.put("/kvizovi/:id", async (req, res) => {
  try {
    const { pitanja, naslov, isPublished } = req.body;
    const updates: Record<string, any> = {};
    if (pitanja !== undefined) {
      updates.pitanja = typeof pitanja === "string" ? pitanja : JSON.stringify(pitanja);
    }
    if (naslov !== undefined) updates.naslov = naslov;
    if (isPublished !== undefined) updates.isPublished = isPublished;
    await db.update(kvizoviTable).set(updates).where(eq(kvizoviTable.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (err) {
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

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const registracijePoMjesecu = await safe("registracijePoMjesecu", () =>
    db.select({
      datum: sql<string>`to_char(${usersTable.createdAt}, 'YYYY-MM-DD')`,
      broj: sql<number>`count(*)::int`,
    }).from(usersTable)
      .where(gte(usersTable.createdAt, thirtyDaysAgo))
      .groupBy(sql`to_char(${usersTable.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${usersTable.createdAt}, 'YYYY-MM-DD')`),
    [] as { datum: string; broj: number }[],
  );

  const posjetePoDrzavi = await safe("posjetePoDrzavi", () =>
    db.select({
      country: posjeteTable.country,
      broj: sql<number>`count(*)::int`,
    }).from(posjeteTable)
      .where(and(gte(posjeteTable.createdAt, thirtyDaysAgo), isNotNull(posjeteTable.country)))
      .groupBy(posjeteTable.country)
      .orderBy(sql`count(*) desc`)
      .limit(20),
    [] as { country: string | null; broj: number }[],
  );

  const aktivnostPosmjenama = await safe("aktivnostPosmjenama", () =>
    db.select({
      datum: sql<string>`to_char(${posjeteTable.createdAt}, 'YYYY-MM-DD')`,
      broj: sql<number>`count(*)::int`,
    }).from(posjeteTable)
      .where(gte(posjeteTable.createdAt, thirtyDaysAgo))
      .groupBy(sql`to_char(${posjeteTable.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${posjeteTable.createdAt}, 'YYYY-MM-DD')`),
    [] as { datum: string; broj: number }[],
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
    registracijePoMjesecu,
    posjetePoDrzavi,
    kvizRezultati,
    aktivnostPosmjenama,
    korisnikStats,
    nedavniRezultati,
    ...(Object.keys(errors).length > 0 ? { _errors: errors } : {}),
  });
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
    }).from(usersTable).where(eq(usersTable.role, "muallim")).orderBy(usersTable.displayName);

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

export default router;
