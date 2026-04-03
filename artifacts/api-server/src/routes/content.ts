import { Router } from "express";
import { db } from "@workspace/db";
import {
  ilmihalLekcijeTable,
  kvizoviTable,
  knjige,
  korisnikNapredakTable,
  kvizRezultatiTable,
  prilozi,
} from "@workspace/db/schema";
import { eq, and, asc, desc, gte, lte } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

// ── ILMIHAL ────────────────────────────────────────────────────────────────────

// GET /api/content/ilmihal?nivo=1
router.get("/ilmihal", async (req, res) => {
  try {
    const nivo = req.query.nivo ? parseInt(req.query.nivo as string) : undefined;
    let lekcije;
    if (nivo) {
      lekcije = await db.select({
        id: ilmihalLekcijeTable.id,
        nivo: ilmihalLekcijeTable.nivo,
        slug: ilmihalLekcijeTable.slug,
        naslov: ilmihalLekcijeTable.naslov,
        redoslijed: ilmihalLekcijeTable.redoslijed,
        audioSrc: ilmihalLekcijeTable.audioSrc,
        isPublished: ilmihalLekcijeTable.isPublished,
      }).from(ilmihalLekcijeTable).where(eq(ilmihalLekcijeTable.nivo, nivo)).orderBy(asc(ilmihalLekcijeTable.redoslijed));
    } else {
      lekcije = await db.select({
        id: ilmihalLekcijeTable.id,
        nivo: ilmihalLekcijeTable.nivo,
        slug: ilmihalLekcijeTable.slug,
        naslov: ilmihalLekcijeTable.naslov,
        redoslijed: ilmihalLekcijeTable.redoslijed,
        audioSrc: ilmihalLekcijeTable.audioSrc,
        isPublished: ilmihalLekcijeTable.isPublished,
      }).from(ilmihalLekcijeTable).orderBy(asc(ilmihalLekcijeTable.redoslijed));
    }
    res.json(lekcije);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/content/ilmihal/:slug
router.get("/ilmihal/:slug", async (req, res) => {
  try {
    const [lekcija] = await db.select().from(ilmihalLekcijeTable).where(eq(ilmihalLekcijeTable.slug, req.params.slug));
    if (!lekcija) { res.status(404).json({ error: "Lekcija nije pronađena" }); return; }

    const result: Record<string, unknown> = { ...lekcija };

    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const jwt = await import("jsonwebtoken");
        const token = authHeader.replace("Bearer ", "");
        const decoded = jwt.default.verify(token, process.env.JWT_SECRET || "mekteb-secret-change-in-production") as any;
        if (decoded.role === "admin" || decoded.role === "muallim") {
          const attachments = await db.select().from(prilozi).where(eq(prilozi.lekcijaId, lekcija.id)).orderBy(desc(prilozi.createdAt));
          result.prilozi = attachments.map(a => ({
            id: a.id,
            originalName: a.originalName,
            fileSize: a.fileSize,
            mimeType: a.mimeType,
            url: `/api/admin/prilozi/download/${a.id}`,
            createdAt: a.createdAt,
          }));
        }
      } catch {}
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// ── KVIZOVI ───────────────────────────────────────────────────────────────────

// GET /api/content/kvizovi?nivo=1&modul=ilmihal
router.get("/kvizovi", async (req, res) => {
  try {
    const { nivo, modul } = req.query;
    const result = await db.select({
      id: kvizoviTable.id,
      nivo: kvizoviTable.nivo,
      slug: kvizoviTable.slug,
      naslov: kvizoviTable.naslov,
      modul: kvizoviTable.modul,
      variant: kvizoviTable.variant,
      pitanja: kvizoviTable.pitanja,
      isPublished: kvizoviTable.isPublished,
    }).from(kvizoviTable).orderBy(asc(kvizoviTable.nivo), asc(kvizoviTable.id));

    const filtered = result.filter(k => {
      if (nivo && k.nivo !== parseInt(nivo as string)) return false;
      if (modul && k.modul !== modul) return false;
      return true;
    });
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/content/kvizovi/:slug (with questions)
router.get("/kvizovi/:slug", async (req, res) => {
  try {
    const [kviz] = await db.select().from(kvizoviTable).where(eq(kvizoviTable.slug, req.params.slug));
    if (!kviz) { res.status(404).json({ error: "Kviz nije pronađen" }); return; }
    res.json(kviz);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// ── KNJIGE/ČITAONICA ─────────────────────────────────────────────────────────

// GET /api/content/knjige?kategorija=prica
router.get("/knjige", async (req, res) => {
  try {
    const { kategorija } = req.query;
    const result = await db.select({
      id: knjige.id,
      slug: knjige.slug,
      naslov: knjige.naslov,
      kategorija: knjige.kategorija,
      coverImage: knjige.coverImage,
      redoslijed: knjige.redoslijed,
    }).from(knjige);

    const filtered = kategorija ? result.filter(k => k.kategorija === kategorija) : result;
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/content/knjige/:slug
router.get("/knjige/:slug", async (req, res) => {
  try {
    const [knjiga] = await db.select().from(knjige).where(eq(knjige.slug, req.params.slug));
    if (!knjiga) { res.status(404).json({ error: "Knjiga nije pronađena" }); return; }
    res.json(knjiga);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// ── NAPREDAK KORISNIKA ────────────────────────────────────────────────────────

// GET /api/content/napredak
router.get("/napredak", requireAuth, async (req, res) => {
  try {
    const napredak = await db.select().from(korisnikNapredakTable).where(eq(korisnikNapredakTable.userId, req.user!.userId));
    res.json(napredak);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/content/napredak - save progress (bodovi only if >= 50%)
router.post("/napredak", requireAuth, async (req, res) => {
  try {
    const { contentType, contentId, zavrsen, bodovi, tacniOdgovori, ukupnoPitanja } = req.body;
    const userId = req.user!.userId;

    const procenat = ukupnoPitanja > 0 ? Math.round((tacniOdgovori / ukupnoPitanja) * 100) : 0;
    const stvarniBodovi = procenat >= 50 ? (bodovi || 0) : 0;

    const existing = await db.select().from(korisnikNapredakTable)
      .where(and(
        eq(korisnikNapredakTable.userId, userId),
        eq(korisnikNapredakTable.contentType, contentType),
        eq(korisnikNapredakTable.contentId, contentId),
      ));

    if (existing.length > 0) {
      const current = existing[0];
      const [updated] = await db.update(korisnikNapredakTable)
        .set({
          zavrsen: zavrsen || current.zavrsen,
          bodovi: Math.max(stvarniBodovi, current.bodovi),
          pokusaji: current.pokusaji + 1,
          completedAt: zavrsen ? new Date() : current.completedAt,
          updatedAt: new Date(),
        })
        .where(eq(korisnikNapredakTable.id, current.id))
        .returning();
      res.json({ ...updated, procenat, bodoviBlokirani: procenat < 50 });
    } else {
      const [nova] = await db.insert(korisnikNapredakTable).values({
        userId,
        contentType,
        contentId,
        zavrsen: !!zavrsen,
        bodovi: stvarniBodovi,
        completedAt: zavrsen ? new Date() : undefined,
      }).returning();
      res.json({ ...nova, procenat, bodoviBlokirani: procenat < 50 });
    }
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/content/kviz-rezultat - save individual quiz attempt (max 1x per quiz per day)
router.post("/kviz-rezultat", requireAuth, async (req, res) => {
  try {
    const { kvizId, kvizNaslov, tacniOdgovori, ukupnoPitanja } = req.body;
    const userId = req.user!.userId;

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const existing = await db.select({ id: kvizRezultatiTable.id }).from(kvizRezultatiTable)
      .where(and(
        eq(kvizRezultatiTable.userId, userId),
        eq(kvizRezultatiTable.kvizId, kvizId || 0),
        gte(kvizRezultatiTable.completedAt, startOfDay),
        lte(kvizRezultatiTable.completedAt, endOfDay),
      ));

    if (existing.length > 0) {
      res.status(429).json({ error: "Već si radio/la ovaj kviz danas. Pokušaj ponovo sutra!" });
      return;
    }

    const procenat = ukupnoPitanja > 0 ? Math.round((tacniOdgovori / ukupnoPitanja) * 100) : 0;
    const bodovi = procenat >= 50 ? Math.round(procenat / 10) : 0;

    const [rezultat] = await db.insert(kvizRezultatiTable).values({
      userId,
      kvizId: kvizId || 0,
      kvizNaslov: kvizNaslov || "",
      tacniOdgovori: tacniOdgovori || 0,
      ukupnoPitanja: ukupnoPitanja || 0,
      procenat,
      bodovi,
    }).returning();

    res.status(201).json(rezultat);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/content/kviz-rezultati - get user's quiz history
router.get("/kviz-rezultati", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const rezultati = await db.select().from(kvizRezultatiTable)
      .where(eq(kvizRezultatiTable.userId, userId))
      .orderBy(desc(kvizRezultatiTable.completedAt));
    res.json(rezultati);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

export default router;
