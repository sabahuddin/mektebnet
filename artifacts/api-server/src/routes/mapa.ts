import { Router } from "express";
import { db } from "@workspace/db";
import {
  ilmihalLekcijeTable,
  medaljoniTable,
  studentMedaljoniTable,
  studentProgressTable,
} from "@workspace/db/schema";
import { eq, and, lte, asc } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

// GET /api/mapa/nivo1
// Vraća sve potrebno za render mape Nivo 1: lista lekcija, lista medaljona,
// koje je trenutni student završio, i koje je medaljone osvojio.
//
// Sigurnost: progress podaci (zavrsene, osvojeniMedaljoni) vraćaju se SAMO ako
// je korisnik prijavljen i ID-ovi se uzimaju ISKLJUČIVO iz JWT-a, ne iz query
// parametra. Bez auth-a vraća samo katalog (lekcije + medaljoni) bez progressa.
// Ranije je endpoint primao `studentId` iz querya bez provjere — IDOR rupa.
router.get("/nivo1", async (req, res) => {
  try {
    const [lekcije, medaljoni] = await Promise.all([
      db
        .select({
          id: ilmihalLekcijeTable.id,
          slug: ilmihalLekcijeTable.slug,
          naslov: ilmihalLekcijeTable.naslov,
          redoslijed: ilmihalLekcijeTable.redoslijed,
        })
        .from(ilmihalLekcijeTable)
        .where(eq(ilmihalLekcijeTable.nivo, 1))
        .orderBy(asc(ilmihalLekcijeTable.redoslijed)),
      db
        .select()
        .from(medaljoniTable)
        .where(eq(medaljoniTable.nivo, 1))
        .orderBy(asc(medaljoniTable.posAfterRedoslijed)),
    ]);

    let zavrsene: number[] = [];
    let osvojeniMedaljoni: number[] = [];

    // Provjeri JWT iz Authorization headera (opcionalno — ne baca 401 ako nema).
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const jwt = await import("jsonwebtoken");
        const JWT_SECRET = process.env.JWT_SECRET || "mekteb-secret-change-in-production";
        const payload = jwt.default.verify(authHeader.slice(7), JWT_SECRET) as { userId: number };
        const userIdStr = String(payload.userId);

        const [progressRow] = await db
          .select({ completedLessons: studentProgressTable.completedLessons })
          .from(studentProgressTable)
          .where(eq(studentProgressTable.studentId, userIdStr))
          .limit(1);
        zavrsene = (progressRow?.completedLessons as number[] | undefined) ?? [];

        const earnedRows = await db
          .select({ medaljonId: studentMedaljoniTable.medaljonId })
          .from(studentMedaljoniTable)
          .where(eq(studentMedaljoniTable.studentId, userIdStr));
        osvojeniMedaljoni = earnedRows.map((r) => r.medaljonId);
      } catch {
        // Nevažeći token — tretiraj kao neulogovan, vrati samo katalog.
      }
    }

    res.json({ lekcije, medaljoni, zavrsene, osvojeniMedaljoni });
  } catch (err) {
    console.error("[mapa/nivo1] error", err);
    res.status(500).json({ error: "Greška pri učitavanju mape" });
  }
});

// POST /api/mapa/medaljon/:slug/claim
// Označava medaljon kao osvojen za prijavljenog učenika. Idempotentno —
// ako je već osvojen, vraća postojeći zapis.
//
// Sigurnost:
//   1) Samo "ucenik" rola može osvajati medaljone (mualli/admin/roditelj ne
//      pune medalje na svoj račun).
//   2) Stricter validacija: provjera da su SVE Nivo 1 lekcije sa
//      redoslijed <= posAfterRedoslijed stvarno završene (ne samo .length).
//      Bez ovoga bi neko mogao završiti N lekcija iz Nivoa 2 i tražiti
//      Nivo 1 bedž — ovo zatvara taj cheat vector.
router.post("/medaljon/:slug/claim", requireAuth, requireRole("ucenik"), async (req, res) => {
  try {
    const slug = req.params.slug;
    const userId = String(req.user?.userId ?? "");
    if (!userId) return res.status(401).json({ error: "Niste prijavljeni" });

    const [medaljon] = await db
      .select()
      .from(medaljoniTable)
      .where(eq(medaljoniTable.slug, slug))
      .limit(1);
    if (!medaljon) return res.status(404).json({ error: "Medaljon ne postoji" });

    const [progressRow] = await db
      .select({ completedLessons: studentProgressTable.completedLessons })
      .from(studentProgressTable)
      .where(eq(studentProgressTable.studentId, userId))
      .limit(1);
    const zavrsene = new Set((progressRow?.completedLessons as number[] | undefined) ?? []);

    // Sve Nivo 1 lekcije sa redoslijed <= posAfterRedoslijed moraju biti u
    // zavrsene. Tako "Putnik" (pos=10) traži tačno tih 10 lekcija, ne bilo
    // kojih 10.
    const potrebne = await db
      .select({ id: ilmihalLekcijeTable.id })
      .from(ilmihalLekcijeTable)
      .where(
        and(
          eq(ilmihalLekcijeTable.nivo, 1),
          lte(ilmihalLekcijeTable.redoslijed, medaljon.posAfterRedoslijed),
        ),
      );
    const nedostaje = potrebne.filter((l) => !zavrsene.has(l.id));
    if (nedostaje.length > 0) {
      return res.status(403).json({
        error: "Još nisi završio sve potrebne lekcije za ovaj medaljon",
        nedostajeBroj: nedostaje.length,
        ukupno: potrebne.length,
      });
    }

    const inserted = await db
      .insert(studentMedaljoniTable)
      .values({ studentId: userId, medaljonId: medaljon.id })
      .onConflictDoNothing()
      .returning();

    res.json({
      ok: true,
      medaljon,
      vecOsvojen: inserted.length === 0,
      earnedAt: inserted[0]?.earnedAt ?? null,
    });
  } catch (err) {
    console.error("[mapa/medaljon/claim] error", err);
    res.status(500).json({ error: "Greška pri osvajanju medaljona" });
  }
});

export default router;
