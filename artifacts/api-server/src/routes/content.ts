import { Router } from "express";
import { db } from "@workspace/db";
import {
  ilmihalLekcijeTable,
  kvizoviTable,
  knjige,
  korisnikNapredakTable,
  kvizRezultatiTable,
  prilozi,
  rjecnikTable,
  studentProgressTable,
} from "@workspace/db/schema";
import { eq, and, asc, desc, gte, lte, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { regeneratePripremaInHtml } from "../lib/priprema-render.js";
import { evaluateAndPersistBadges } from "../lib/badges.js";

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

    // Optional: ako je auth, dodaj zavrseno boolean za svaku lekciju
    // Izvor istine: student_progress.completedLessons (jsonb array). Fallback: korisnik_napredak.
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const jwt = await import("jsonwebtoken");
        const token = authHeader.replace("Bearer ", "");
        const decoded = jwt.default.verify(token, process.env.JWT_SECRET || "mekteb-secret-change-in-production") as any;
        const userId = decoded.userId;
        if (userId) {
          const completedSet = new Set<number>();

          const [progressRow] = await db.select({ completedLessons: studentProgressTable.completedLessons })
            .from(studentProgressTable)
            .where(eq(studentProgressTable.studentId, String(userId)));
          const lessonsArr = progressRow?.completedLessons as unknown;
          if (Array.isArray(lessonsArr)) {
            for (const lid of lessonsArr) if (typeof lid === "number") completedSet.add(lid);
          }

          // Backfill iz korisnik_napredak (stari sistem) — union sa student_progress
          const napredakRows = await db.select({ contentId: korisnikNapredakTable.contentId, zavrsen: korisnikNapredakTable.zavrsen })
            .from(korisnikNapredakTable)
            .where(and(eq(korisnikNapredakTable.userId, userId), eq(korisnikNapredakTable.contentType, "ilmihal")));
          for (const r of napredakRows) if (r.zavrsen) completedSet.add(r.contentId);

          const enriched = lekcije.map(l => ({ ...l, zavrseno: completedSet.has(l.id) }));
          res.json(enriched);
          return;
        }
      } catch {}
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

    // Auto-upgrade legacy priprema (table-based) to new gradient design on read.
    // No DB write — purely transforms HTML before serving.
    const upgradedHtml = regeneratePripremaInHtml(lekcija.contentHtml || "");

    const result: Record<string, unknown> = { ...lekcija, contentHtml: upgradedHtml };

    // Dohvat priloga za sve autentifikovane korisnike. Pravila vidljivosti:
    //   - admin/muallim: VIDE SVE priloge (file/url/h5p) — uključujući linkove
    //     za download muallimskih materijala (PDF/PPT/...).
    //   - učenik/roditelj: VIDE SAMO interaktivne (kind="h5p") + javne URL
    //     priloge (kind="url" — npr. YouTube). Privatne fajlove (kind="file")
    //     ne vide jer su to materijali za nastavnika.
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const jwt = await import("jsonwebtoken");
        const token = authHeader.replace("Bearer ", "");
        const decoded = jwt.default.verify(token, process.env.JWT_SECRET || "mekteb-secret-change-in-production") as any;
        const userId = decoded.userId;

        // Dohvati napredak ovog korisnika za ovu lekciju (timeSpentSeconds + zavrsen).
        // Frontend koristi za prikaz countdown-a i "Provedeno: Xm Ys" pored završene oznake.
        if (userId) {
          try {
            const [napredak] = await db.select({
              timeSpentSeconds: korisnikNapredakTable.timeSpentSeconds,
              zavrsen: korisnikNapredakTable.zavrsen,
            }).from(korisnikNapredakTable)
              .where(and(
                eq(korisnikNapredakTable.userId, userId),
                eq(korisnikNapredakTable.contentType, "ilmihal"),
                eq(korisnikNapredakTable.contentId, lekcija.id),
              ));
            result.userProgress = {
              timeSpentSeconds: napredak?.timeSpentSeconds ?? 0,
              zavrsen: napredak?.zavrsen ?? false,
            };
          } catch {}
        }

        const isStaff = decoded.role === "admin" || decoded.role === "muallim";
        const all = await db.select().from(prilozi).where(eq(prilozi.lekcijaId, lekcija.id)).orderBy(desc(prilozi.createdAt));
        const visible = isStaff ? all : all.filter(a => a.kind === "h5p" || a.kind === "url");
        result.prilozi = visible.map(a => {
          let url: string;
          if (a.kind === "url") url = a.externalUrl || "";
          // H5P static fajlovi: koristimo `/api/uploads/...` jer je `/api`
          // jedini prefix koji u Replit path routing-u sigurno pogađa api-server
          // (a u prod-u behind nginx-u takođe). Auth (cookie ili Bearer) traje.
          else if (a.kind === "h5p") url = `/api/uploads/${a.storedName}`;
          else url = `/api/admin/prilozi/download/${a.id}`; // admin auth required
          return {
            id: a.id,
            originalName: a.originalName,
            fileSize: a.fileSize,
            mimeType: a.mimeType,
            kind: a.kind,
            externalUrl: a.externalUrl,
            url,
            createdAt: a.createdAt,
          };
        });
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

// Helper: ažurira student_progress (streak, hasanati, completedLessons, badges) za ilmihal lekcije.
// Bedževi se evaluiraju centralno preko `evaluateAndPersistBadges` (uključuje i kviz-bedževe).
async function updateStudentProgressForLesson(userId: number, lessonId: number, hasanatEarned: number) {
  const studentIdStr = String(userId);
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const [existing] = await db.select().from(studentProgressTable)
    .where(eq(studentProgressTable.studentId, studentIdStr)).limit(1);

  let newCompletion: boolean;
  let streakDays: number;
  let totalHasanat: number;
  let previousStreakDays: number;
  let previousHasanat: number;

  if (!existing) {
    await db.insert(studentProgressTable).values({
      studentId: studentIdStr,
      totalHasanat: hasanatEarned,
      completedLessons: [lessonId],
      badges: [],
      streakDays: 1,
      lastActivityDate: today,
    });
    newCompletion = true;
    streakDays = 1;
    totalHasanat = hasanatEarned;
    previousStreakDays = 0;
    previousHasanat = 0;
  } else {
    previousStreakDays = existing.streakDays;
    previousHasanat = existing.totalHasanat;

    const rawLessons = existing.completedLessons as unknown;
    const completedLessons: number[] = Array.isArray(rawLessons) ? [...rawLessons as number[]] : [];
    newCompletion = !completedLessons.includes(lessonId);
    if (newCompletion) completedLessons.push(lessonId);

    streakDays = existing.streakDays;
    if (existing.lastActivityDate !== today) {
      if (existing.lastActivityDate === yesterdayStr) streakDays += 1;
      else streakDays = 1;
    }

    totalHasanat = existing.totalHasanat + (newCompletion ? hasanatEarned : 0);

    await db.update(studentProgressTable)
      .set({ totalHasanat, completedLessons, streakDays, lastActivityDate: today, updatedAt: new Date() })
      .where(eq(studentProgressTable.studentId, studentIdStr));
  }

  const novelyEarned = await evaluateAndPersistBadges(userId);
  const novelyEarnedBadges = novelyEarned.map(b => b.id);
  const hasanatGained = newCompletion ? hasanatEarned : 0;
  const streakIncreased = streakDays > previousStreakDays;

  return {
    newCompletion,
    streakDays,
    totalHasanat,
    previousStreakDays,
    previousHasanat,
    hasanatGained,
    streakIncreased,
    novelyEarnedBadges,
    newBadges: novelyEarned,
  };
}

// Minimum aktivnog vremena (sekundi) potrebnog za prvo označavanje ilmihal
// lekcije kao završene. Sprječava klik-kroz-sve cheating. Vrijeme se mjeri
// na frontendu samo dok je tab aktivan (Page Visibility API).
const MIN_ACTIVE_SECONDS_FOR_ILMIHAL_COMPLETION = 300;

// POST /api/content/napredak - save progress (bodovi only if >= 50%)
router.post("/napredak", requireAuth, async (req, res) => {
  try {
    const { contentType, contentId, zavrsen, bodovi, tacniOdgovori, ukupnoPitanja, timeSpentSeconds } = req.body;
    const userId = req.user!.userId;

    // Osnovna validacija ulaza — bez ovoga može doći do prljavih insertova.
    if (typeof contentType !== "string" || !contentType) {
      res.status(400).json({ error: "invalid_content_type" });
      return;
    }
    if (typeof contentId !== "number" || !Number.isFinite(contentId) || contentId <= 0) {
      res.status(400).json({ error: "invalid_content_id" });
      return;
    }

    // Anti-farm: za ilmihal completion potrebna je VALIDACIJA da lekcija
    // stvarno postoji. Bez ovoga bi tehnički korisnik mogao slati proizvoljne
    // contentId vrijednosti u POST i farmati Aferime preko mirror-a u
    // student_progress. Validaciju radimo samo za ilmihal jer je samo to
    // tip koji award path koristi.
    if (contentType === "ilmihal") {
      const [lekcijaRow] = await db
        .select({ id: ilmihalLekcijeTable.id })
        .from(ilmihalLekcijeTable)
        .where(eq(ilmihalLekcijeTable.id, contentId))
        .limit(1);
      if (!lekcijaRow) {
        res.status(404).json({ error: "lekcija_not_found" });
        return;
      }
    }

    const procenat = ukupnoPitanja > 0 ? Math.round((tacniOdgovori / ukupnoPitanja) * 100) : 0;
    const stvarniBodovi = procenat >= 50 ? (bodovi || 0) : 0;

    // Validiraj timeSpentSeconds — clamp negativne i ekstremno velike vrijednosti.
    // Ako klijent ne pošalje, tretiraj kao 0 (legacy klijent).
    // NAPOMENA: ovo je ipak klijentska vrijednost. Gate štiti od
    // CASUAL "klikanja kroz sve" — tehnički napredan korisnik može poslati
    // proizvoljnih 300 i proći gate. Gate se ne smije računati kao
    // kriptografski siguran; svrha je usporiti farmanje.
    const incomingTime = typeof timeSpentSeconds === "number" && Number.isFinite(timeSpentSeconds)
      ? Math.max(0, Math.min(86400, Math.floor(timeSpentSeconds))) // max 24h jednostranog updatea
      : 0;

    // Pročitamo trenutni red SAMO za potrebe gate-a (zavrsen + max(time)).
    // Stvarni write radimo atomski preko UPDATE ... GREATEST(...) — vidi dolje.
    const existing = await db.select().from(korisnikNapredakTable)
      .where(and(
        eq(korisnikNapredakTable.userId, userId),
        eq(korisnikNapredakTable.contentType, contentType),
        eq(korisnikNapredakTable.contentId, contentId),
      ));

    const currentTime = existing.length > 0 ? existing[0].timeSpentSeconds : 0;
    const wasAlreadyCompleted = existing.length > 0 && existing[0].zavrsen;
    // Najveće vrijeme koje znamo TRENUTNO (kasniji UPDATE će uzeti GREATEST
    // sa stvarnim DB redom — vidi dolje — pa je ovo samo procjena za gate).
    const projectedTime = Math.max(currentTime, incomingTime);

    // GATE: za prvo označavanje ilmihal lekcije kao završene zahtijevaj
    // minimum 300 sekundi aktivnog čitanja. Već završene lekcije mogu se
    // i dalje "potvrditi" bez vremenskog praga (samo updateuju vrijeme).
    if (
      zavrsen === true &&
      contentType === "ilmihal" &&
      !wasAlreadyCompleted &&
      projectedTime < MIN_ACTIVE_SECONDS_FOR_ILMIHAL_COMPLETION
    ) {
      res.status(422).json({
        error: "min_time_not_reached",
        message: `Lekciju možeš označiti kao završenu nakon ${MIN_ACTIVE_SECONDS_FOR_ILMIHAL_COMPLETION} sekundi aktivnog čitanja.`,
        minSeconds: MIN_ACTIVE_SECONDS_FOR_ILMIHAL_COMPLETION,
        currentSeconds: projectedTime,
      });
      return;
    }

    let result;
    if (existing.length > 0) {
      const current = existing[0];
      // ATOMSKI UPDATE: koristimo SQL GREATEST/COALESCE da spriječimo race
      // između paralelnih /napredak poziva (npr. periodic 30s POST + final
      // markComplete). Bez ovoga read-then-write može upisati MANJI time
      // i poništiti nedavno napredovanje.
      const [updated] = await db.update(korisnikNapredakTable)
        .set({
          // Boolean OR — kad jednom postane true, ne pada na false.
          zavrsen: sql`${korisnikNapredakTable.zavrsen} OR ${!!zavrsen}`,
          bodovi: sql`GREATEST(${korisnikNapredakTable.bodovi}, ${stvarniBodovi})`,
          pokusaji: sql`${korisnikNapredakTable.pokusaji} + 1`,
          timeSpentSeconds: sql`GREATEST(${korisnikNapredakTable.timeSpentSeconds}, ${incomingTime})`,
          // completedAt: postavi tek prvi put kad postane završeno.
          completedAt: zavrsen
            ? (current.completedAt ?? new Date())
            : current.completedAt,
          updatedAt: new Date(),
        })
        .where(eq(korisnikNapredakTable.id, current.id))
        .returning();
      result = updated;
    } else {
      const [nova] = await db.insert(korisnikNapredakTable).values({
        userId,
        contentType,
        contentId,
        zavrsen: !!zavrsen,
        bodovi: stvarniBodovi,
        timeSpentSeconds: incomingTime,
        completedAt: zavrsen ? new Date() : undefined,
      }).returning();
      result = nova;
    }

    // Mirror u student_progress (streak/hasanati) samo za ilmihal lekcije
    // koje su upravo završene PRVI put. `wasAlreadyCompleted` štiti od
    // dvostrukog awarda kad učenik ponovo pritisne dugme na već završenoj
    // lekciji (drugi sloj — prvi je `newCompletion` u updateStudentProgressForLesson).
    let progressDelta = null;
    if (zavrsen && contentType === "ilmihal" && !wasAlreadyCompleted) {
      try {
        progressDelta = await updateStudentProgressForLesson(userId, contentId, 15);
      } catch (e) {
        // Ne lomimo originalni request ako mirror padne
      }
    }

    res.json({ ...result, procenat, bodoviBlokirani: procenat < 50, progressDelta });
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

    // Dodaj hasanate u student_progress, ažuriraj streak i evaluiraj nove
    // bedževe — mirroring /api/exercises/session tako da klijent može pokazati
    // istu CelebrationModal animaciju nakon kviza.
    let newBadges: Awaited<ReturnType<typeof evaluateAndPersistBadges>> = [];
    let totalHasanat = bodovi;
    let previousHasanat = 0;
    let previousStreakDays = 0;
    let streakDays = 1;
    try {
      const studentIdStr = String(userId);
      const todayStr = new Date().toISOString().split("T")[0];
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayStr = yesterdayDate.toISOString().split("T")[0];

      const [existingProgress] = await db.select().from(studentProgressTable)
        .where(eq(studentProgressTable.studentId, studentIdStr)).limit(1);

      if (!existingProgress) {
        await db.insert(studentProgressTable).values({
          studentId: studentIdStr,
          totalHasanat: bodovi,
          completedLessons: [],
          badges: [],
          streakDays: 1,
          lastActivityDate: todayStr,
        });
        totalHasanat = bodovi;
        previousHasanat = 0;
        previousStreakDays = 0;
        streakDays = 1;
      } else {
        previousHasanat = existingProgress.totalHasanat;
        previousStreakDays = existingProgress.streakDays;
        totalHasanat = existingProgress.totalHasanat + bodovi;

        streakDays = existingProgress.streakDays;
        if (existingProgress.lastActivityDate !== todayStr) {
          if (existingProgress.lastActivityDate === yesterdayStr) streakDays += 1;
          else streakDays = 1;
        }

        await db.update(studentProgressTable)
          .set({
            totalHasanat,
            streakDays,
            lastActivityDate: todayStr,
            updatedAt: new Date(),
          })
          .where(eq(studentProgressTable.studentId, studentIdStr));
      }

      newBadges = await evaluateAndPersistBadges(userId);
    } catch (badgeErr) {
      // Bedž evaluacija / streak update ne smije srušiti glavni odgovor
    }

    const streakIncreased = streakDays > previousStreakDays;

    res.status(200).json({
      ...rezultat,
      hasanatEarned: bodovi,
      hasanatGained: bodovi,
      totalHasanat,
      previousHasanat,
      streakDays,
      streakIncreased,
      newBadges,
    });
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

router.get("/rjecnik", async (_req, res) => {
  try {
    const rows = await db.select({
      rijec: rjecnikTable.rijec,
      definicija: rjecnikTable.definicija,
    }).from(rjecnikTable).orderBy(asc(rjecnikTable.rijec));
    const dict: Record<string, string> = {};
    for (const r of rows) dict[r.rijec] = r.definicija;
    res.json(dict);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

export default router;
