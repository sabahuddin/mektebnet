import { Router } from "express";
import { db } from "@workspace/db";
import {
  ilmihalLekcijeTable,
  medaljoniTable,
  studentMedaljoniTable,
  studentProgressTable,
  krunisanjaTable,
  etapaPolaganjaTable,
} from "@workspace/db/schema";
import { eq, and, lt, asc, notLike } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { polozeneEtapeNivoa } from "./etape.js";
import { polozenaKrunisanja } from "./krunisanja.js";
import { JWT_SECRET } from "../lib/jwt-secret.js";
import {
  getRasporedPositionsForStudent,
  applyEffectiveOrder,
  resolveEffectiveRedoslijed,
} from "../lib/raspored.js";
import { getLang, overlayRows } from "../lib/content-translatable.js";

const router = Router();

// GET /api/mapa/nivo/:n  (n ∈ {1, 2, 3})
// Vraća sve potrebno za render mape jednog nivoa: lista lekcija, lista
// medaljona, koje je trenutni student završio, i koje je medaljone osvojio.
//
// Back-compat: stari `/api/mapa/nivo1` i dalje radi kao alias za /nivo/1.
//
// Sigurnost: progress podaci (zavrsene, osvojeniMedaljoni) vraćaju se SAMO ako
// je korisnik prijavljen i ID-ovi se uzimaju ISKLJUČIVO iz JWT-a, ne iz query
// parametra. Bez auth-a vraća samo katalog (lekcije + medaljoni) bez progressa.
async function handleMapaNivo(nivoRaw: unknown, req: import("express").Request, res: import("express").Response) {
  const nivo = Number(nivoRaw);
  if (!Number.isInteger(nivo) || nivo < 1 || nivo > 3) {
    return res.status(400).json({ error: "Nivo mora biti 1, 2 ili 3" });
  }
  try {
    let authPayload: { userId: number; role?: string } | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const jwt = await import("jsonwebtoken");
        authPayload = jwt.default.verify(authHeader.slice(7), JWT_SECRET) as { userId: number; role?: string };
      } catch {
        authPayload = null;
      }
    }
    const canSeeMuallimOnly = authPayload?.role === "admin" || authPayload?.role === "muallim";
    const [lekcije, medaljoni, krunisanjeRow] = await Promise.all([
      db
        .select({
          id: ilmihalLekcijeTable.id,
          slug: ilmihalLekcijeTable.slug,
          naslov: ilmihalLekcijeTable.naslov,
          redoslijed: ilmihalLekcijeTable.redoslijed,
          uvjetiIds: ilmihalLekcijeTable.uvjetiIds,
        })
        .from(ilmihalLekcijeTable)
        // Isključi medaljon-lekcije (slug `medaljon-nivo{N}-{ord}`) — one NISU
        // regularna polja mape niti se broje u napredak; pristupa im se preko
        // medaljon heksa. Bez ovog filtera bi upadale u `completedCount`.
        .where(and(
          eq(ilmihalLekcijeTable.nivo, nivo),
          notLike(ilmihalLekcijeTable.slug, "medaljon-nivo%"),
          // DODATAK lekcije (slug `dodatak-nivo{N}-{n}`) nisu dio mape niti
          // progresije — dodatni sadržaj dostupan samo kroz listu svih lekcija.
          notLike(ilmihalLekcijeTable.slug, "dodatak-nivo%"),
          ...(canSeeMuallimOnly ? [] : [eq(ilmihalLekcijeTable.dostupnost, "svi")]),
        ))
        .orderBy(asc(ilmihalLekcijeTable.redoslijed)),
      db
        .select()
        .from(medaljoniTable)
        .where(eq(medaljoniTable.nivo, nivo))
        .orderBy(asc(medaljoniTable.posAfterRedoslijed)),
      db
        .select({
          id: krunisanjaTable.id,
          nivo: krunisanjaTable.nivo,
          naslov: krunisanjaTable.naslov,
          isGating: krunisanjaTable.isGating,
          kvizIds: krunisanjaTable.kvizIds,
          kvizPitanjaIds: krunisanjaTable.kvizPitanjaIds,
        })
        .from(krunisanjaTable)
        .where(eq(krunisanjaTable.nivo, nivo))
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);
    // Augment medaljoni s `imaKviz` flag-om da FE može odlučiti da li za
    // gating treba polaganje ispita ili samo završene lekcije + claim.
    const medaljoniAug = medaljoni.map((m) => ({
      ...m,
      imaKviz:
        (Array.isArray(m.kvizIds) && m.kvizIds.length > 0)
        || (Array.isArray(m.kvizPitanjaIds) && m.kvizPitanjaIds.length > 0),
      isGating: m.isGating ?? true,
    }));
    await overlayRows(medaljoniAug, "medaljoni", getLang(req));
    const krunisanjeMeta = krunisanjeRow
      ? {
          id: krunisanjeRow.id,
          nivo: krunisanjeRow.nivo,
          naslov: krunisanjeRow.naslov,
          isGating: krunisanjeRow.isGating,
          imaKviz:
            (Array.isArray(krunisanjeRow.kvizIds) && krunisanjeRow.kvizIds.length > 0)
            || (Array.isArray(krunisanjeRow.kvizPitanjaIds) && krunisanjeRow.kvizPitanjaIds.length > 0),
        }
      : null;

    // Default: globalni redoslijed. Za prijavljenog studenta čija grupa ima
    // raspored za ovaj nivo → preslažemo lekcije na efektivne pozicije.
    let lekcijeOut = lekcije;
    let zavrsene: number[] = [];
    let osvojeniMedaljoni: number[] = [];
    let polozeneEtape: number[] = [];
    let polozenaKrunisanjaIds: number[] = [];

    // Provjeri JWT iz Authorization headera (opcionalno — ne baca 401 ako nema).
    if (authPayload) {
      try {
        const payload = authPayload;
        const userIdStr = String(payload.userId);

        // Raspored grupe (ako postoji) → efektivni redoslijed lekcija.
        const rasporedPosMap = await getRasporedPositionsForStudent(payload.userId, nivo);
        if (rasporedPosMap) lekcijeOut = applyEffectiveOrder(lekcije, rasporedPosMap);

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

        const [etapeSet, krunSet] = await Promise.all([
          polozeneEtapeNivoa(userIdStr, nivo),
          polozenaKrunisanja(userIdStr),
        ]);
        polozeneEtape = Array.from(etapeSet);
        polozenaKrunisanjaIds = Array.from(krunSet);
      } catch {
        // Nevažeći token — tretiraj kao neulogovan, vrati samo katalog.
      }
    }

    res.json({
      lekcije: lekcijeOut,
      medaljoni: medaljoniAug,
      krunisanje: krunisanjeMeta,
      zavrsene,
      osvojeniMedaljoni,
      polozeneEtape,
      polozenaKrunisanja: polozenaKrunisanjaIds,
    });
  } catch (err) {
    console.error("[mapa/nivo] error", err);
    res.status(500).json({ error: "Greška pri učitavanju mape" });
  }
  return;
}

router.get("/nivo/:n", (req, res) => handleMapaNivo(req.params.n, req, res));
router.get("/nivo1", (req, res) => handleMapaNivo(1, req, res));

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
    const slug = String(req.params.slug);
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

    // Sve regularne lekcije ovog nivoa sa EFEKTIVNOM pozicijom <=
    // posAfterRedoslijed moraju biti u `zavrsene`. Efektivni redoslijed poštuje
    // raspored studentove grupe (ako postoji); inače je globalni redoslijed.
    // Koristimo `medaljon.nivo` (ne hard-coded 1) tako da gating radi za sve
    // nivoe. Medaljon-lekcije (redoslijed >= 9000) su isključene.
    const regularLekcije = await db
      .select({ id: ilmihalLekcijeTable.id, redoslijed: ilmihalLekcijeTable.redoslijed })
      .from(ilmihalLekcijeTable)
      .where(
        and(
          eq(ilmihalLekcijeTable.nivo, medaljon.nivo),
          lt(ilmihalLekcijeTable.redoslijed, 9000),
          eq(ilmihalLekcijeTable.dostupnost, "svi"),
        ),
      );
    const rasporedPosMap = await getRasporedPositionsForStudent(req.user!.userId, medaljon.nivo);
    const effMap = resolveEffectiveRedoslijed(regularLekcije, rasporedPosMap);
    const potrebne = regularLekcije.filter(
      (l) => (effMap.get(l.id) ?? l.redoslijed) <= medaljon.posAfterRedoslijed,
    );
    const nedostaje = potrebne.filter((l) => !zavrsene.has(l.id));
    if (nedostaje.length > 0) {
      return res.status(403).json({
        error: "Još nisi završio sve potrebne lekcije za ovaj medaljon",
        nedostajeBroj: nedostaje.length,
        ukupno: potrebne.length,
      });
    }

    // Task #126 server-side gating: ako je etapa konfigurisana sa kvizom,
    // direktan claim NIJE dozvoljen — student mora prvo položiti završni
    // ispit (`/etape/:medaljonId/predaj`) koji onda automatski upisuje
    // medaljon. Bez ove provjere učenik bi mogao zaobići ispit i otključati
    // sljedeći blok lekcija + krunisanje.
    const imaKviz =
      (Array.isArray(medaljon.kvizIds) && medaljon.kvizIds.length > 0)
      || (Array.isArray(medaljon.kvizPitanjaIds) && medaljon.kvizPitanjaIds.length > 0);
    // Poštuj `is_gating` toggle: non-gating etape dozvoljavaju direktan
    // claim i bez polaganja ispita (admin može imati pripremne etape
    // koje ne blokiraju progres).
    if (imaKviz && medaljon.isGating) {
      const [pass] = await db
        .select({ id: etapaPolaganjaTable.id })
        .from(etapaPolaganjaTable)
        .where(
          and(
            eq(etapaPolaganjaTable.studentId, userId),
            eq(etapaPolaganjaTable.medaljonId, medaljon.id),
            eq(etapaPolaganjaTable.polozeno, true),
          ),
        )
        .limit(1);
      if (!pass) {
        return res.status(403).json({
          error: "Položi završni ispit etape da osvojiš medaljon",
          trebaKviz: true,
        });
      }
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
  return;
});

export default router;
