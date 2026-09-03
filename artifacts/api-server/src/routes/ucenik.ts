import { Router } from "express";
import fs from "fs";
import path from "path";
import { db } from "@workspace/db";
import {
  usersTable,
  ucenikProfiliTable,
  grupeTable,
  ocjeneTable,
  priustvoTable,
  mektebKalendarTable,
  planLekcijaTable,
  kvizRezultatiTable,
  studentProgressTable,
  ilmihalLekcijeTable,
  zadaceTable,
  zadaceUceniciTable,
  zadacePriloziTable,
  zadaceStatusTable,
  prilozi,
  etapaPolaganjaTable,
  medaljoniTable,
  studentKrunisanjaTable,
  krunisanjaTable,
  mektebDokumentiTable,
} from "@workspace/db/schema";
import { eq, and, asc, desc, count, inArray, sql, or, notInArray, exists, gte } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { BADGE_CATALOG, type EarnedBadge, evaluateAndPersistBadges, buildProgressSnapshot, computeBadgeProgress } from "../lib/badges.js";
import { streamDokument } from "../lib/dokumenti.js";
import { getStudentGodine, razrijesiGodinu } from "../lib/mektebska-godina.js";
import { getNapametKatalog } from "../data/napamet.js";

const router = Router();
router.use(requireAuth, requireRole("ucenik"));

async function getZadacaPrilozi(zadacaIds: number[]) {
  const result = new Map<number, Array<{ id: number; originalName: string; mimeType: string; fileSize: number; kind: string; externalUrl: string | null }>>();
  if (!zadacaIds.length) return result;
  const rows = await db.select({
    zadacaId: zadacePriloziTable.zadacaId, id: prilozi.id, originalName: prilozi.originalName,
    mimeType: prilozi.mimeType, fileSize: prilozi.fileSize, kind: prilozi.kind, externalUrl: prilozi.externalUrl,
  }).from(zadacePriloziTable).innerJoin(prilozi, eq(zadacePriloziTable.prilogId, prilozi.id))
    .where(inArray(zadacePriloziTable.zadacaId, zadacaIds));
  for (const row of rows) {
    const list = result.get(row.zadacaId) || [];
    list.push({ id: row.id, originalName: row.originalName, mimeType: row.mimeType, fileSize: row.fileSize, kind: row.kind, externalUrl: row.externalUrl });
    result.set(row.zadacaId, list);
  }
  return result;
}

// Privatni file prilog je dostupan samo učeniku kojem je zadaća dodijeljena.
router.get("/zadace/:zadacaId/prilozi/:prilogId/download", async (req, res) => {
  try {
    const zadacaId = Number(req.params.zadacaId);
    const prilogId = Number(req.params.prilogId);
    if (!Number.isInteger(zadacaId) || !Number.isInteger(prilogId)) { res.status(400).json({ error: "Nevažeći ID" }); return; }
    const [zadaca] = await db.select().from(zadaceTable).where(eq(zadaceTable.id, zadacaId));
    if (!zadaca) { res.status(404).json({ error: "Zadaća nije pronađena" }); return; }
    const targets = await db.select({ ucenikId: zadaceUceniciTable.ucenikId }).from(zadaceUceniciTable).where(eq(zadaceUceniciTable.zadacaId, zadacaId));
    const [profil] = await db.select({ grupaId: ucenikProfiliTable.grupaId }).from(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, req.user!.userId));
    if (zadaca.grupaId !== profil?.grupaId || (targets.length && !targets.some(t => t.ucenikId === req.user!.userId))) { res.status(403).json({ error: "Nemate pristup ovom prilogu" }); return; }
    const [file] = await db.select({ originalName: prilozi.originalName, storedName: prilozi.storedName, mimeType: prilozi.mimeType, kind: prilozi.kind })
      .from(zadacePriloziTable).innerJoin(prilozi, eq(zadacePriloziTable.prilogId, prilozi.id))
      .where(and(eq(zadacePriloziTable.zadacaId, zadacaId), eq(zadacePriloziTable.prilogId, prilogId)));
    if (!file || file.kind !== "file") { res.status(404).json({ error: "Fajl nije pronađen" }); return; }
    const filePath = path.join(process.env["UPLOADS_DIR"] || path.join(process.cwd(), "uploads"), path.basename(file.storedName));
    if (!fs.existsSync(filePath)) { res.status(404).json({ error: "Fajl nije pronađen na serveru" }); return; }
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
    res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
    res.setHeader("Cache-Control", "private, no-cache");
    fs.createReadStream(filePath).pipe(res);
  } catch { res.status(500).json({ error: "Greška servera" }); }
});

// GET /api/ucenik/profil — student's own profile + stats
router.get("/profil", async (req, res) => {
  try {
    const userId = req.user!.userId;

    const [user] = await db.select({
      id: usersTable.id,
      displayName: usersTable.displayName,
      username: usersTable.username,
      role: usersTable.role,
      createdAt: usersTable.createdAt,
    }).from(usersTable).where(eq(usersTable.id, userId));

    const [profil] = await db.select().from(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, userId));

    let grupa = null;
    let muallim = null;
    if (profil?.grupaId) {
      const [g] = await db.select().from(grupeTable).where(eq(grupeTable.id, profil.grupaId));
      grupa = g || null;
    }
    if (profil?.muallimId) {
      const [m] = await db.select({ id: usersTable.id, displayName: usersTable.displayName })
        .from(usersTable).where(eq(usersTable.id, profil.muallimId));
      muallim = m || null;
    }

    // Filter po mektebskoj godini (vremenska granica). Default = tekuća godina.
    // Napredak (lekcije/med/aferimi/kvizovi) se NE filtrira — uvijek kumulativno.
    const godineInfo = await getStudentGodine(userId);
    const odabir = razrijesiGodinu(godineInfo, req.query.mektebskaGodina as string | undefined);
    const filterGrupe = odabir.grupaIds; // null = bez filtera (prikaži sve)

    let ocjene = await db.select().from(ocjeneTable)
      .where(eq(ocjeneTable.ucenikId, userId))
      .orderBy(desc(ocjeneTable.createdAt));

    let prisustvo = await db.select().from(priustvoTable)
      .where(eq(priustvoTable.ucenikId, userId))
      .orderBy(desc(priustvoTable.createdAt));

    if (filterGrupe) {
      const grupeSet = new Set(filterGrupe);
      // Ocjene: prikaži one iz odabrane godine; ocjene bez grupe (legacy) samo
      // u tekućoj godini (da se ništa ne sakrije u default prikazu).
      ocjene = ocjene.filter(o =>
        (o.grupaId != null && grupeSet.has(o.grupaId)) ||
        (o.grupaId == null && odabir.jeTekuca),
      );
      prisustvo = prisustvo.filter(p => p.grupaId != null && grupeSet.has(p.grupaId));
    }

    const kvizovi = await db.select().from(kvizRezultatiTable)
      .where(eq(kvizRezultatiTable.userId, userId))
      .orderBy(desc(kvizRezultatiTable.completedAt))
      .limit(50);

    // Napredak učenja: streak, hasanati, završene lekcije po nivou
    const studentIdStr = String(userId);
    const [progress] = await db.select().from(studentProgressTable)
      .where(eq(studentProgressTable.studentId, studentIdStr)).limit(1);

    const lekcijePoNivou = await db.select({
      nivo: ilmihalLekcijeTable.nivo,
      ukupno: count(),
    }).from(ilmihalLekcijeTable)
      .where(eq(ilmihalLekcijeTable.isPublished, true))
      .groupBy(ilmihalLekcijeTable.nivo);

    const completedLessonIds = (progress?.completedLessons as number[]) || [];
    const completedByNivo: Record<number, { ukupno: number; gotov: number }> = {};
    for (const r of lekcijePoNivou) {
      completedByNivo[r.nivo] = { ukupno: r.ukupno, gotov: 0 };
    }
    if (completedLessonIds.length > 0) {
      const completedRows = await db.select({ id: ilmihalLekcijeTable.id, nivo: ilmihalLekcijeTable.nivo })
        .from(ilmihalLekcijeTable);
      const idToNivo = new Map(completedRows.map(r => [r.id, r.nivo]));
      for (const lid of completedLessonIds) {
        const nv = idToNivo.get(lid);
        if (nv != null && completedByNivo[nv]) completedByNivo[nv].gotov++;
      }
    }

    // Bedževi: backfill ako fale (idempotentno) + vrati cijeli katalog sa earned statusom
    if (progress) {
      try { await evaluateAndPersistBadges(userId); } catch {}
    }
    const [refreshed] = await db.select().from(studentProgressTable)
      .where(eq(studentProgressTable.studentId, studentIdStr)).limit(1);
    const earned = (Array.isArray(refreshed?.badges) ? refreshed!.badges as EarnedBadge[] : [])
      .filter(b => b && typeof b.id === "string" && typeof b.earnedAt === "string");
    const earnedMap = new Map(earned.map(b => [b.id, b.earnedAt]));

    // Napredak po bedžu (current/target) za "Još za osvojiti" prikaz.
    let badgeProgress: Record<string, { current: number; target: number }> = {};
    try {
      const snap = await buildProgressSnapshot(userId);
      badgeProgress = computeBadgeProgress(snap);
    } catch (err) {
      console.warn("[ucenik/profil] computeBadgeProgress failed for userId", userId, err);
    }

    const bedzevi = Object.values(BADGE_CATALOG).map(meta => ({
      ...meta,
      earned: earnedMap.has(meta.id),
      earnedAt: earnedMap.get(meta.id) ?? null,
      progress: badgeProgress[meta.id] ?? null,
    }));

    // Task #126: položene etape (medaljoni s ispitom) + krunisanja sa datumom.
    // Za etape uzimamo NAJRANIJI uspješan pokušaj po medaljonu (DISTINCT ON
    // ekvivalent na strani Node-a — broj zapisa je mali).
    let polozeneEtape: { medaljonId: number; nivo: number; naziv: string; slug: string; polozenoAt: string; procenat: number }[] = [];
    let polozenaKrunisanjaList: { krunisanjeId: number; nivo: number; naslov: string | null; polozenoAt: string; procenat: number }[] = [];
    try {
      const etapeRows = await db
        .select({
          medaljonId: etapaPolaganjaTable.medaljonId,
          procenat: etapaPolaganjaTable.procenat,
          createdAt: etapaPolaganjaTable.createdAt,
          nivo: medaljoniTable.nivo,
          naziv: medaljoniTable.naziv,
          slug: medaljoniTable.slug,
        })
        .from(etapaPolaganjaTable)
        .innerJoin(medaljoniTable, eq(etapaPolaganjaTable.medaljonId, medaljoniTable.id))
        .where(
          and(
            eq(etapaPolaganjaTable.studentId, studentIdStr),
            eq(etapaPolaganjaTable.polozeno, true),
          ),
        )
        .orderBy(asc(etapaPolaganjaTable.createdAt));
      const seen = new Set<number>();
      for (const r of etapeRows) {
        if (seen.has(r.medaljonId)) continue;
        seen.add(r.medaljonId);
        polozeneEtape.push({
          medaljonId: r.medaljonId,
          nivo: r.nivo,
          naziv: r.naziv,
          slug: r.slug,
          polozenoAt: r.createdAt.toISOString(),
          procenat: r.procenat,
        });
      }

      const krunRows = await db
        .select({
          krunisanjeId: studentKrunisanjaTable.krunisanjeId,
          procenat: studentKrunisanjaTable.procenat,
          polozenoAt: studentKrunisanjaTable.polozenoAt,
          nivo: krunisanjaTable.nivo,
          naslov: krunisanjaTable.naslov,
        })
        .from(studentKrunisanjaTable)
        .innerJoin(krunisanjaTable, eq(studentKrunisanjaTable.krunisanjeId, krunisanjaTable.id))
        .where(eq(studentKrunisanjaTable.studentId, studentIdStr))
        .orderBy(asc(krunisanjaTable.nivo));
      polozenaKrunisanjaList = krunRows.map((r) => ({
        krunisanjeId: r.krunisanjeId,
        nivo: r.nivo,
        naslov: r.naslov,
        polozenoAt: r.polozenoAt.toISOString(),
        procenat: r.procenat,
      }));
    } catch (err) {
      console.warn("[ucenik/profil] polozeneEtape/krunisanja failed", err);
    }

    const napredak = {
      streakDays: refreshed?.streakDays ?? progress?.streakDays ?? 0,
      totalHasanat: refreshed?.totalHasanat ?? progress?.totalHasanat ?? 0,
      completedCount: completedLessonIds.length,
      lastActivityDate: refreshed?.lastActivityDate ?? progress?.lastActivityDate ?? null,
      poNivou: completedByNivo,
      bedzevi,
      polozeneEtape,
      polozenaKrunisanja: polozenaKrunisanjaList,
    };

    const mektebskaGodina = {
      odabrana: odabir.godina,
      tekuca: godineInfo.tekuca,
      godine: godineInfo.godine,
    };

    res.json({ user, profil, grupa, muallim, ocjene, prisustvo, kvizovi, napredak, mektebskaGodina });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/ucenik/godine — lista mektebskih godina za učenika + tekuća
router.get("/godine", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const info = await getStudentGodine(userId);
    res.json({ godine: info.godine, tekuca: info.tekuca });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

router.get("/napamet", async (req, res) => {
  try {
    const ocjene = await db.select().from(ocjeneTable)
      .where(and(eq(ocjeneTable.ucenikId, req.user!.userId), sql`${ocjeneTable.napametStavkaId} IS NOT NULL`))
      .orderBy(desc(ocjeneTable.datum), desc(ocjeneTable.id));
    const latest = new Map<string, typeof ocjene[number]>();
    for (const o of ocjene) if (o.napametStavkaId && !latest.has(o.napametStavkaId)) latest.set(o.napametStavkaId, o);
    const [profil] = await db.select({ mektebId: ucenikProfiliTable.mektebId, grupaId: ucenikProfiliTable.grupaId })
      .from(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, req.user!.userId));
    // Globalni NAPAMET program vrijedi i za starije profile bez mekteb_id.
    // Zato katalog ne smije nestati samo zato što taj opcioni podatak nije
    // popunjen; lokalne stavke se i dalje filtriraju po grupi.
    res.json({
      katalog: profil ? await getNapametKatalog({ mektebId: profil.mektebId, grupaId: profil.grupaId }) : [],
      ocjene: [...latest.values()],
    });
  } catch { res.status(500).json({ error: "Greška servera" }); }
});

// GET /api/ucenik/kalendar — student sees their group calendar
router.get("/kalendar", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const [profil] = await db.select().from(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, userId));

    // Filter po mektebskoj godini — kalendar grupa(e) odabrane godine.
    const godineInfo = await getStudentGodine(userId);
    const odabir = razrijesiGodinu(godineInfo, req.query.mektebskaGodina as string | undefined);
    // grupaIds === null → nema filtera (prikaži tekuću grupu); [] → tražena godina
    // nema grupa za ovog učenika → prazno (konzistentno s ocjenama/prisustvom).
    const grupeZaKalendar = odabir.grupaIds === null
      ? (profil?.grupaId ? [profil.grupaId] : [])
      : odabir.grupaIds;
    if (grupeZaKalendar.length === 0) { res.json([]); return; }

    const entries = await db.select().from(mektebKalendarTable)
      .where(inArray(mektebKalendarTable.grupaId, grupeZaKalendar))
      .orderBy(asc(mektebKalendarTable.datum));

    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/ucenik/plan-lekcija — student sees lesson plan for their group
router.get("/plan-lekcija", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const [profil] = await db.select().from(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, userId));
    if (!profil?.grupaId) { res.json([]); return; }

    const datum = req.query.datum as string;
    const where = datum
      ? and(eq(planLekcijaTable.grupaId, profil.grupaId), eq(planLekcijaTable.datum, datum))
      : eq(planLekcijaTable.grupaId, profil.grupaId);

    const lekcije = await db.select().from(planLekcijaTable)
      .where(where)
      .orderBy(asc(planLekcijaTable.datum), asc(planLekcijaTable.redoslijed));

    res.json(lekcije);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// Evidencija koja se resetuje na početku mektebske godine počinje 1. augusta.
function currentSchoolYearResetDate(): string {
  const now = new Date();
  const year = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${year}-08-01`;
}

// GET /api/ucenik/zadace — student sees active homework for their group.
// Supports per-student targeting: if a zadaca has rows in zadace_ucenici,
// it is visible only to the listed students. If no rows — visible to whole group.
router.get("/zadace", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const [profil] = await db.select().from(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, userId));

    // Odabir mektebske godine: tekuća = aktivna grupa učenika; prošla = grupe te
    // godine u kojima učenik ima trag (status/target zadaće).
    const godineInfo = await getStudentGodine(userId);
    const odabir = razrijesiGodinu(godineInfo, req.query.mektebskaGodina as string | undefined);

    // grupaIds === null → nema filtera (tekuća grupa); [] → tražena godina nema
    // grupa za ovog učenika → prazno (konzistentno s ocjenama/prisustvom).
    let grupeZaZadace: number[];
    if (odabir.grupaIds === null) {
      grupeZaZadace = profil?.grupaId ? [profil.grupaId] : [];
    } else {
      grupeZaZadace = odabir.grupaIds;
    }
    if (grupeZaZadace.length === 0) { res.json([]); return; }

    const currentSchoolYearStart = new Date(`${currentSchoolYearResetDate()}T00:00:00.000Z`);
    const allGroupZadace = await db.select().from(zadaceTable)
      .where(and(
        inArray(zadaceTable.grupaId, grupeZaZadace),
        or(eq(zadaceTable.isActive, true), gte(zadaceTable.createdAt, currentSchoolYearStart)),
      ))
      .orderBy(desc(zadaceTable.createdAt));

    if (allGroupZadace.length === 0) { res.json([]); return; }

    const targets = await db.select().from(zadaceUceniciTable)
      .where(inArray(zadaceUceniciTable.zadacaId, allGroupZadace.map(z => z.id)));

    const targetMap = new Map<number, Set<number>>();
    for (const t of targets) {
      if (!targetMap.has(t.zadacaId)) targetMap.set(t.zadacaId, new Set());
      targetMap.get(t.zadacaId)!.add(t.ucenikId);
    }

    const visible = allGroupZadace.filter(z => {
      const targeted = targetMap.get(z.id);
      if (!targeted) return true; // bez targeta = cijela grupa
      return targeted.has(userId);
    });

    // Status ovog učenika po zadaći (uradjeno, ocjena, kapi meda, novi rok,
    // prolongacije, status). Nepostojeći red => na čekanju.
    const statusi = visible.length > 0
      ? await db.select().from(zadaceStatusTable).where(and(
          inArray(zadaceStatusTable.zadacaId, visible.map(z => z.id)),
          eq(zadaceStatusTable.ucenikId, userId),
        ))
      : [];
    const statusMap = new Map(statusi.map(s => [s.zadacaId, s]));
    const today = new Date().toISOString().split("T")[0];

    // Zadaće historijski čuvaju naziv lekcije, a ne ID. Vrati i slug kada
    // postoji tačno podudaranje, da učenik može otvoriti zadatu lekciju i kad
    // je naslov na listi već preklopljen na drugi jezik.
    const lessonTitles = [...new Set(
      visible.map(z => z.lekcijaNaslov).filter((title): title is string => Boolean(title?.trim())),
    )];
    const linkedLessons = lessonTitles.length > 0
      ? await db.select({
          id: ilmihalLekcijeTable.id,
          naslov: ilmihalLekcijeTable.naslov,
          slug: ilmihalLekcijeTable.slug,
        }).from(ilmihalLekcijeTable).where(inArray(ilmihalLekcijeTable.naslov, lessonTitles))
      : [];
    const lessonSlugByTitle = new Map(linkedLessons.map(l => [l.naslov, l.slug]));

    const prilogMap = await getZadacaPrilozi(visible.map(z => z.id));
    const withStatus = visible.map(z => {
      const s = statusMap.get(z.id);
      const status = s?.status ?? "na_cekanju";
      const prolongCount = s?.prolongCount ?? 0;
      const efektivniRok = s?.noviRok ?? z.rokDo ?? null;
      // Arhivirana zadaća je zatvorena: realizovana ide u "zavrsene", a
      // nerealizovana u "neuradjene". Aktivne zadaće ostaju "aktivne".
      const kategorija = status === "zavrseno"
        ? "zavrsene"
        : z.isActive === false
          ? "neuradjene"
          : "aktivne";
      const istekao = !!(efektivniRok && efektivniRok < today);
      return {
        ...z,
        prilozi: prilogMap.get(z.id) || [],
        // Novi unosi imaju kanonski slug; naslov ostaje samo fallback za stare
        // zadaće nastale prije uvođenja stabilne veze sa lekcijom.
        lekcijaSlug: z.lekcijaSlug ?? (z.lekcijaNaslov
          ? lessonSlugByTitle.get(z.lekcijaNaslov) ?? null
          : null),
        efektivniRok,
        status,
        uradjeno: s?.uradjeno ?? false,
        ocjena: s?.ocjena ?? null,
        kapiMeda: s?.kapiMeda ?? 0,
        noviRok: s?.noviRok ?? null,
        prolongCount,
        istekao,
        kategorija,
      };
    });

    res.json(withStatus);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/ucenik/dokumenti — mekteb-nivo PDF dokumenti (pravila, kućni red...)
// vidljivi učeniku. Razrješava mektebId iz učeničkog profila.
router.get("/dokumenti", async (req, res) => {
  try {
    const [profil] = await db.select().from(ucenikProfiliTable)
      .where(eq(ucenikProfiliTable.userId, req.user!.userId));
    if (!profil?.mektebId) {
      res.json([]);
      return;
    }
    const docs = await db.select().from(mektebDokumentiTable)
      .where(eq(mektebDokumentiTable.mektebId, profil.mektebId))
      .orderBy(desc(mektebDokumentiTable.createdAt));
    res.json(docs.map(d => ({
      id: d.id,
      naziv: d.naziv,
      opis: d.opis,
      originalName: d.originalName,
      storedName: d.storedName,
      fileSize: d.fileSize,
      createdAt: d.createdAt,
    })));
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/ucenik/dokumenti/:id/file — autorizovani download dokumenta učenikovog mekteba.
router.get("/dokumenti/:id/file", async (req, res) => {
  try {
    const [profil] = await db.select().from(ucenikProfiliTable)
      .where(eq(ucenikProfiliTable.userId, req.user!.userId));
    if (!profil?.mektebId) {
      res.status(404).json({ error: "Dokument nije pronađen" });
      return;
    }
    const id = parseInt(req.params.id, 10);
    const [doc] = await db.select().from(mektebDokumentiTable).where(eq(mektebDokumentiTable.id, id));
    if (!doc || doc.mektebId !== profil.mektebId) {
      res.status(404).json({ error: "Dokument nije pronađen" });
      return;
    }
    streamDokument(res, doc);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/ucenik/moje-zvjezdice — učenik čita vlastite totale zvjezdica
router.get("/moje-zvjezdice", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const result = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE tip = 'pozitivna') AS pozitivne,
        COUNT(*) FILTER (WHERE tip = 'negativna') AS negativne
      FROM zvjezdice_log
      WHERE ucenik_id = ${userId}
        AND created_at >= ${currentSchoolYearResetDate()}
    `);
    const r = (result.rows as Array<{ pozitivne?: string | number; negativne?: string | number }>)[0] || {};
    res.json({ pozitivne: parseInt(String(r.pozitivne ?? 0)) || 0, negativne: parseInt(String(r.negativne ?? 0)) || 0 });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

export default router;
