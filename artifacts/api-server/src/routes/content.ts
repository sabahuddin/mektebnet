import { Router } from "express";
import { db } from "@workspace/db";
import {
  ilmihalLekcijeTable,
  kvizoviTable,
  kvizPitanjaTable,
  pitanjaBankaTable,
  knjige,
  kategorijeKnjigeTable,
  korisnikNapredakTable,
  kvizRezultatiTable,
  prilozi,
  rjecnikTable,
  studentProgressTable,
  medaljoniTable,
  studentMedaljoniTable,
  etapaPolaganjaTable,
  krunisanjaTable,
  studentKrunisanjaTable,
} from "@workspace/db/schema";
import { eq, and, asc, desc, gte, lte, lt, sql, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { sendEmail } from "../lib/email.js";
import { regeneratePripremaInHtml } from "../lib/priprema-render.js";
import { evaluateAndPersistBadges } from "../lib/badges.js";
import {
  getRasporedPositionsForStudent,
  resolveEffectiveRedoslijed,
  applyEffectiveOrder,
} from "../lib/raspored.js";
import { getLang, overlayRows, overlayOne } from "../lib/content-translatable.js";

const router = Router();

const SVI_JEZICI = ["bs", "sq", "de", "en", "tr", "ar"];

// GET /api/content/dozvoljeni-jezici — koje jezike prijavljeni korisnik smije
// koristiti. Muallim i njegovi učenici prate muallim_profili.dozvoljeni_jezici;
// admin i roditelj imaju sve. Bosanski je UVIJEK uključen.
router.get("/dozvoljeni-jezici", requireAuth, async (req, res) => {
  try {
    const user = (req as unknown as { user?: { userId?: number; role?: string } }).user;
    const role = user?.role;
    const uid = user?.userId;
    if (!uid) { res.status(401).json({ error: "Niste prijavljeni" }); return; }
    if (role === "admin" || role === "roditelj") {
      res.json({ jezici: SVI_JEZICI });
      return;
    }
    let raw: unknown = null;
    if (role === "muallim") {
      const r = (await db.execute(
        sql`SELECT dozvoljeni_jezici FROM muallim_profili WHERE user_id = ${uid}`,
      )) as unknown as { rows: { dozvoljeni_jezici: unknown }[] };
      raw = r.rows[0]?.dozvoljeni_jezici ?? null;
    } else if (role === "ucenik") {
      const r = (await db.execute(
        sql`SELECT mp.dozvoljeni_jezici FROM ucenik_profili up
            JOIN muallim_profili mp ON mp.user_id = up.muallim_id
            WHERE up.user_id = ${uid}`,
      )) as unknown as { rows: { dozvoljeni_jezici: unknown }[] };
      raw = r.rows[0]?.dozvoljeni_jezici ?? null;
    }
    let lista = Array.isArray(raw)
      ? (raw as unknown[]).filter((l): l is string => typeof l === "string" && SVI_JEZICI.includes(l))
      : SVI_JEZICI;
    if (!lista.includes("bs")) lista = ["bs", ...lista];
    lista = SVI_JEZICI.filter((l) => lista.includes(l));
    res.json({ jezici: lista });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Greška" });
  }
});

// ── ILMIHAL ────────────────────────────────────────────────────────────────────

// GET /api/content/ilmihal?nivo=1
router.get("/ilmihal", async (req, res) => {
  try {
    const nivo = req.query.nivo ? parseInt(req.query.nivo as string) : undefined;
    // Predmet se čuva u zasebnoj koloni `predmet` (backfill-ovan iz priprema
    // HTML-a u app startup-u u index.ts). Admin ga direktno mijenja kroz PUT
    // /admin/ilmihal/:id; muallim ga samo čita za filter pretragu.
    const baseSelect = {
      id: ilmihalLekcijeTable.id,
      nivo: ilmihalLekcijeTable.nivo,
      slug: ilmihalLekcijeTable.slug,
      naslov: ilmihalLekcijeTable.naslov,
      redoslijed: ilmihalLekcijeTable.redoslijed,
      audioSrc: ilmihalLekcijeTable.audioSrc,
      isPublished: ilmihalLekcijeTable.isPublished,
      predmet: ilmihalLekcijeTable.predmet,
    };
    let lekcije;
    if (nivo) {
      lekcije = await db.select(baseSelect).from(ilmihalLekcijeTable).where(eq(ilmihalLekcijeTable.nivo, nivo)).orderBy(asc(ilmihalLekcijeTable.redoslijed));
    } else {
      lekcije = await db.select(baseSelect).from(ilmihalLekcijeTable).orderBy(asc(ilmihalLekcijeTable.redoslijed));
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
          // Primijeni efektivni redoslijed po nivou (raspored grupe studenta).
          // Grupe bez rasporeda → nepromijenjeno (globalni redoslijed).
          const poNivou = new Map<number, typeof enriched>();
          for (const l of enriched) {
            const arr = poNivou.get(l.nivo) ?? [];
            arr.push(l);
            poNivou.set(l.nivo, arr);
          }
          const poredano: typeof enriched = [];
          for (const [nv, arr] of poNivou) {
            const posMap = await getRasporedPositionsForStudent(userId, nv);
            poredano.push(...applyEffectiveOrder(arr, posMap));
          }
          await overlayRows(poredano, "ilmihal_lekcije", getLang(req));
          res.json(poredano);
          return;
        }
      } catch {}
    }

    await overlayRows(lekcije, "ilmihal_lekcije", getLang(req));
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

    // Task #126: server-side progression gating za učenike. Direktan URL
    // pristup zaključanoj lekciji vraća 403 sa eksplicitnim razlogom; tako
    // se ne može zaobići mapa-gating preko deep linka. Privilegovane role
    // (admin/muallim/roditelj) i neprijavljeni gosti (za prvih nekoliko
    // javnih lekcija) idu starim tokom — gating se primjenjuje samo na
    // role "ucenik".
    let lockedReason: string | null = null;
    const authHeaderEarly = req.headers.authorization;
    if (authHeaderEarly?.startsWith("Bearer ")) {
      try {
        const jwt = await import("jsonwebtoken");
        const decoded = jwt.default.verify(
          authHeaderEarly.slice(7),
          process.env.JWT_SECRET || "mekteb-secret-change-in-production",
        ) as { userId: number; role?: string };
        if (decoded.role === "ucenik") {
          const studentId = String(decoded.userId);
          // Efektivni redoslijed za ovog studenta: ako njegova grupa ima
          // raspored za ovaj nivo → preslagane pozicije; inače globalni
          // redoslijed (identitet, nula promjena za postojeće grupe).
          const regularLekcije = await db
            .select({ id: ilmihalLekcijeTable.id, redoslijed: ilmihalLekcijeTable.redoslijed })
            .from(ilmihalLekcijeTable)
            .where(and(
              eq(ilmihalLekcijeTable.nivo, lekcija.nivo),
              lt(ilmihalLekcijeTable.redoslijed, 9000),
            ));
          const rasporedPosMap = await getRasporedPositionsForStudent(decoded.userId, lekcija.nivo);
          const effMap = resolveEffectiveRedoslijed(regularLekcije, rasporedPosMap);
          const effLekcijaPos = effMap.get(lekcija.id) ?? lekcija.redoslijed;
          // Opcija B: medaljon-lekcija (slug `medaljon-nivo{N}-{ord}`). Ova
          // lekcija JESTE medaljon — gejtuje se posebno (sve regularne lekcije
          // svog bloka moraju biti gotove), a NE kroz generički priorMed gate
          // (čiji bi je redoslijed 9000+ pogrešno zaključao iza zadnje etape).
          const medLessonMatch = lekcija.slug?.match(/^medaljon-nivo(\d+)-(\d+)$/);
          // DODATAK lekcije (slug `dodatak-nivo{N}-{n}`) nisu dio ilmihal
          // progresije — dodatni sadržaj, uvijek dostupan (bez etapa-gatinga).
          const dodatakMatch = lekcija.slug?.match(/^dodatak-nivo\d+/);
          if (dodatakMatch) {
            // bez gatinga — DODATAK je uvijek otključan
          } else if (medLessonMatch) {
            const ordinal = parseInt(medLessonMatch[2], 10);
            const medaljoniNivoa = await db
              .select({ id: medaljoniTable.id, posAfterRedoslijed: medaljoniTable.posAfterRedoslijed })
              .from(medaljoniTable)
              .where(eq(medaljoniTable.nivo, lekcija.nivo))
              .orderBy(asc(medaljoniTable.posAfterRedoslijed));
            const target = ordinal >= 1 ? medaljoniNivoa[ordinal - 1] : undefined;
            if (!target) {
              // Ordinal ne mapira na stvarni medaljon nivoa (config drift) —
              // zaključaj umjesto da propustiš (fail-closed, ne permisivno).
              lockedReason = "Ovaj medaljon još nije konfigurisan.";
            } else {
              const [progRow] = await db
                .select({ completed: studentProgressTable.completedLessons })
                .from(studentProgressTable)
                .where(eq(studentProgressTable.studentId, studentId))
                .limit(1);
              const doneSet = new Set((progRow?.completed as number[] | undefined) ?? []);
              const trebaju = regularLekcije.filter(
                (l) => (effMap.get(l.id) ?? l.redoslijed) <= target.posAfterRedoslijed,
              );
              const nedostaje = trebaju.filter((l) => !doneSet.has(l.id)).length;
              if (nedostaje > 0) {
                lockedReason = "Završi sve lekcije ovog bloka da otključaš medaljon.";
              }
            }
          } else {
          // 1) Prethodno krunisanje za nivoe > 1.
          if (lekcija.nivo > 1) {
            const [prevKrun] = await db
              .select()
              .from(krunisanjaTable)
              .where(eq(krunisanjaTable.nivo, lekcija.nivo - 1))
              .limit(1);
            const prevIds = Array.isArray(prevKrun?.kvizPitanjaIds)
              ? (prevKrun!.kvizPitanjaIds as number[])
              : [];
            if (prevKrun && prevKrun.isGating && prevIds.length > 0) {
              const [pass] = await db
                .select({ id: studentKrunisanjaTable.id })
                .from(studentKrunisanjaTable)
                .where(and(
                  eq(studentKrunisanjaTable.studentId, studentId),
                  eq(studentKrunisanjaTable.krunisanjeId, prevKrun.id),
                ))
                .limit(1);
              if (!pass) {
                lockedReason = `Položi krunisanje nivoa ${lekcija.nivo - 1} da otključaš ovu lekciju.`;
              }
            }
          }
          // 2) Prethodna etapa istog nivoa (medaljon sa posAfterRedoslijed < lekcija.redoslijed).
          if (!lockedReason) {
            const medaljoniNivoa = await db
              .select()
              .from(medaljoniTable)
              .where(eq(medaljoniTable.nivo, lekcija.nivo))
              .orderBy(desc(medaljoniTable.posAfterRedoslijed));
            // Prethodna etapa po EFEKTIVNOM redoslijedu studenta (najveći
            // posAfterRedoslijed koji je još uvijek ispod pozicije lekcije).
            const priorMed = medaljoniNivoa.find(
              (m) => m.posAfterRedoslijed < effLekcijaPos,
            );
            // Task #126: poštuj `is_gating` toggle — ako je etapa
            // konfigurisana kao non-gating, NE blokiraj sljedeće lekcije.
            if (priorMed && priorMed.isGating) {
              const [osvojen] = await db
                .select({ medaljonId: studentMedaljoniTable.medaljonId })
                .from(studentMedaljoniTable)
                .where(and(
                  eq(studentMedaljoniTable.studentId, studentId),
                  eq(studentMedaljoniTable.medaljonId, priorMed.id),
                ))
                .limit(1);
              const medImaKviz = Array.isArray(priorMed.kvizPitanjaIds)
                && (priorMed.kvizPitanjaIds as unknown[]).length > 0;
              let priorPassed = !!osvojen;
              if (!priorPassed && !medImaKviz) {
                // Fallback: bez konfigurisanog ispita — prethodne lekcije
                // do `posAfterRedoslijed` moraju biti gotove.
                const [progRow] = await db
                  .select({ completed: studentProgressTable.completedLessons })
                  .from(studentProgressTable)
                  .where(eq(studentProgressTable.studentId, studentId))
                  .limit(1);
                const doneSet = new Set((progRow?.completed as number[] | undefined) ?? []);
                const trebaju = regularLekcije.filter(
                  (l) => (effMap.get(l.id) ?? l.redoslijed) <= priorMed.posAfterRedoslijed,
                );
                priorPassed = trebaju.every((l) => doneSet.has(l.id));
              }
              if (!priorPassed) {
                lockedReason = medImaKviz
                  ? `Položi etapu "${priorMed.naziv}" da otključaš ovu lekciju.`
                  : `Završi sve lekcije etape "${priorMed.naziv}" da otključaš ovu lekciju.`;
              }
            }
          }
          }
          if (lockedReason) {
            return res.status(403).json({
              error: lockedReason,
              locked: true,
              lekcija: {
                id: lekcija.id,
                slug: lekcija.slug,
                naslov: lekcija.naslov,
                nivo: lekcija.nivo,
                redoslijed: lekcija.redoslijed,
              },
            });
          }
        }
      } catch {
        /* nevažeći token — nastavi kao gost */
      }
    }

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
              quizPassedAt: korisnikNapredakTable.quizPassedAt,
            }).from(korisnikNapredakTable)
              .where(and(
                eq(korisnikNapredakTable.userId, userId),
                eq(korisnikNapredakTable.contentType, "ilmihal"),
                eq(korisnikNapredakTable.contentId, lekcija.id),
              ));
            result.userProgress = {
              timeSpentSeconds: napredak?.timeSpentSeconds ?? 0,
              zavrsen: napredak?.zavrsen ?? false,
              // ISO string ili null — frontend koristi za 4. uslov gate-a
              // ("Provjeri znanje" mini-kviz). Samo prisutnost je važna.
              quizPassedAt: napredak?.quizPassedAt ? napredak.quizPassedAt.toISOString() : null,
            };
          } catch {}
        }

        const isAdmin = decoded.role === "admin";
        const isMuallim = decoded.role === "muallim";
        const myId = typeof decoded.userId === "number" ? decoded.userId : null;
        const all = await db.select().from(prilozi).where(eq(prilozi.lekcijaId, lekcija.id)).orderBy(desc(prilozi.createdAt));
        // Vidljivost:
        // - admin vidi sve (i odobrene i one koje čekaju)
        // - muallim vidi sve odobrene + svoje neodobrene (one koje je sam dodao)
        // - studenti vide samo odobrene (h5p + url + embed)
        const visible = isAdmin
          ? all
          : isMuallim
            ? all.filter(a => a.approved || (myId !== null && a.uploadedByUserId === myId))
            : all.filter(a => a.approved && (a.kind === "h5p" || a.kind === "url" || a.kind === "embed"));
        result.prilozi = visible.map(a => {
          let url: string;
          if (a.kind === "url" || a.kind === "embed") url = a.externalUrl || "";
          // H5P static fajlovi: koristimo `/api/uploads/...` jer je `/api`
          // jedini prefix koji u Replit path routing-u sigurno pogađa api-server
          // (a u prod-u behind nginx-u takođe). Auth (cookie ili Bearer) traje.
          else if (a.kind === "h5p") url = `/api/uploads/${a.storedName}`;
          // Fajl — download endpoint sa token-om u query stringu (native browser download).
          // URL već sadrži /api/ prefix pa frontend NE smije dodavati apiBase.
          else url = `/api/admin/prilozi/download/${a.id}`;
          return {
            id: a.id,
            originalName: a.originalName,
            fileSize: a.fileSize,
            mimeType: a.mimeType,
            kind: a.kind,
            externalUrl: a.externalUrl,
            url,
            approved: a.approved,
            hasanatReward: a.hasanatReward,
            createdAt: a.createdAt,
          };
        });
      } catch {}
    }

    await overlayOne(result, "ilmihal_lekcije", getLang(req));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// ── KVIZOVI ───────────────────────────────────────────────────────────────────

// GET /api/content/kvizovi?nivo=1&modul=ilmihal
router.get("/kvizovi", async (req, res) => {
  try {
    const { nivo, modul, lekcijaId } = req.query;
    const lekcijaIdNum = lekcijaId !== undefined ? parseInt(lekcijaId as string, 10) : undefined;
    // Ako klijent pošalje lekcijaId koji nije validan integer, vrati praznu
    // listu umjesto svih kvizova — sprječava nehotičan "fall-through" na
    // nefiltriranu listu kad frontend pogriješi sa parametrom.
    if (lekcijaId !== undefined && (lekcijaIdNum === undefined || !Number.isFinite(lekcijaIdNum))) {
      res.json([]);
      return;
    }
    // pitanjaCount: MAX(JSONB length, banka count). Razlog: read path servira
    // sva JSONB pitanja (uključujući interaktivna markWords/dragDrop/reorder/truefalse
    // koja banka ne sadrži), pa kartica mora da pokaže pravi broj koji učenik vidi.
    const result = await db.select({
      id: kvizoviTable.id,
      nivo: kvizoviTable.nivo,
      slug: kvizoviTable.slug,
      naslov: kvizoviTable.naslov,
      modul: kvizoviTable.modul,
      variant: kvizoviTable.variant,
      pitanja: kvizoviTable.pitanja,
      kategorija: kvizoviTable.kategorija,
      lekcijaId: kvizoviTable.lekcijaId,
      opis: kvizoviTable.opis,
      pitanjaPoSesiji: kvizoviTable.pitanjaPoSesiji,
      isPublished: kvizoviTable.isPublished,
      pitanjaCount: sql<number>`GREATEST(
        (SELECT COUNT(*)::int FROM "kviz_pitanja" WHERE "kviz_pitanja"."kviz_id" = "kvizovi"."id"),
        CASE WHEN jsonb_typeof("kvizovi"."pitanja") = 'array' THEN jsonb_array_length("kvizovi"."pitanja") ELSE 0 END
      )`,
    }).from(kvizoviTable).orderBy(asc(kvizoviTable.nivo), asc(kvizoviTable.id));

    const filtered = result.filter(k => {
      if (nivo && k.nivo !== parseInt(nivo as string)) return false;
      if (modul && k.modul !== modul) return false;
      if (lekcijaIdNum !== undefined && Number.isFinite(lekcijaIdNum) && k.lekcijaId !== lekcijaIdNum) return false;
      return true;
    }).map(k => ({
      ...k,
      pitanjaCount: (k.pitanjaCount ?? 0) > 0
        ? k.pitanjaCount
        : (Array.isArray(k.pitanja) ? k.pitanja.length : 0),
    }));
    await overlayRows(filtered, "kvizovi", getLang(req));
    res.json(filtered);
  } catch (err) {
    req.log.error({ err }, "GET /content/kvizovi failed");
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/content/kvizovi/:slug (with questions)
// Read path je hibridan dok se sve migrira:
//   1) prvo provjerimo `kviz_pitanja` join → ako ima redova, sastavimo `pitanja`
//      iz banke u tom redoslijedu (kanonski izvor istine za nove kvizove),
//   2) inače pada na `kvizovi.pitanja` JSONB (legacy fallback dok admin
//      ne potvrdi da je sve OK i dok ne ugasimo kolonu).
// Frontend dobija ISTI shape u oba slučaja: { question, options, answer, explanation, image }.
router.get("/kvizovi/:slug", async (req, res) => {
  try {
    const [kviz] = await db.select().from(kvizoviTable).where(eq(kvizoviTable.slug, req.params.slug));
    if (!kviz) { res.status(404).json({ error: "Kviz nije pronađen" }); return; }
    const lang = getLang(req);
    await overlayOne(kviz, "kvizovi", lang);

    // STRATEGIJA: JSONB je primarni izvor istine za REDOSLIJED i za interaktivna
    // pitanja (markWords, dragDrop, reorder, true_false, ...). Banka pitanja sadrži
    // samo standardna single/multiple-choice pitanja. Za svako JSONB pitanje koje
    // ima match u banci (po normalizovanom tekstu), koristi se banka verzija
    // (admin može uređivati u banci). Pitanja koja nisu u banci se vraćaju kakva
    // jesu iz JSONB-a (legacy/interactive).
    const jsonbPitanja = Array.isArray(kviz.pitanja) ? (kviz.pitanja as Record<string, unknown>[]) : [];

    const linked = await db
      .select({
        id: pitanjaBankaTable.id,
        pitanje: pitanjaBankaTable.pitanje,
        opcije: pitanjaBankaTable.opcije,
        correctIndex: pitanjaBankaTable.correctIndex,
        correctIndexes: pitanjaBankaTable.correctIndexes,
        correctOrder: pitanjaBankaTable.correctOrder,
        meta: pitanjaBankaTable.meta,
        vrsta: pitanjaBankaTable.vrsta,
        objasnjenje: pitanjaBankaTable.objasnjenje,
        slika: pitanjaBankaTable.slika,
      })
      .from(kvizPitanjaTable)
      .innerJoin(pitanjaBankaTable, eq(pitanjaBankaTable.id, kvizPitanjaTable.pitanjeId))
      .where(eq(kvizPitanjaTable.kvizId, kviz.id));

    const norm = (s: string) => s.trim().replace(/\s+/g, " ");
    // KRITIČNO: mapa se gradi po ORIGINALNOM (bosanskom) tekstu pitanja PRIJE
    // overlay-a, jer JSONB pitanja matchamo po bosanskom tekstu. Vrijednosti su
    // reference na iste objekte iz `linked`, pa ih overlay (ispod) svejedno
    // prevede — lookup po bosanskom ključu vrati prevedeni banka red.
    const bankaMap = new Map(linked.map((p) => [norm(p.pitanje), p]));
    await overlayRows(linked, "pitanja_banka", lang);

    // Rekonstruiše originalni JSONB shape za kviz UI iz banka reda. Frontend
    // (kviz.tsx) hendla 4 tipa: single/checkbox = options+answer (|||), truefalse =
    // options=["Da","Ne"]+answer, reorder = items=[{text, order}].
    const fromBank = (p: typeof linked[number]) => {
      const opcije = Array.isArray(p.opcije) ? (p.opcije as string[]) : [];
      const base = {
        question: p.pitanje,
        explanation: p.objasnjenje || undefined,
        image: p.slika || undefined,
      };

      if (p.vrsta === "reorder") {
        const order = Array.isArray(p.correctOrder) ? (p.correctOrder as number[]) : [];
        const items = opcije.map((text, i) => ({ text, order: order[i] ?? (i + 1) }));
        return { ...base, type: "reorder", items };
      }

      if (p.vrsta === "truefalse") {
        const opts = opcije.length === 2 ? opcije : ["Da", "Ne"];
        const idx = Math.min(Math.max(0, p.correctIndex ?? 0), 1);
        return { ...base, type: "truefalse", options: opts, answer: opts[idx] };
      }

      if (p.vrsta === "dragDrop") {
        const m = (p.meta ?? {}) as { template?: string[]; words?: string[]; correct?: string[] };
        return {
          ...base,
          type: "dragDrop",
          template: Array.isArray(m.template) ? m.template : [],
          words: Array.isArray(m.words) ? m.words : [],
          correct: Array.isArray(m.correct) ? m.correct : [],
        };
      }

      if (p.vrsta === "markWords") {
        const m = (p.meta ?? {}) as { text?: string; words?: string[]; incorrect?: string[] };
        return {
          ...base,
          type: "markWords",
          text: typeof m.text === "string" ? m.text : "",
          words: Array.isArray(m.words) ? m.words : [],
          incorrect: Array.isArray(m.incorrect) ? m.incorrect : [],
        };
      }

      // single / multiple
      const idxs = Array.isArray(p.correctIndexes) && p.correctIndexes.length > 0
        ? (p.correctIndexes as number[])
        : [Math.min(Math.max(0, p.correctIndex ?? 0), Math.max(0, opcije.length - 1))];
      const answer = idxs.map((i) => opcije[i] ?? "").filter((s) => s.length > 0).join("|||");
      return { ...base, options: opcije, answer };
    };

    if (jsonbPitanja.length > 0) {
      const pitanja = jsonbPitanja.map((p) => {
        // KRITIČNO: za dragDrop/markWords NE radi banka lookup po tekstu.
        // Generička pitanja kao "Dopuni:" i "Pronađi greške:" imaju 40+
        // varijanti u banci sa istim tekstom ali RAZLIČITIM meta (template/
        // words/correct/incorrect). Lookup po tekstu bi vratio PRVU/POSLJEDNJU
        // varijantu (Map kolapsira po ključu) i učenik bi vidio pogrešne
        // riječi. JSONB već ima ispravan inline meta — koristi ga direktno.
        const tipRaw = (typeof p?.type === "string" ? p.type : "").toLowerCase();
        const isInteractive = tipRaw === "dragdrop" || tipRaw === "markwords";
        if (isInteractive) return p;

        const q = typeof p?.question === "string" ? p.question : null;
        if (q) {
          const fromBankRow = bankaMap.get(norm(q));
          if (fromBankRow) return fromBank(fromBankRow);
        }
        return p; // ostala interaktivna (reorder/truefalse) ako nemaju banka match
      });
      res.json({ ...kviz, pitanja });
      return;
    }

    // Edge case: nema JSONB-a, ali postoje veze u banci → vrati banku po redoslijedu insert-a
    if (linked.length > 0) {
      const pitanja = linked.map(fromBank);
      res.json({ ...kviz, pitanja });
      return;
    }

    res.json(kviz);
  } catch (err) {
    req.log.error({ err, slug: req.params.slug }, "GET /content/kvizovi/:slug failed");
    res.status(500).json({ error: "Greška servera" });
  }
});

// ── KNJIGE/ČITAONICA ─────────────────────────────────────────────────────────

// GET /api/content/kategorije-knjiga
// Public endpoint — vraća sve kategorije sortirane po `redoslijed`.
// Frontend koristi ovo da grupiše priče u akordion-sekcije.
router.get("/kategorije-knjiga", async (_req, res) => {
  try {
    const result = await db.select({
      id: kategorijeKnjigeTable.id,
      slug: kategorijeKnjigeTable.slug,
      naziv: kategorijeKnjigeTable.naziv,
      opis: kategorijeKnjigeTable.opis,
      redoslijed: kategorijeKnjigeTable.redoslijed,
      defaultOpen: kategorijeKnjigeTable.defaultOpen,
    }).from(kategorijeKnjigeTable)
      .orderBy(asc(kategorijeKnjigeTable.redoslijed), asc(kategorijeKnjigeTable.id));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/content/knjige?kategorija=prica
// Public endpoint — vraća SAMO objavljene knjige (isPublished = true).
// Admin za uređivanje koristi /api/admin/knjige koji vraća sve uključujući neobjavljene.
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
    }).from(knjige)
      .where(eq(knjige.isPublished, true))
      .orderBy(asc(knjige.redoslijed), asc(knjige.id));

    const filtered = kategorija ? result.filter(k => k.kategorija === kategorija) : result;
    await overlayRows(filtered, "knjige", getLang(req));
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/content/knjige/:slug
// Public endpoint — neobjavljene knjige vraćaju 404 (kao da ne postoje).
router.get("/knjige/:slug", async (req, res) => {
  try {
    const [knjiga] = await db.select().from(knjige).where(eq(knjige.slug, req.params.slug));
    if (!knjiga || !knjiga.isPublished) { res.status(404).json({ error: "Knjiga nije pronađena" }); return; }
    // Povezivanje knjige sa kvizom po konvenciji slug = `kviz-{knjiga.slug}` i modul='knjige'.
    // Ovo se izračunava u runtime-u jer schema `knjige` nema kolonu kvizSlug.
    const expectedKvizSlug = `kviz-${knjiga.slug}`;
    const [kviz] = await db.select({ slug: kvizoviTable.slug })
      .from(kvizoviTable)
      .where(and(eq(kvizoviTable.modul, "knjige"), eq(kvizoviTable.slug, expectedKvizSlug)))
      .limit(1);
    await overlayOne(knjiga, "knjige", getLang(req));
    res.json({ ...knjiga, kvizSlug: kviz?.slug ?? null });
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
// SERVER-SIDE preko heartbeat-a (POST /content/heartbeat) — klijent ne može
// poslati lažni `timeSpentSeconds` jer se on ignoriše za ilmihal gate.
const MIN_ACTIVE_SECONDS_FOR_ILMIHAL_COMPLETION = 300;

// Uvodne lekcije ("uvodna-rijec", "uvodna-rijec-nivo-2", "uvodna-rijec-nivo-3")
// su kratke (1–2KB HTML), nemaju kviz i služe kao motivirajući uvod. Za njih
// 5 minuta čitanja nije realno pa bi učenik nikad ne mogao otključati prvo
// dugme "Označi kao završeno". Snižavamo prag na 30s SAMO za te slugove
// (slug.startsWith('uvodna-rijec')). Sve ostale lekcije zadržavaju 300s.
const INTRO_MIN_ACTIVE_SECONDS_FOR_ILMIHAL_COMPLETION = 30;
function isIntroSlug(slug: string | null | undefined): boolean {
  return typeof slug === "string" && slug.startsWith("uvodna-rijec");
}

// Maksimalno koliko sekundi jedan heartbeat može dodati u `time_spent_seconds`.
// Pošto delta = min(MAX, NOW() - last_heartbeat_at), ukupno akumulirano vrijeme
// nikad ne može premašiti realno proteklo vrijeme između prvog i posljednjeg
// heartbeat-a. Cap od 15s sprječava da se idle/zatvoreni tab vrati i odjednom
// "doda" sate čitanja jednim hb-om.
const HEARTBEAT_MAX_DELTA_SECONDS = 15;

// POST /api/content/napredak - save progress (bodovi only if >= 50%)
router.post("/napredak", requireAuth, async (req, res) => {
  try {
    const { contentType, contentId, zavrsen, bodovi, tacniOdgovori, ukupnoPitanja, timeSpentSeconds, quizPassed } = req.body;
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
    // tip koji award path koristi. Ujedno čitamo `kvizPitanja` da znamo
    // ima li lekcija mini-kviz "Provjeri znanje" — koristi se za 4. uslov
    // gate-a niže.
    let lekcijaHasQuiz = false;
    let lekcijaSlug: string | null = null;
    if (contentType === "ilmihal") {
      const [lekcijaRow] = await db
        .select({ id: ilmihalLekcijeTable.id, slug: ilmihalLekcijeTable.slug, kvizPitanja: ilmihalLekcijeTable.kvizPitanja })
        .from(ilmihalLekcijeTable)
        .where(eq(ilmihalLekcijeTable.id, contentId))
        .limit(1);
      if (!lekcijaRow) {
        res.status(404).json({ error: "lekcija_not_found" });
        return;
      }
      lekcijaSlug = lekcijaRow.slug ?? null;
      // "Ima kviz" znači ≥1 validno pitanje (sa tekstom i ≥2 opcije i answer-om).
      // Slabija provjera (samo length > 0) bi spriječila completion za legacy
      // lekcije sa praznim/malformed pitanjima koja UI ionako ne renderira.
      const pitanja = Array.isArray(lekcijaRow.kvizPitanja) ? lekcijaRow.kvizPitanja : [];
      lekcijaHasQuiz = pitanja.some((p: any) =>
        p && typeof p?.question === "string" && p.question.trim().length > 0
        && Array.isArray(p?.options) && p.options.filter((o: any) => typeof o === "string" && o.trim().length > 0).length >= 2
        && typeof p?.answer === "string" && p.answer.trim().length > 0
      );
    }

    const procenat = ukupnoPitanja > 0 ? Math.round((tacniOdgovori / ukupnoPitanja) * 100) : 0;
    const stvarniBodovi = procenat >= 50 ? (bodovi || 0) : 0;

    // Validiraj timeSpentSeconds — clamp negativne i ekstremno velike vrijednosti.
    // Ako klijent ne pošalje, tretiraj kao 0 (legacy klijent).
    // VAŽNO: za `ilmihal` ova vrijednost se IGNORIŠE i za gate i za upis u DB.
    // Vrijeme se za ilmihal akumulira isključivo preko POST /content/heartbeat
    // (server-side delta sa cap-om 15s/hb). To je fiks za cheat: ranije je
    // tehnički vješt korisnik mogao poslati `timeSpentSeconds: 300` direktno
    // preko curl-a i otključati Aferime bez stvarnog čitanja.
    // Za druge contentType (kviz, knjiga) i dalje prihvatamo (legacy ponašanje).
    const incomingTime = typeof timeSpentSeconds === "number" && Number.isFinite(timeSpentSeconds)
      ? Math.max(0, Math.min(86400, Math.floor(timeSpentSeconds))) // max 24h jednostranog updatea
      : 0;

    // Pročitamo trenutni red SAMO za potrebe gate-a (zavrsen + stored time).
    const existing = await db.select().from(korisnikNapredakTable)
      .where(and(
        eq(korisnikNapredakTable.userId, userId),
        eq(korisnikNapredakTable.contentType, contentType),
        eq(korisnikNapredakTable.contentId, contentId),
      ));

    const storedTime = existing.length > 0 ? existing[0].timeSpentSeconds : 0;
    const wasAlreadyCompleted = existing.length > 0 && existing[0].zavrsen;
    const existingQuizPassedAt = existing.length > 0 ? existing[0].quizPassedAt : null;
    // Kviz je "položen" ako je već prije zabilježen ILI ako klijent u ovom
    // istom requestu šalje `quizPassed: true` (tipično: učenik u markComplete
    // već zna da je tačno odgovorio na sva pitanja). Drugi scenarij olakšava
    // race kad klijent paralelno šalje quizPassed i zavrsen u jednom kliku.
    const quizPassedNowOrBefore = !!existingQuizPassedAt || quizPassed === true;

    // GATE: za prvo označavanje ilmihal lekcije kao završene zahtijevaj
    // minimum 300 sekundi aktivnog čitanja. Već završene lekcije mogu se
    // i dalje "potvrditi" bez vremenskog praga.
    // VAŽNO: gate koristi ISKLJUČIVO server-store vrijeme (storedTime), ne
    // prihvata client-poslano `incomingTime`. Server-store vrijeme za ilmihal
    // raste samo preko heartbeat endpoint-a (gdje delta računa server iz
    // razlike NOW() - last_heartbeat_at, cap 15s). Tako klijent ne može
    // jednim curl-om proći gate.
    const effectiveMinSeconds = isIntroSlug(lekcijaSlug)
      ? INTRO_MIN_ACTIVE_SECONDS_FOR_ILMIHAL_COMPLETION
      : MIN_ACTIVE_SECONDS_FOR_ILMIHAL_COMPLETION;
    if (
      zavrsen === true &&
      contentType === "ilmihal" &&
      !wasAlreadyCompleted &&
      storedTime < effectiveMinSeconds
    ) {
      res.status(422).json({
        error: "min_time_not_reached",
        message: `Lekciju možeš označiti kao završenu nakon ${effectiveMinSeconds} sekundi aktivnog čitanja.`,
        minSeconds: effectiveMinSeconds,
        currentSeconds: storedTime,
      });
      return;
    }

    // GATE: 4. uslov — mini-kviz "Provjeri znanje". Ako lekcija ima validna
    // pitanja u `kvizPitanja`, učenik mora biti tačno odgovorio na sva
    // (zabilježeno kao `quiz_passed_at`) prije nego se completion odobri.
    // Već završene lekcije i lekcije bez pitanja prolaze automatski.
    if (
      zavrsen === true &&
      contentType === "ilmihal" &&
      !wasAlreadyCompleted &&
      lekcijaHasQuiz &&
      !quizPassedNowOrBefore
    ) {
      res.status(422).json({
        error: "quiz_not_passed",
        message: "Prvo tačno odgovori na sva pitanja u kvizu \"Provjeri znanje\" prije nego označiš lekciju kao završenu.",
      });
      return;
    }

    // Za ilmihal — NIKAD ne dozvoli `timeSpentSeconds` da raste preko ovog
    // endpointa. Heartbeat je jedini path. Za ostale tipove (kviz, knjiga)
    // ponašanje ostaje legacy GREATEST(stored, incoming).
    const timeWriteValue = contentType === "ilmihal" ? 0 : incomingTime;

    let result;
    if (existing.length > 0) {
      const current = existing[0];
      // ATOMSKI UPDATE: koristimo SQL GREATEST/COALESCE da spriječimo race
      // između paralelnih /napredak poziva (npr. heartbeat + final
      // markComplete). Bez ovoga read-then-write može upisati MANJI time
      // i poništiti nedavno napredovanje.
      const [updated] = await db.update(korisnikNapredakTable)
        .set({
          // Boolean OR — kad jednom postane true, ne pada na false.
          zavrsen: sql`${korisnikNapredakTable.zavrsen} OR ${!!zavrsen}`,
          bodovi: sql`GREATEST(${korisnikNapredakTable.bodovi}, ${stvarniBodovi})`,
          pokusaji: sql`${korisnikNapredakTable.pokusaji} + 1`,
          // Za ilmihal: timeWriteValue je 0, GREATEST ostavlja postojeći.
          // Za kviz/knjiga: legacy GREATEST(stored, incoming).
          timeSpentSeconds: sql`GREATEST(${korisnikNapredakTable.timeSpentSeconds}, ${timeWriteValue})`,
          // completedAt: postavi tek prvi put kad postane završeno.
          completedAt: zavrsen
            ? (current.completedAt ?? new Date())
            : current.completedAt,
          // quizPassedAt: postavi tek prvi put kad učenik tačno odgovori na
          // sva pitanja. Idempotentno — kasniji `quizPassed: true` requestovi
          // ne mijenjaju već postojeći timestamp.
          quizPassedAt: quizPassed === true
            ? (current.quizPassedAt ?? new Date())
            : current.quizPassedAt,
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
        timeSpentSeconds: timeWriteValue,
        completedAt: zavrsen ? new Date() : undefined,
        quizPassedAt: quizPassed === true ? new Date() : undefined,
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

    // Opcija B: ako je upravo PRVI put završena medaljon-lekcija
    // (slug `medaljon-nivo{N}-{ord}`), osvoji odgovarajući medaljon. Time/kviz
    // gate iznad već garantuje da je lekcija stvarno odrađena (uz položen
    // mini-kviz ako ga ima), pa je ovo ekvivalent "položio etapu". Idempotentno.
    if (zavrsen && contentType === "ilmihal" && !wasAlreadyCompleted && lekcijaSlug) {
      const med = lekcijaSlug.match(/^medaljon-nivo(\d+)-(\d+)$/);
      if (med) {
        try {
          const medNivo = parseInt(med[1], 10);
          const ordinal = parseInt(med[2], 10);
          if (ordinal >= 1) {
            const medaljoni = await db
              .select({ id: medaljoniTable.id })
              .from(medaljoniTable)
              .where(eq(medaljoniTable.nivo, medNivo))
              .orderBy(asc(medaljoniTable.posAfterRedoslijed));
            const target = medaljoni[ordinal - 1];
            if (target) {
              await db
                .insert(studentMedaljoniTable)
                .values({ studentId: String(userId), medaljonId: target.id })
                .onConflictDoNothing();
            }
          }
        } catch (e) {
          req.log.error({ e }, "medaljon claim on lesson completion failed");
        }
      }
    }

    res.json({ ...result, procenat, bodoviBlokirani: procenat < 50, progressDelta });
  } catch (err) {
    // Logiraj puni error u Coolify/Pino logove tako da se 500 ne svodi
    // samo na "Greška servera" kod debuggovanja produkcije. Bez ovoga je
    // catch tihi i pravi uzrok (npr. nedostaje kolona, schema drift) ostaje
    // skriven.
    req.log.error({ err }, "POST /content/napredak failed");
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/content/heartbeat — server-side mjerenje vremena čitanja.
//
// Klijent šalje "živ sam, čitam X" svakih ~10s. Server na svakom hb-u:
//   delta = min(HEARTBEAT_MAX_DELTA_SECONDS, NOW() - last_heartbeat_at)
//   time_spent_seconds += delta
//   last_heartbeat_at = NOW()
//
// SIGURNOST: Pošto svaka delta je upper-bounded sa (NOW() - last_heartbeat_at),
// suma svih delta ≤ realno proteklo vrijeme. Klijent NE MOŽE poslati lažni
// timestamp — server koristi samo svoj sat. Cap od 15s sprječava da idle/zatvoreni
// tab koji se vrati nakon sata "doda" sat čitanja jednim hb-om.
//
// Idle protection: ako klijent ne šalje hb (zatvoren tab, prebacio se na drugi),
// stari `last_heartbeat_at` će biti dalek u prošlosti i sljedeći hb će dodati
// max 15s. Aktivno čitanje sa hb svakih 10s daje ~10s po hb.
//
// First heartbeat: kreira red sa time=0 i lastHb=NOW(). Tek SLJEDEĆI hb dodaje
// stvarno vrijeme. Tako prvi poziv ne dodaje ništa (ne znamo otkad korisnik
// gleda stranicu).
// Trenutno samo ilmihal koristi heartbeat (300s gate). Ostali tipovi
// (kviz/knjiga) ne mjere vrijeme čitanja — ograničavamo allow-list da
// smanjimo abuse surface (random POST-ovi sa bilo kojim contentType
// ne mogu kreirati napredak redove).
const HEARTBEAT_ALLOWED_CONTENT_TYPES = new Set(["ilmihal"]);

router.post("/heartbeat", requireAuth, async (req, res) => {
  try {
    const { contentType, contentId } = req.body;
    const userId = req.user!.userId;

    if (typeof contentType !== "string" || !HEARTBEAT_ALLOWED_CONTENT_TYPES.has(contentType)) {
      res.status(400).json({ error: "invalid_content_type" });
      return;
    }
    if (typeof contentId !== "number" || !Number.isFinite(contentId) || contentId <= 0) {
      res.status(400).json({ error: "invalid_content_id" });
      return;
    }

    // Anti-farm: validacija da lekcija stvarno postoji.
    const [lekcijaRow] = await db
      .select({ id: ilmihalLekcijeTable.id })
      .from(ilmihalLekcijeTable)
      .where(eq(ilmihalLekcijeTable.id, contentId))
      .limit(1);
    if (!lekcijaRow) {
      res.status(404).json({ error: "lekcija_not_found" });
      return;
    }

    // Atomski INSERT ... ON CONFLICT DO UPDATE. Sva matematika u SQL-u —
    // koristi NOW() i postojeći last_heartbeat_at iz konfliktnog reda. Tako:
    //   - prvi heartbeat: INSERT sa time=0, last_hb=NOW(), delta=0 (init)
    //   - svaki naredni: UPDATE sa time += LEAST(15, NOW() - last_hb),
    //     last_hb = NOW(). Suma svih delta ≤ realno proteklo vrijeme.
    //   - paralelni hb-i (npr. dva taba): drugi vidi svjež last_hb od prvog,
    //     pa daje delta = ~0. Nema dvostrukog brojanja, nema duplih redova
    //     (unique constraint + ON CONFLICT garantuju jedan red po ključu).
    //
    // COALESCE pokriva legacy redove gdje last_heartbeat_at = NULL (kreirani
    // prije ove migracije preko /napredak): treti se kao da je hb upravo
    // sada → delta = 0. Sljedeći hb daje pravu deltu.
    //
    // EXCLUDED.* referencira vrijednosti koje smo POKUŠALI insertovati;
    // koristimo `korisnik_napredak.*` da pristupimo POSTOJEĆIM vrijednostima
    // konfliktnog reda (npr. njegov last_heartbeat_at i time_spent_seconds).
    const result = await db.execute(sql`
      INSERT INTO korisnik_napredak (
        user_id, content_type, content_id, zavrsen, bodovi, pokusaji,
        time_spent_seconds, last_heartbeat_at, created_at, updated_at
      )
      VALUES (
        ${userId}, ${contentType}, ${contentId}, false, 0, 1,
        0, NOW(), NOW(), NOW()
      )
      ON CONFLICT (user_id, content_type, content_id) DO UPDATE SET
        time_spent_seconds = korisnik_napredak.time_spent_seconds
          + LEAST(
              ${HEARTBEAT_MAX_DELTA_SECONDS}::int,
              GREATEST(
                0,
                FLOOR(EXTRACT(EPOCH FROM (NOW() - COALESCE(korisnik_napredak.last_heartbeat_at, NOW()))))::int
              )
            ),
        last_heartbeat_at = NOW(),
        updated_at = NOW()
      RETURNING
        time_spent_seconds AS new_time,
        (xmax = 0) AS inserted
    `);

    const row = (result as unknown as { rows: { new_time: number; inserted: boolean }[] }).rows[0];
    const newTime = Number(row?.new_time ?? 0);
    const inserted = !!row?.inserted;

    res.json({
      timeSpentSeconds: newTime,
      // Deltu klijent može sam izračunati ako mu treba; vraćamo i radi UI feedbacka.
      // Za prvi (init) heartbeat delta je 0 — ne računamo iz starog stanja jer
      // upsert ne vraća prethodnu vrijednost atomski.
      initialized: inserted,
    });
  } catch (err) {
    req.log.error({ err }, "POST /content/heartbeat failed");
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
    // Kapi meda (DB total_hasanat): 2 po tačnom odgovoru kad je rezultat ≥ 50%.
    // Npr. 20 tačnih = 40 kapi meda. Ranije: procenat/10 (max 10). Povećano
    // po zahtjevu — znanje vrijedi više nego igrica.
    const bodovi = procenat >= 50 ? tacniOdgovori * 2 : 0;

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

router.get("/rjecnik", async (req, res) => {
  try {
    const rows = await db.select({
      id: rjecnikTable.id,
      rijec: rjecnikTable.rijec,
      definicija: rjecnikTable.definicija,
    }).from(rjecnikTable).orderBy(asc(rjecnikTable.rijec));
    await overlayRows(rows, "rjecnik", getLang(req));
    const dict: Record<string, string> = {};
    for (const r of rows) dict[r.rijec] = r.definicija;
    res.json(dict);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// Javni override sloj za UI/interfejs prijevode. Frontend ga učita pri startu i
// primijeni u t() PRIJE bundlanih locales/*.json. Vraća { jezik: { kljuc: prijevod } }.
router.get("/ui-prijevodi", async (_req, res) => {
  try {
    const result = (await db.execute(
      sql`SELECT jezik, kljuc, prijevod FROM ui_prijevodi`,
    )) as unknown as { rows: { jezik: string; kljuc: string; prijevod: string }[] };
    const out: Record<string, Record<string, string>> = {};
    for (const r of result.rows) {
      (out[r.jezik] ??= {})[r.kljuc] = r.prijevod;
    }
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// Javna kontakt forma. Šalje poruku posjetioca na info@mekteb.net. Jednostavan
// in-memory rate limit (max 5 poruka po IP-u u 10 minuta) sprječava zloupotrebu.
const kontaktHits = new Map<string, number[]>();
const KONTAKT_WINDOW_MS = 10 * 60 * 1000;
const KONTAKT_MAX = 5;

router.post("/kontakt", async (req, res) => {
  try {
    const ip = (req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.ip || "?").trim();
    const now = Date.now();

    // Periodično očisti stale unose da kontaktHits Map ne raste neograničeno.
    if (kontaktHits.size > 5000) {
      for (const [key, times] of kontaktHits) {
        const fresh = times.filter((t) => now - t < KONTAKT_WINDOW_MS);
        if (fresh.length === 0) kontaktHits.delete(key);
        else kontaktHits.set(key, fresh);
      }
    }

    const hits = (kontaktHits.get(ip) || []).filter((t) => now - t < KONTAKT_WINDOW_MS);
    if (hits.length >= KONTAKT_MAX) {
      return res.status(429).json({ error: "Previše poruka. Pokušajte ponovo za nekoliko minuta." });
    }

    const ime = String(req.body?.ime ?? "").trim();
    const email = String(req.body?.email ?? "").trim();
    const predmet = String(req.body?.predmet ?? "").trim();
    const poruka = String(req.body?.poruka ?? "").trim();

    if (!ime || !email || !poruka) {
      return res.status(400).json({ error: "Molimo popunite ime, email i poruku." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Unesite ispravnu email adresu." });
    }
    if (ime.length > 120 || email.length > 160 || predmet.length > 200 || poruka.length > 5000) {
      return res.status(400).json({ error: "Unos je predugačak." });
    }

    hits.push(now);
    kontaktHits.set(ip, hits);

    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#0d9488;padding:20px;border-radius:12px 12px 0 0">
          <h2 style="color:white;margin:0">Nova poruka — Kontakt forma</h2>
        </div>
        <div style="padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:6px 12px;font-weight:bold;border:1px solid #e5e7eb">Ime</td><td style="padding:6px 12px;border:1px solid #e5e7eb">${esc(ime)}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:bold;border:1px solid #e5e7eb">Email</td><td style="padding:6px 12px;border:1px solid #e5e7eb">${esc(email)}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:bold;border:1px solid #e5e7eb">Predmet</td><td style="padding:6px 12px;border:1px solid #e5e7eb">${esc(predmet) || "—"}</td></tr>
          </table>
          <p style="margin:16px 0 4px;font-weight:bold;color:#111827">Poruka:</p>
          <p style="white-space:pre-wrap;color:#374151;line-height:1.6;margin:0">${esc(poruka)}</p>
          <p style="margin-top:16px;color:#6b7280;font-size:14px">Poslano preko kontakt forme na mekteb.net</p>
        </div>
      </div>
    `;

    const sent = await sendEmail(
      "info@mekteb.net",
      `[Mekteb.net] Kontakt: ${predmet || "(bez predmeta)"}`,
      html,
    );
    if (!sent) {
      return res.status(502).json({
        error: "Slanje poruke trenutno nije uspjelo. Pokušajte ponovo ili nam pišite direktno na info@mekteb.net.",
      });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

export default router;
