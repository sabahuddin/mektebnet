import { Router } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import {
  usersTable,
  muallimProfiliTable,
  ucenikProfiliTable,
  roditeljProfiliTable,
  grupeTable,
  grupaRasporedTable,
  roditeljUcenikTable,
  obavjestenjaTable,
  priustvoTable,
  ocjeneTable,
  kvizRezultatiTable,
  korisnikNapredakTable,
  mektebKalendarTable,
  planLekcijaTable,
  ilmihalLekcijeTable,
  zadaceTable,
  zadaceUceniciTable,
  zadaceStatusTable,
  porukeTable,
  mektebiTable,
  mektebDokumentiTable,
  h5pPokusajiTable,
  prilozi,
  interaktivniBlokPokusajiTable,
  napametMuallimProgramTable,
} from "@workspace/db/schema";
import { eq, and, inArray, desc, asc, sql, count, gte } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { sendPushNotification } from "../lib/push.js";
import { getRasporedPositions, resolveEffectiveRedoslijed } from "../lib/raspored.js";
import { mektebDokumentiDir, streamDokument, deleteDokumentFajl, optimizePdfFile } from "../lib/dokumenti.js";
import { getGlobalNapametKatalog, getNapametKatalog } from "../data/napamet.js";

const router = Router();
router.use(requireAuth, requireRole("muallim", "admin"));

// ── KORISNIK HELPERI ────────────────────────────────────────────────────────
// Kreiranje korisnika (učenik/roditelj) sa retry-em na koliziju username-a.
// Koriste se u POST /ucenici (single), POST /ucenici/bulk (više) i POST
// /ucenici/:id/roditelj (postojeći učenik).

type NewUserRow = typeof usersTable.$inferSelect;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function firstNameSlug(name: string) {
  return name.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, "") || "korisnik";
}

function randomSuffix() {
  return Math.floor(1000 + Math.random() * 9000);
}

function generateUsername(name: string, suffix?: number) {
  const rand = suffix ?? randomSuffix();
  return { username: `${firstNameSlug(name)}.${rand}`, rand };
}

function generateMektebPassword(suffix?: number) {
  return `Mekteb${suffix ?? randomSuffix()}`;
}

// Evidencija koja se resetuje na početku mektebske godine počinje 1. augusta.
// Kvizovi, lekcije i ostali trajni napredak namjerno ne koriste ovaj filter.
function currentSchoolYearResetDate(): string {
  const now = new Date();
  const year = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${year}-08-01`;
}

function currentSchoolYearResetTimestamp(): Date {
  return new Date(`${currentSchoolYearResetDate()}T00:00:00.000Z`);
}

function isFromCurrentSchoolYear(date: string | null | undefined): boolean {
  return Boolean(date && date >= currentSchoolYearResetDate());
}

// Zvjezdice (žute = pozitivne, crne = negativne) za skup učenika, u tekućoj
// mektebskoj godini. Vraća unos za SVAKOG traženog učenika — učenici bez
// ijedne zvjezdice dobijaju nule, da se nikad ne izgube iz tabela i zbirova.
async function getZvjezdiceZaUcenike(
  ucenikIds: number[],
): Promise<Map<number, { pozitivne: number; negativne: number }>> {
  const map = new Map<number, { pozitivne: number; negativne: number }>();
  for (const id of ucenikIds) map.set(id, { pozitivne: 0, negativne: 0 });
  if (ucenikIds.length === 0) return map;
  try {
    const rows = await db.execute(sql`
      SELECT ucenik_id,
             COUNT(*) FILTER (WHERE tip = 'pozitivna') AS pozitivne,
             COUNT(*) FILTER (WHERE tip = 'negativna') AS negativne
      FROM zvjezdice_log
      WHERE ucenik_id IN (${sql.join(ucenikIds.map(id => sql`${id}`), sql`, `)})
        AND created_at >= ${currentSchoolYearResetDate()}
      GROUP BY ucenik_id
    `);
    for (const r of rows.rows as any[]) {
      const id = Number(r.ucenik_id);
      if (!map.has(id)) continue;
      map.set(id, {
        pozitivne: parseInt(r.pozitivne) || 0,
        negativne: parseInt(r.negativne) || 0,
      });
    }
  } catch (err) {
    // Stara produkcija bez zvjezdice_log tabele — statistika ostaje na nulama.
    console.error("zvjezdice agregat error:", err);
  }
  return map;
}

// Učenik i roditelj iz istog para dijele isti 4-cifreni sufiks i lozinku
// (npr. amir.4567 / Mekteb4567 i ismet.4567 / Mekteb4567) — radi lakše
// komunikacije muallim ↔ porodica. Muallim i dalje može resetovati šifru
// roditelja zasebno.
function generatePairCredentials() {
  const suffix = randomSuffix();
  return { suffix, password: `Mekteb${suffix}` };
}

// Izvuci standardnu lozinku iz korisničkog imena. Imena su oblika "ime.NNNN",
// a standardna lozinka je "MektebNNNN". Učenik i roditelj iz istog para dijele
// isti NNNN, pa ovako printanje kartica uvijek daje ISTU lozinku za oboje i ne
// mijenja je pri svakom printu (deterministički, umjesto nasumičnog reseta).
function passwordFromUsername(username: string, userId: number): string {
  const m = username.match(/\.(\d{3,})$/);
  // Fallback (korisničko ime bez brojčanog sufiksa — praktički se ne dešava jer
  // se sva imena generišu kao "ime.NNNN") koristi stabilan userId, nikad nasumično,
  // da printanje i tada daje uvijek ISTU lozinku.
  return m ? `Mekteb${m[1]}` : `Mekteb${userId}`;
}

function isUniqueViolation(e: any) {
  return e?.code === "23505" || /unique|duplicate/i.test(e?.message || "");
}

const oneApprovedRoditeljIndex = "roditelj_ucenik_one_approved_per_ucenik_idx";
const oneApprovedRoditeljError = "Učenik već ima povezanog roditelja. Jedan učenik može imati samo jednog roditelja.";

function isOneApprovedRoditeljViolation(e: any) {
  return [e, e?.cause].some((candidate) =>
    candidate?.code === "23505"
    && (
      candidate?.constraint === oneApprovedRoditeljIndex
      || candidate?.message?.includes(oneApprovedRoditeljIndex)
    ),
  );
}

// Strict varijanta — pokušava tačno jednom sa zadatim sufiksom. Baca na
// koliziji. Koristi se u retry petljama gdje suffix mora biti tačan (par).
async function tryInsertUser(
  tx: Tx,
  baseName: string,
  passwordHash: string,
  displayNameVal: string,
  role: "ucenik" | "roditelj",
  suffix: number,
): Promise<NewUserRow> {
  const { username } = generateUsername(baseName, suffix);
  const [row] = await tx.insert(usersTable).values({
    username,
    passwordHash,
    displayName: displayNameVal,
    role,
  }).returning();
  return row;
}

async function insertWithUniqueUsername(
  tx: Tx,
  baseName: string,
  passwordHash: string,
  displayNameVal: string,
  role: "ucenik" | "roditelj",
  preferredSuffix?: number,
): Promise<NewUserRow> {
  // Prvi pokušaj koristi preferirani sufiks (za učenik+roditelj par); ako
  // pukne na koliziji, padamo na nasumične sufikse u sljedećim attempt-ima.
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = attempt === 0 && preferredSuffix !== undefined ? preferredSuffix : randomSuffix();
    try {
      return await tryInsertUser(tx, baseName, passwordHash, displayNameVal, role, suffix);
    } catch (e: any) {
      if (attempt === 4 || !isUniqueViolation(e)) throw e;
    }
  }
  throw new Error("USERNAME_COLLISION");
}

// Helper: pošalji in-app poruku svim odobrenim roditeljima datog
// učenika. Email se NE šalje (in-app je dovoljno za ocjene/izostanke/
// bedževe — vidi smjernice korisnika). Ne baca — sve greške se loguju.
async function notifyApprovedRoditelji(opts: {
  ucenikId: number;
  posiljateljId: number;
  naslov: string;
  sadrzaj: string;
  logTag: string;
  pushUrl?: string;
  pushData?: Record<string, unknown>;
}) {
  const { ucenikId, posiljateljId, naslov, sadrzaj, logTag, pushUrl, pushData } = opts;

  try {
    const veze = await db
      .select({ roditeljId: roditeljUcenikTable.roditeljId })
      .from(roditeljUcenikTable)
      .where(and(
        eq(roditeljUcenikTable.ucenikId, ucenikId),
        eq(roditeljUcenikTable.status, "approved"),
      ));

    if (veze.length === 0) return;

    const roditeljIds = veze.map(v => v.roditeljId);

    for (const roditeljId of roditeljIds) {
      const logCtx = { logTag, ucenikId, roditeljId };
      try {
        await db.insert(porukeTable).values({
          posiljateljId,
          primateljId: roditeljId,
          naslov,
          sadrzaj,
        });
      } catch (err) {
        console.error(`[${logTag}] In-app poruka insert failed`, logCtx, err);
      }
    }

    // Push notifikacija svim roditeljima (best-effort, ne propagira grešku).
    try {
      await sendPushNotification({
        userIds: roditeljIds,
        title: naslov,
        body: sadrzaj.length > 120 ? sadrzaj.slice(0, 120) + "…" : sadrzaj,
        url: pushUrl ?? "/poruke",
        data: pushData,
      });
    } catch (pushErr) {
      console.error(`[${logTag}] push notifikacija nije uspjela`, { ucenikId }, pushErr);
    }
  } catch (err) {
    console.error(`[${logTag}] notifyApprovedRoditelji failed`, { ucenikId, posiljateljId }, err);
  }
}

// GET /api/muallim/info
router.get("/info", async (req, res) => {
  try {
    const [profil] = await db.select().from(muallimProfiliTable).where(eq(muallimProfiliTable.userId, req.user!.userId));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
    let mektebNaziv: string | null = null;
    if (profil?.mektebId) {
      const [m] = await db.select().from(mektebiTable).where(eq(mektebiTable.id, profil.mektebId));
      mektebNaziv = m?.naziv ?? null;
    }
    res.json({
      ...user,
      profil: profil || null,
      isGlavni: profil?.isGlavni ?? false,
      mektebNaziv,
    });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// ---------------------------------------------------------------------------
// MEKTEB (škola) — glavni muallim administracija
// Glavni (admin) muallim je onaj ko je registrovao mekteb. Jedino on kreira/
// briše ostale muallimske naloge i vidi zbirnu statistiku cijelog mekteba.
// Obični muallim NEMA pristup ovim rutama.
// ---------------------------------------------------------------------------

// Helper: vrati mekteb-kontekst muallima ({ mektebId, isGlavni }) ili null.
async function getMektebCtx(userId: number) {
  const [profil] = await db.select().from(muallimProfiliTable).where(eq(muallimProfiliTable.userId, userId));
  if (!profil) return null;
  return { mektebId: profil.mektebId ?? null, isGlavni: profil.isGlavni ?? false, licenceCount: profil.licenceCount };
}

// Read-only pregled drugog muallima. Samo glavni muallim može dodati
// ?muallimId=...; sva prava izmjene i dalje koriste stvarnog prijavljenog
// korisnika i ne prolaze kroz ovaj helper.
async function resolveViewMuallimId(req: any): Promise<number | null> {
  const requesterId = req.user!.userId as number;
  const raw = Array.isArray(req.query.muallimId) ? req.query.muallimId[0] : req.query.muallimId;
  if (!raw) return requesterId;
  const requestedId = Number(raw);
  if (!Number.isInteger(requestedId) || requestedId <= 0) return null;
  if (requestedId === requesterId) return requesterId;

  const requesterCtx = await getMektebCtx(requesterId);
  if (!requesterCtx?.isGlavni || !requesterCtx.mektebId) return null;
  const [target] = await db.select({ userId: muallimProfiliTable.userId })
    .from(muallimProfiliTable)
    .where(and(
      eq(muallimProfiliTable.userId, requestedId),
      eq(muallimProfiliTable.mektebId, requesterCtx.mektebId),
    ));
  return target?.userId ?? null;
}

// Vrati profil učenika ako muallim smije upravljati njime.
// Obični muallim vidi samo vlastite učenike, a glavni sve učenike svog mekteba.
// Provjera pripadnosti mektebu ide preko vlasničkog muallim profila, jer
// ucenik_profili.mekteb_id može biti NULL kod starijih učenika.
async function getManageableUcenikProfile(muallimId: number, ucenikId: number) {
  const [profil] = await db.select().from(ucenikProfiliTable)
    .where(eq(ucenikProfiliTable.userId, ucenikId));
  if (!profil) return null;
  if (profil.muallimId === muallimId) return profil;

  const ctx = await getMektebCtx(muallimId);
  if (!ctx?.isGlavni || !ctx.mektebId || !profil.muallimId) return null;

  const [vlasnik] = await db.select({ userId: muallimProfiliTable.userId })
    .from(muallimProfiliTable)
    .where(and(
      eq(muallimProfiliTable.userId, profil.muallimId),
      eq(muallimProfiliTable.mektebId, ctx.mektebId),
    ));
  return vlasnik ? profil : null;
}

// GET /api/muallim/roditelji/pretraga?q=... — postojeći roditelji iz
// muallimovog mekteba, za povezivanje s drugim djetetom bez ručnog unosa
// korisničkog imena.
router.get("/roditelji/pretraga", async (req, res) => {
  try {
    const query = String(req.query.q ?? "").trim();
    if (query.length < 2) {
      res.json([]);
      return;
    }

    const userId = req.user!.userId;
    const ctx = await getMektebCtx(userId);
    const mektebFilter = ctx?.isGlavni && ctx.mektebId
      ? sql`mp.mekteb_id = ${ctx.mektebId}`
      : sql`mp.user_id = ${userId}`;
    const pattern = `%${query}%`;

    const rows = await db.execute(sql`
      SELECT r.id, r.display_name, r.username,
             COUNT(DISTINCT ru.ucenik_id)::int AS broj_djece
      FROM roditelj_ucenik ru
      JOIN users r ON r.id = ru.roditelj_id AND r.role = 'roditelj'
      JOIN ucenik_profili up ON up.user_id = ru.ucenik_id
      JOIN muallim_profili mp ON mp.user_id = up.muallim_id
      WHERE ru.status = 'approved'
        AND ${mektebFilter}
        AND (
          r.display_name ILIKE ${pattern}
          OR r.username ILIKE ${pattern}
        )
      GROUP BY r.id, r.display_name, r.username
      ORDER BY r.display_name ASC
      LIMIT 10
    `);

    res.json((rows.rows as Array<{
      id: number;
      display_name: string;
      username: string;
      broj_djece: number;
    }>).map(r => ({
      id: r.id,
      displayName: r.display_name,
      username: r.username,
      brojDjece: r.broj_djece,
    })));
  } catch (err) {
    console.error("[GET /muallim/roditelji/pretraga]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/mekteb/info — osnovni podaci o mektebu trenutnog muallima.
router.get("/mekteb/info", async (req, res) => {
  try {
    const ctx = await getMektebCtx(req.user!.userId);
    if (!ctx?.mektebId) {
      res.json({ hasMekteb: false, isGlavni: false });
      return;
    }
    const [m] = await db.select().from(mektebiTable).where(eq(mektebiTable.id, ctx.mektebId));
    const muallimi = await db.select({ userId: muallimProfiliTable.userId })
      .from(muallimProfiliTable).where(eq(muallimProfiliTable.mektebId, ctx.mektebId));
    res.json({
      hasMekteb: true,
      isGlavni: ctx.isGlavni,
      naziv: m?.naziv ?? null,
      grad: m?.grad ?? null,
      dozvoljenoMuallima: m?.dozvoljenoMuallima ?? 1,
      brojMuallima: muallimi.length,
      slobodnoMjesta: Math.max(0, (m?.dozvoljenoMuallima ?? 1) - muallimi.length),
    });
  } catch (err) {
    console.error("Mekteb info error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/mekteb/muallimi — lista muallima u mektebu (glavni only).
router.get("/mekteb/muallimi", async (req, res) => {
  try {
    const ctx = await getMektebCtx(req.user!.userId);
    if (!ctx?.mektebId || !ctx.isGlavni) {
      res.status(403).json({ error: "Samo glavni muallim ima pristup" });
      return;
    }
    const profili = await db.select().from(muallimProfiliTable)
      .where(eq(muallimProfiliTable.mektebId, ctx.mektebId));
    const ids = profili.map(p => p.userId);
    const users = ids.length > 0
      ? await db.select({ id: usersTable.id, username: usersTable.username, displayName: usersTable.displayName, isActive: usersTable.isActive })
          .from(usersTable).where(inArray(usersTable.id, ids))
      : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    const lista = await Promise.all(profili.map(async (p) => {
      const grupe = await db.select({ id: grupeTable.id }).from(grupeTable).where(eq(grupeTable.muallimId, p.userId));
      const ucenici = await db.select({ id: ucenikProfiliTable.userId }).from(ucenikProfiliTable)
        .where(and(eq(ucenikProfiliTable.muallimId, p.userId), eq(ucenikProfiliTable.isArchived, false)));
      const u = userMap.get(p.userId);
      return {
        userId: p.userId,
        username: u?.username ?? null,
        displayName: u?.displayName ?? "Nepoznat",
        isActive: u?.isActive ?? false,
        isGlavni: p.isGlavni ?? false,
        brojGrupa: grupe.length,
        brojUcenika: ucenici.length,
      };
    }));
    lista.sort((a, b) => Number(b.isGlavni) - Number(a.isGlavni) || a.displayName.localeCompare(b.displayName));
    res.json(lista);
  } catch (err) {
    console.error("Mekteb muallimi error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/mekteb/muallimi — kreiraj novog muallima (glavni only).
// Vraća plaintext kredencijale JEDNOM (ne čuvaju se) da ih glavni podijeli.
router.post("/mekteb/muallimi", async (req, res) => {
  try {
    const ctx = await getMektebCtx(req.user!.userId);
    if (!ctx?.mektebId || !ctx.isGlavni) {
      res.status(403).json({ error: "Samo glavni muallim ima pristup" });
      return;
    }
    const displayName = String(req.body?.displayName || "").trim();
    if (!displayName) {
      res.status(400).json({ error: "Ime i prezime muallima je obavezno" });
      return;
    }

    const [m] = await db.select().from(mektebiTable).where(eq(mektebiTable.id, ctx.mektebId));
    const dozvoljeno = m?.dozvoljenoMuallima ?? 1;
    const postojeci = await db.select({ userId: muallimProfiliTable.userId })
      .from(muallimProfiliTable).where(eq(muallimProfiliTable.mektebId, ctx.mektebId));
    if (postojeci.length >= dozvoljeno) {
      res.status(409).json({ error: `Dostigli ste limit muallimskih naloga (${dozvoljeno}). Za više kontaktirajte podršku.` });
      return;
    }

    const suffix = randomSuffix();
    const password = generateMektebPassword(suffix);
    const passwordHash = await bcrypt.hash(password, 10);

    const created = await db.transaction(async (tx) => {
      let row: NewUserRow | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const { username } = generateUsername(displayName, attempt === 0 ? suffix : randomSuffix());
        try {
          const [u] = await tx.insert(usersTable).values({
            username,
            passwordHash,
            displayName,
            role: "muallim",
            isActive: true,
          }).returning();
          row = u;
          break;
        } catch (e: any) {
          if (attempt === 4 || !isUniqueViolation(e)) throw e;
        }
      }
      if (!row) throw new Error("USERNAME_COLLISION");
      await tx.insert(muallimProfiliTable).values({
        userId: row.id,
        mektebId: ctx.mektebId,
        isGlavni: false,
        licenceCount: ctx.licenceCount ?? 30,
        licencesUsed: 0,
      });
      return row;
    });

    res.status(201).json({
      userId: created.id,
      displayName: created.displayName,
      username: created.username,
      generatedPassword: password,
    });
  } catch (err) {
    console.error("Mekteb create muallim error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// DELETE /api/muallim/mekteb/muallimi/:id — obriši muallima (glavni only).
// Blokira brisanje glavnog i muallima koji još ima grupe ili učenike.
router.delete("/mekteb/muallimi/:id", async (req, res) => {
  try {
    const ctx = await getMektebCtx(req.user!.userId);
    if (!ctx?.mektebId || !ctx.isGlavni) {
      res.status(403).json({ error: "Samo glavni muallim ima pristup" });
      return;
    }
    const targetId = parseInt(req.params.id, 10);
    if (targetId === req.user!.userId) {
      res.status(400).json({ error: "Ne možete obrisati vlastiti (glavni) nalog" });
      return;
    }
    const [target] = await db.select().from(muallimProfiliTable).where(eq(muallimProfiliTable.userId, targetId));
    if (!target || target.mektebId !== ctx.mektebId) {
      res.status(404).json({ error: "Muallim nije pronađen u vašem mektebu" });
      return;
    }
    if (target.isGlavni) {
      res.status(400).json({ error: "Glavni muallim se ne može obrisati" });
      return;
    }
    const grupe = await db.select({ id: grupeTable.id }).from(grupeTable).where(eq(grupeTable.muallimId, targetId));
    const ucenici = await db.select({ id: ucenikProfiliTable.userId }).from(ucenikProfiliTable)
      .where(and(eq(ucenikProfiliTable.muallimId, targetId), eq(ucenikProfiliTable.isArchived, false)));
    if (grupe.length > 0 || ucenici.length > 0) {
      res.status(409).json({ error: "Muallim još ima grupe ili učenike. Premjestite ih prije brisanja naloga." });
      return;
    }
    await db.transaction(async (tx) => {
      await tx.delete(muallimProfiliTable).where(eq(muallimProfiliTable.userId, targetId));
      await tx.delete(usersTable).where(eq(usersTable.id, targetId));
    });
    res.json({ success: true });
  } catch (err) {
    console.error("Mekteb delete muallim error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/muallim/mekteb/muallimi/:id — uredi muallima (glavni only).
// Body: { displayName?: string, resetPassword?: boolean }
// Resetovana šifra se vraća JEDNOM u odgovoru — nije pohranjena u čistom tekstu.
router.put("/mekteb/muallimi/:id", async (req, res) => {
  try {
    const ctx = await getMektebCtx(req.user!.userId);
    if (!ctx?.mektebId || !ctx.isGlavni) {
      res.status(403).json({ error: "Samo glavni muallim ima pristup" }); return;
    }
    const targetId = parseInt(req.params.id, 10);
    const [target] = await db.select().from(muallimProfiliTable).where(eq(muallimProfiliTable.userId, targetId));
    if (!target || target.mektebId !== ctx.mektebId) {
      res.status(404).json({ error: "Muallim nije pronađen u vašem mektebu" }); return;
    }
    if (target.isGlavni) {
      res.status(400).json({ error: "Profil glavnog muallima ne može editovati drugi korisnik" }); return;
    }
    const { displayName, resetPassword } = req.body as { displayName?: string; resetPassword?: boolean };
    const updates: { displayName?: string; passwordHash?: string } = {};
    if (displayName && displayName.trim().length >= 2) updates.displayName = displayName.trim();
    let newPassword: string | null = null;
    if (resetPassword) {
      const suffix = randomSuffix();
      newPassword = generateMektebPassword(suffix);
      updates.passwordHash = await bcrypt.hash(newPassword, 10);
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "Nema izmjena za sačuvati" }); return;
    }
    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, targetId)).returning();
    res.json({ success: true, displayName: updated.displayName, ...(newPassword ? { newPassword } : {}) });
  } catch (err) {
    console.error("Mekteb edit muallim error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/mekteb/statistika — zbirna statistika cijelog mekteba kroz
// SVE muallime (glavni only): ukupno učenika, broj muallima/grupa, prosječno
// prisustvo, napredak po nivoima, screentime, te usporedba po grupama.
router.get("/mekteb/statistika", async (req, res) => {
  try {
    const ctx = await getMektebCtx(req.user!.userId);
    if (!ctx?.mektebId || !ctx.isGlavni) {
      res.status(403).json({ error: "Samo glavni muallim ima pristup" });
      return;
    }
    const mektebId = ctx.mektebId;

    const muallimProfili = await db.select().from(muallimProfiliTable)
      .where(eq(muallimProfiliTable.mektebId, mektebId));
    const muallimIds = muallimProfili.map(p => p.userId);
    const muallimUsers = muallimIds.length > 0
      ? await db.select({ id: usersTable.id, displayName: usersTable.displayName })
          .from(usersTable).where(inArray(usersTable.id, muallimIds))
      : [];
    const muallimNameMap = new Map(muallimUsers.map(u => [u.id, u.displayName]));

    const grupe = muallimIds.length > 0
      ? await db.select().from(grupeTable).where(and(
          inArray(grupeTable.muallimId, muallimIds),
          sql`COALESCE(is_archived, false) = false`,
          sql`COALESCE(is_active, true) = true`,
        ))
      : [];

    const perGrupa = await Promise.all(grupe.map(async (g) => {
      const stats = await getGrupaFullStats(g.id);
      return {
        id: g.id,
        naziv: g.naziv,
        muallimId: g.muallimId,
        muallimNaziv: muallimNameMap.get(g.muallimId) ?? "Nepoznat",
        skolskaGodina: g.skolskaGodina,
        ukupnoUcenika: stats.ucenici.length,
        ukupnoCasova: stats.ukupnoCasova,
        prisustvoPct: stats.grupaPrisustvoPct,
        prosjekOcjena: stats.grupaProsjekOcjena,
        ukupnoKvizova: stats.ukupnoKvizova,
        ukupnoBodova: stats.ukupnoBodovaGrupa,
        zvjezdicePozitivne: stats.zvjezdicePozitivne,
        zvjezdiceNegativne: stats.zvjezdiceNegativne,
      };
    }));

    // Primarni prikaz mektebskog nivoa: red po MUALLIMU (agregat njegovih grupa).
    // Grupe ostaju u odgovoru kao podatak nižeg nivoa (drill-down).
    const muallimi = muallimProfili
      .map(p => {
        const njegoveGrupe = perGrupa.filter(g => g.muallimId === p.userId);
        const ukupnoUcenika = njegoveGrupe.reduce((a, g) => a + g.ukupnoUcenika, 0);
        const validPrisM = njegoveGrupe.filter(g => g.prisustvoPct !== null);
        const ponderPris = validPrisM.reduce((a, g) => a + g.ukupnoUcenika, 0);
        const validOcM = njegoveGrupe.filter(g => g.prosjekOcjena !== null);
        const ponderOc = validOcM.reduce((a, g) => a + g.ukupnoUcenika, 0);
        return {
          muallimId: p.userId,
          displayName: muallimNameMap.get(p.userId) ?? "Nepoznat",
          isGlavni: p.isGlavni ?? false,
          brojGrupa: njegoveGrupe.length,
          ukupnoUcenika,
          ukupnoCasova: njegoveGrupe.reduce((a, g) => a + g.ukupnoCasova, 0),
          prisustvoPct: ponderPris > 0
            ? Math.round(validPrisM.reduce((a, g) => a + (g.prisustvoPct || 0) * g.ukupnoUcenika, 0) / ponderPris)
            : null,
          prosjekOcjena: ponderOc > 0
            ? Math.round((validOcM.reduce((a, g) => a + (g.prosjekOcjena || 0) * g.ukupnoUcenika, 0) / ponderOc) * 10) / 10
            : null,
          ukupnoKvizova: njegoveGrupe.reduce((a, g) => a + g.ukupnoKvizova, 0),
          ukupnoBodova: njegoveGrupe.reduce((a, g) => a + g.ukupnoBodova, 0),
          zvjezdicePozitivne: njegoveGrupe.reduce((a, g) => a + g.zvjezdicePozitivne, 0),
          zvjezdiceNegativne: njegoveGrupe.reduce((a, g) => a + g.zvjezdiceNegativne, 0),
        };
      })
      .sort((a, b) => (b.isGlavni ? 1 : 0) - (a.isGlavni ? 1 : 0) || a.displayName.localeCompare(b.displayName, "bs"));

    // Učenici cijelog mekteba (preko mektebId).
    const activeGrupaIds = grupe.map(g => g.id);
    const ucenikProfili = activeGrupaIds.length > 0
      ? await db.select().from(ucenikProfiliTable)
          .where(and(
            inArray(ucenikProfiliTable.grupaId, activeGrupaIds),
            eq(ucenikProfiliTable.isArchived, false),
          ))
      : [];
    const ucenikIds = ucenikProfili.map(p => p.userId);

    // Prosječno prisustvo (ponderirano po broju učenika grupe).
    const validPris = perGrupa.filter(g => g.prisustvoPct !== null);
    const ponderUcenika = validPris.reduce((a, g) => a + g.ukupnoUcenika, 0);
    const prosjekPrisustva = ponderUcenika > 0
      ? Math.round(validPris.reduce((a, g) => a + (g.prisustvoPct || 0) * g.ukupnoUcenika, 0) / ponderUcenika)
      : null;

    // Napredak po nivoima (ilmihal) — završene lekcije grupisane po nivou.
    const napredakPoNivoima: { nivo: number; zavrseno: number }[] = [];
    let ukupnoLekcijaZavrseno = 0;
    if (ucenikIds.length > 0) {
      const napredak = await db.select({ contentId: korisnikNapredakTable.contentId })
        .from(korisnikNapredakTable)
        .where(and(
          inArray(korisnikNapredakTable.userId, ucenikIds),
          eq(korisnikNapredakTable.zavrsen, true),
          eq(korisnikNapredakTable.contentType, "ilmihal"),
        ));
      ukupnoLekcijaZavrseno = napredak.length;
      const lekcije = await db.select({ id: ilmihalLekcijeTable.id, nivo: ilmihalLekcijeTable.nivo })
        .from(ilmihalLekcijeTable);
      const nivoMap = new Map(lekcije.map(l => [l.id, l.nivo]));
      const counts = new Map<number, number>();
      for (const n of napredak) {
        const nivo = nivoMap.get(n.contentId);
        if (nivo == null) continue;
        counts.set(nivo, (counts.get(nivo) || 0) + 1);
      }
      for (const nivo of [...counts.keys()].sort((a, b) => a - b)) {
        napredakPoNivoima.push({ nivo, zavrseno: counts.get(nivo) || 0 });
      }
    }

    // Screentime (ukupno aktivno vrijeme učenika mekteba).
    let ukupnoScreentimeSec = 0;
    if (ucenikIds.length > 0) {
      const st = await db.select({ sec: usersTable.totalScreentimeSec })
        .from(usersTable).where(inArray(usersTable.id, ucenikIds));
      ukupnoScreentimeSec = st.reduce((a, r) => a + (r.sec || 0), 0);
    }

    res.json({
      global: {
        ukupnoUcenika: ucenikProfili.length,
        brojMuallima: muallimProfili.length,
        brojGrupa: grupe.length,
        prosjekPrisustva,
        prosjekOcjena: (() => {
          const validOc = perGrupa.filter(g => g.prosjekOcjena !== null);
          const ponder = validOc.reduce((a, g) => a + g.ukupnoUcenika, 0);
          return ponder > 0
            ? Math.round((validOc.reduce((a, g) => a + (g.prosjekOcjena || 0) * g.ukupnoUcenika, 0) / ponder) * 10) / 10
            : null;
        })(),
        ukupnoCasova: perGrupa.reduce((a, g) => a + g.ukupnoCasova, 0),
        ukupnoKvizova: perGrupa.reduce((a, g) => a + g.ukupnoKvizova, 0),
        ukupnoBodova: perGrupa.reduce((a, g) => a + g.ukupnoBodova, 0),
        zvjezdicePozitivne: perGrupa.reduce((a, g) => a + g.zvjezdicePozitivne, 0),
        zvjezdiceNegativne: perGrupa.reduce((a, g) => a + g.zvjezdiceNegativne, 0),
        ukupnoLekcijaZavrseno,
        napredakPoNivoima,
        ukupnoScreentimeSec,
      },
      muallimi,
      perGrupa,
    });
  } catch (err) {
    console.error("Mekteb statistika error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// ── MEKTEB DOKUMENTI (PDF) ──────────────────────────────────────────────────
// Glavni muallim uploaduje PDF dokumente na nivou mekteba (pravila, kućni red...).
// Učenici i roditelji ih čitaju preko vlastitih ruta. Fajlovi se čuvaju u zasebnom
// poddirektoriju (`mekteb-dokumenti`) koji je BLOKIRAN za direktni static pristup
// (vidi app.ts) — serviraju se isključivo kroz autorizovane rute (provjera role +
// pripadnost mektebu), da PDF ne bi bio javno dostupan svima s URL-om.
const dokumentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, mektebDokumentiDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const dokumentUpload = multer({
  storage: dokumentStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.pdf$/i.test(path.extname(file.originalname))) cb(null, true);
    else cb(new Error("Dozvoljen je samo PDF format"));
  },
});

// GET /api/muallim/mekteb/dokumenti — lista dokumenata mekteba (svi muallimi u mektebu).
router.get("/mekteb/dokumenti", async (req, res) => {
  try {
    const ctx = await getMektebCtx(req.user!.userId);
    if (!ctx?.mektebId) {
      res.status(403).json({ error: "Muallim nije u mektebu" });
      return;
    }
    const docs = await db.select().from(mektebDokumentiTable)
      .where(eq(mektebDokumentiTable.mektebId, ctx.mektebId))
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
    console.error("Mekteb dokumenti list error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/mekteb/dokumenti — upload PDF (glavni only). multipart/form-data:
// file (PDF), naziv (obavezno), opis (opciono).
router.post("/mekteb/dokumenti", (req, res) => {
  dokumentUpload.single("file")(req, res, async (err) => {
    if (err) {
      const msg = err instanceof multer.MulterError
        ? (err.code === "LIMIT_FILE_SIZE" ? "Fajl prevelik (max 20MB)" : err.message)
        : err.message || "Greška pri uploadu";
      return res.status(400).json({ error: msg });
    }
    try {
      const ctx = await getMektebCtx(req.user!.userId);
      if (!ctx?.mektebId || !ctx.isGlavni) {
        if (req.file) { try { fs.unlinkSync(req.file.path); } catch {} }
        return res.status(403).json({ error: "Samo glavni muallim ima pristup" });
      }
      if (!req.file) return res.status(400).json({ error: "Nema fajla" });
      const optimization = await optimizePdfFile(req.file.path);
      const storedFileSize = fs.statSync(req.file.path).size;
      console.log(
        `[PDF] ${req.file.originalname}: ${(optimization.bytesBefore / 1024).toFixed(0)}KB -> ` +
        `${(optimization.bytesAfter / 1024).toFixed(0)}KB${optimization.optimized ? "" : " (original)"}`,
      );
      const naziv = String(req.body?.naziv || "").trim() || req.file.originalname.replace(/\.pdf$/i, "");
      const opis = String(req.body?.opis || "").trim() || null;
      const [created] = await db.insert(mektebDokumentiTable).values({
        mektebId: ctx.mektebId,
        naziv: naziv.slice(0, 200),
        opis,
        originalName: req.file.originalname,
        storedName: req.file.filename,
        fileSize: storedFileSize,
        mimeType: req.file.mimetype || "application/pdf",
        uploadedByUserId: req.user!.userId,
      }).returning();
      return res.status(201).json({
        id: created.id,
        naziv: created.naziv,
        opis: created.opis,
        originalName: created.originalName,
        storedName: created.storedName,
        fileSize: created.fileSize,
        createdAt: created.createdAt,
      });
    } catch (e: any) {
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch {} }
      console.error("Mekteb dokument upload error:", e);
      return res.status(500).json({ error: "Greška servera" });
    }
  });
});

// DELETE /api/muallim/mekteb/dokumenti/:id — obriši dokument + fajl (glavni only).
router.delete("/mekteb/dokumenti/:id", async (req, res) => {
  try {
    const ctx = await getMektebCtx(req.user!.userId);
    if (!ctx?.mektebId || !ctx.isGlavni) {
      res.status(403).json({ error: "Samo glavni muallim ima pristup" });
      return;
    }
    const id = parseInt(req.params.id, 10);
    const [doc] = await db.select().from(mektebDokumentiTable).where(eq(mektebDokumentiTable.id, id));
    if (!doc || doc.mektebId !== ctx.mektebId) {
      res.status(404).json({ error: "Dokument nije pronađen" });
      return;
    }
    deleteDokumentFajl(doc.storedName);
    await db.delete(mektebDokumentiTable).where(eq(mektebDokumentiTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error("Mekteb dokument delete error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/mekteb/dokumenti/:id/file — autorizovani download (svi muallimi u mektebu).
router.get("/mekteb/dokumenti/:id/file", async (req, res) => {
  try {
    const ctx = await getMektebCtx(req.user!.userId);
    if (!ctx?.mektebId) {
      res.status(403).json({ error: "Muallim nije u mektebu" });
      return;
    }
    const id = parseInt(req.params.id, 10);
    const [doc] = await db.select().from(mektebDokumentiTable).where(eq(mektebDokumentiTable.id, id));
    if (!doc || doc.mektebId !== ctx.mektebId) {
      res.status(404).json({ error: "Dokument nije pronađen" });
      return;
    }
    streamDokument(res, doc);
  } catch (err) {
    console.error("Mekteb dokument file error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// Validacija ciljne grupe pri dodjeli učenika: grupa mora postojati, biti
// dostupna pozivaocu (vlasnik / admin / glavni u istom mektebu) i NE smije
// biti arhivirana.
async function validateTargetGrupa(
  grupaId: number,
  userId: number,
  isAdmin: boolean,
  mektebCtx?: { mektebId: number; isGlavni: boolean } | null,
): Promise<{ status: number; error: string } | null> {
  if (!Number.isFinite(grupaId) || grupaId <= 0) {
    return { status: 400, error: "Neispravna grupa" };
  }
  const rows = await db.execute(sql`
    SELECT g.muallim_id, g.is_archived, mp.mekteb_id AS muallim_mekteb_id
    FROM grupe g
    LEFT JOIN muallim_profili mp ON mp.user_id = g.muallim_id
    WHERE g.id = ${grupaId}
  `);
  const g = rows.rows[0] as { muallim_id: number; is_archived: boolean; muallim_mekteb_id: number | null } | undefined;
  if (!g) return { status: 404, error: "Grupa nije pronađena" };
  const isOwner = g.muallim_id === userId;
  const isGlavniInSameMekteb = !!(
    mektebCtx?.isGlavni &&
    mektebCtx.mektebId &&
    g.muallim_mekteb_id === mektebCtx.mektebId
  );
  if (!isAdmin && !isOwner && !isGlavniInSameMekteb) {
    return { status: 403, error: "Grupa ne pripada vama" };
  }
  if (g.is_archived) return { status: 400, error: "Grupa je arhivirana — učenici se ne mogu dodavati u arhiviranu grupu" };
  return null;
}

// GET /api/muallim/grupe
// Obični muallim vidi samo vlastite grupe.
// Glavni muallim vidi SVE grupe svog džemata (sa muallimDisplayName poljem).
router.get("/grupe", async (req, res) => {
  try {
    const userId = await resolveViewMuallimId(req);
    if (!userId) { res.status(403).json({ error: "Pregled muallima nije dozvoljen" }); return; }
    const ctx = await getMektebCtx(userId);
    const scopedView = Boolean(req.query.muallimId);

    if (ctx?.isGlavni && ctx.mektebId && !scopedView) {
      // Svi muallimi džemata → njihove grupe.
      // Koristimo subquery umjesto JOIN-a s boolen ORDER BY
      // da izbjegnemo moguće greške na starijim PG verzijama.
      const rows = await db.execute(sql`
        SELECT
          g.id,
          g.muallim_id,
          g.naziv,
          g.skolska_godina,
          g.dani_nastave,
          g.vrijeme_nastave,
          g.datum_pocetka,
          g.datum_kraja,
          COALESCE(g.is_archived, false) AS is_archived,
          g.archived_at,
          u.display_name AS muallim_display_name
        FROM grupe g
        JOIN users u ON u.id = g.muallim_id
        WHERE g.muallim_id IN (
          SELECT user_id FROM muallim_profili WHERE mekteb_id = ${ctx.mektebId}
        )
          AND COALESCE(g.is_archived, false) = false
          AND COALESCE(g.is_active, true) = true
        ORDER BY
          CASE WHEN g.muallim_id = ${userId} THEN 0 ELSE 1 END,
          g.naziv ASC
      `);
      const glavniGrupeIds = (rows.rows as any[]).map(r => r.id as number);
      const secMuallimiGlavni = await db.execute(sql`
        SELECT gm.grupa_id, u.id, u.display_name
        FROM grupa_muallimi gm JOIN users u ON u.id = gm.muallim_id
        WHERE gm.grupa_id IN (
          SELECT id FROM grupe WHERE muallim_id IN (
            SELECT user_id FROM muallim_profili WHERE mekteb_id = ${ctx.mektebId}
          )
        )
      `);
      const secMapGlavni = new Map<number, { id: number; displayName: string }[]>();
      for (const r of secMuallimiGlavni.rows as any[]) {
        if (!secMapGlavni.has(r.grupa_id)) secMapGlavni.set(r.grupa_id, []);
        secMapGlavni.get(r.grupa_id)!.push({ id: r.id, displayName: r.display_name });
      }
      res.json((rows.rows as Record<string, unknown>[]).map(r => ({
        id: r.id,
        muallimId: r.muallim_id,
        naziv: r.naziv,
        skolskaGodina: r.skolska_godina,
        daniNastave: r.dani_nastave,
        vrijemeNastave: r.vrijeme_nastave,
        datumPocetka: r.datum_pocetka ?? null,
        datumKraja: r.datum_kraja ?? null,
        muallimDisplayName: r.muallim_display_name,
        isArchived: r.is_archived ?? false,
        archivedAt: r.archived_at ?? null,
        sekundarniMuallimi: secMapGlavni.get(r.id as number) ?? [],
      })));
      return;
    }

    // Obični muallim — vlastite grupe (drizzle) + grupe gdje je sekundarni muallim (raw SQL)
    // Koristimo odvojene queryje umjesto DISTINCT na jsonb kolonama.
    const grupeOwn = await db.select().from(grupeTable).where(and(
      eq(grupeTable.muallimId, userId),
      sql`COALESCE(is_archived, false) = false`,
      sql`COALESCE(is_active, true) = true`,
    ));
    const grupeSecRows = await db.execute(sql`
      SELECT g.id, g.muallim_id, g.naziv, g.skolska_godina,
        g.dani_nastave, g.vrijeme_nastave, g.datum_pocetka, g.datum_kraja,
        COALESCE(g.is_archived, false) AS is_archived, g.archived_at,
        u.display_name AS muallim_display_name
      FROM grupe g
      JOIN users u ON u.id = g.muallim_id
      JOIN grupa_muallimi gm ON gm.grupa_id = g.id
      WHERE gm.muallim_id = ${userId}
        AND g.muallim_id != ${userId}
        AND COALESCE(g.is_archived, false) = false
        AND COALESCE(g.is_active, true) = true
    `);
    const arhivaRows2 = await db.execute(sql`
      SELECT id, is_archived, archived_at FROM grupe
      WHERE muallim_id = ${userId}
        OR id IN (SELECT grupa_id FROM grupa_muallimi WHERE muallim_id = ${userId})
    `);
    const arhivaMap2 = new Map(
      (arhivaRows2.rows as Array<{ id: number; is_archived: boolean; archived_at: string | null }>)
        .map(r => [r.id, r]),
    );
    const secMuallimiRows2 = await db.execute(sql`
      SELECT gm.grupa_id, u.id, u.display_name
      FROM grupa_muallimi gm JOIN users u ON u.id = gm.muallim_id
      WHERE gm.grupa_id IN (
        SELECT id FROM grupe WHERE muallim_id = ${userId}
        UNION ALL
        SELECT grupa_id FROM grupa_muallimi WHERE muallim_id = ${userId}
      )
    `);
    const secMap = new Map<number, { id: number; displayName: string }[]>();
    for (const r of secMuallimiRows2.rows as any[]) {
      if (!secMap.has(r.grupa_id)) secMap.set(r.grupa_id, []);
      secMap.get(r.grupa_id)!.push({ id: r.id, displayName: r.display_name });
    }
    const ownIds = new Set(grupeOwn.map(g => g.id));
    const allGrupe = [
      ...grupeOwn.map(g => ({
        id: g.id, muallimId: g.muallimId, naziv: g.naziv,
        skolskaGodina: g.skolskaGodina, daniNastave: g.daniNastave,
        vrijemeNastave: g.vrijemeNastave,
        datumPocetka: (g as any).datumPocetka ?? null,
        datumKraja: (g as any).datumKraja ?? null,
        isArchived: arhivaMap2.get(g.id)?.is_archived ?? false,
        archivedAt: arhivaMap2.get(g.id)?.archived_at ?? null,
        muallimDisplayName: null as string | null,
        sekundarniMuallimi: secMap.get(g.id) ?? [],
      })),
      ...(grupeSecRows.rows as any[]).filter(r => !ownIds.has(r.id)).map(r => ({
        id: r.id, muallimId: r.muallim_id, naziv: r.naziv,
        skolskaGodina: r.skolska_godina, daniNastave: r.dani_nastave,
        vrijemeNastave: r.vrijeme_nastave,
        datumPocetka: r.datum_pocetka ?? null, datumKraja: r.datum_kraja ?? null,
        isArchived: arhivaMap2.get(r.id)?.is_archived ?? r.is_archived ?? false,
        archivedAt: arhivaMap2.get(r.id)?.archived_at ?? r.archived_at ?? null,
        muallimDisplayName: r.muallim_display_name as string | null,
        sekundarniMuallimi: secMap.get(r.id) ?? [],
      })),
    ];
    res.json(allGrupe);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/grupe/:id/muallimi — dodaj sekundarnog muallima grupi
// Samo vlasnik grupe, admin, ili glavni muallim džemata.
router.post("/grupe/:id/muallimi", async (req, res) => {
  try {
    const grupaId = parseInt(req.params.id);
    const { muallimId } = req.body as { muallimId?: number };
    if (!grupaId || !muallimId) {
      res.status(400).json({ error: "grupaId i muallimId su obavezni" }); return;
    }
    const userId = req.user!.userId;
    const isAdmin = req.user!.role === "admin";
    const ctx = await getMektebCtx(userId);

    // Provjeri da li korisnik ima pravo upravljati ovom grupom (vlasnik ili glavni)
    const [grupa] = await db.select().from(grupeTable).where(eq(grupeTable.id, grupaId));
    if (!grupa) { res.status(404).json({ error: "Grupa nije pronađena" }); return; }
    const isVlasnik = grupa.muallimId === userId;
    const isGlavniInSameMekteb = !!(ctx?.isGlavni && ctx.mektebId);
    if (!isAdmin && !isVlasnik && !isGlavniInSameMekteb) {
      res.status(403).json({ error: "Samo vlasnik ili glavni muallim mogu dodavati muallime grupi" }); return;
    }

    // Provjeri da ciljni muallim postoji i pripada istom mektebu
    const targetCtx = await getMektebCtx(muallimId);
    if (!isAdmin && ctx?.mektebId && targetCtx?.mektebId !== ctx.mektebId) {
      res.status(403).json({ error: "Muallim ne pripada ovom džematu" }); return;
    }
    if (muallimId === grupa.muallimId) {
      res.status(400).json({ error: "Taj muallim je već primarni vlasnik grupe" }); return;
    }

    await db.execute(sql`
      INSERT INTO grupa_muallimi (grupa_id, muallim_id)
      VALUES (${grupaId}, ${muallimId})
      ON CONFLICT (grupa_id, muallim_id) DO NOTHING
    `);
    const [muallimUser] = await db.select({ id: usersTable.id, displayName: usersTable.displayName })
      .from(usersTable).where(eq(usersTable.id, muallimId));
    res.json({ ok: true, muallim: { id: muallimUser.id, displayName: muallimUser.displayName } });
  } catch (err) {
    console.error("grupe muallimi POST error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// DELETE /api/muallim/grupe/:id/muallimi/:muallimId — ukloni sekundarnog muallima
router.delete("/grupe/:id/muallimi/:muallimId", async (req, res) => {
  try {
    const grupaId = parseInt(req.params.id);
    const muallimId = parseInt(req.params.muallimId);
    if (!grupaId || !muallimId) {
      res.status(400).json({ error: "Neispravni parametri" }); return;
    }
    const userId = req.user!.userId;
    const isAdmin = req.user!.role === "admin";
    const ctx = await getMektebCtx(userId);

    const [grupa] = await db.select().from(grupeTable).where(eq(grupeTable.id, grupaId));
    if (!grupa) { res.status(404).json({ error: "Grupa nije pronađena" }); return; }
    const isVlasnik = grupa.muallimId === userId;
    const isGlavniInSameMekteb = !!(ctx?.isGlavni && ctx.mektebId);
    if (!isAdmin && !isVlasnik && !isGlavniInSameMekteb) {
      res.status(403).json({ error: "Samo vlasnik ili glavni muallim mogu uklanjati muallime" }); return;
    }

    await db.execute(sql`
      DELETE FROM grupa_muallimi WHERE grupa_id = ${grupaId} AND muallim_id = ${muallimId}
    `);
    res.json({ ok: true });
  } catch (err) {
    console.error("grupe muallimi DELETE error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/grupe/:id/arhiviraj — arhiviraj grupu: snapshot članstva,
// oslobodi učenike (grupaId=null), označi grupu arhiviranom. Podaci (ocjene,
// prisustvo, zadaće, plan) ostaju netaknuti.
router.post("/grupe/:id/arhiviraj", async (req, res) => {
  try {
    const grupaId = parseInt(req.params.id);
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const grupa = await verifyGrupaAccess(grupaId, userId, userRole);
    if (!grupa) { res.status(404).json({ error: "Grupa nije pronađena" }); return; }

    let transitioned = false;
    await db.transaction(async (tx) => {
      // Konkurentno-siguran prelaz: samo jedan zahtjev može arhivirati.
      const upd = await tx.execute(sql`
        UPDATE grupe SET is_archived = true, archived_at = NOW(), is_active = false
        WHERE id = ${grupaId} AND is_archived = false
        RETURNING id
      `);
      if (upd.rows.length === 0) return; // već arhivirana
      transitioned = true;
      // Snapshot trenutnog članstva — trajni zapis ko je bio u grupi
      // (sa imenom, da zapis preživi i eventualno brisanje naloga).
      await tx.execute(sql`
        INSERT INTO grupe_arhiva_clanovi (grupa_id, ucenik_id, display_name, username)
        SELECT ${grupaId}, up.user_id, u.display_name, u.username
        FROM ucenik_profili up
        JOIN users u ON u.id = up.user_id
        WHERE up.grupa_id = ${grupaId}
        ON CONFLICT (grupa_id, ucenik_id) DO NOTHING
      `);
      // Oslobodi učenike da mogu u druge grupe.
      await tx.update(ucenikProfiliTable)
        .set({ grupaId: null })
        .where(eq(ucenikProfiliTable.grupaId, grupaId));
    });
    if (!transitioned) {
      res.status(400).json({ error: "Grupa je već arhivirana" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Arhiviranje grupe error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/grupe/:id/vrati — vrati grupu iz arhive (učenici se NE
// vraćaju automatski — snapshot ostaje kao historijski zapis).
router.post("/grupe/:id/vrati", async (req, res) => {
  try {
    const grupaId = parseInt(req.params.id);
    const userId = req.user!.userId;
    const isAdmin = req.user!.role === "admin";
    const grupaWhere = isAdmin
      ? eq(grupeTable.id, grupaId)
      : and(eq(grupeTable.id, grupaId), eq(grupeTable.muallimId, userId));
    const [grupa] = await db.select().from(grupeTable).where(grupaWhere);
    if (!grupa) { res.status(404).json({ error: "Grupa nije pronađena" }); return; }
    await db.execute(sql`UPDATE grupe SET is_archived = false, archived_at = NULL, is_active = true WHERE id = ${grupaId}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/grupe/:id/arhiva-clanovi — bivši članovi arhivirane grupe.
router.get("/grupe/:id/arhiva-clanovi", async (req, res) => {
  try {
    const grupaId = parseInt(req.params.id);
    const userId = req.user!.userId;
    const isAdmin = req.user!.role === "admin";
    const grupaWhere = isAdmin
      ? eq(grupeTable.id, grupaId)
      : and(eq(grupeTable.id, grupaId), eq(grupeTable.muallimId, userId));
    const [grupa] = await db.select().from(grupeTable).where(grupaWhere);
    if (!grupa) { res.status(404).json({ error: "Grupa nije pronađena" }); return; }
    const rows = await db.execute(sql`
      SELECT gac.ucenik_id AS "ucenikId",
             gac.archived_at AS "archivedAt",
             COALESCE(u.display_name, gac.display_name) AS "displayName",
             COALESCE(u.username, gac.username) AS "username"
      FROM grupe_arhiva_clanovi gac
      LEFT JOIN users u ON u.id = gac.ucenik_id
      WHERE gac.grupa_id = ${grupaId}
      ORDER BY COALESCE(u.display_name, gac.display_name) ASC
    `);
    res.json(rows.rows);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/grupe/:id/izvjestaj — svi podaci grupe za preuzimanje prije brisanja
router.get("/grupe/:id/izvjestaj", async (req, res) => {
  try {
    const grupaId = parseInt(req.params.id);
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const grupa = await verifyGrupaAccess(grupaId, userId, userRole);
    if (!grupa) { res.status(404).json({ error: "Grupa nije pronađena" }); return; }

    const [ucenici, prisustvo, ocjene, planLekcija] = await Promise.all([
      db.execute(sql`
        SELECT up.user_id AS id, u.display_name AS "displayName", u.username
        FROM ucenik_profili up
        JOIN users u ON u.id = up.user_id
        WHERE up.grupa_id = ${grupaId}
        ORDER BY u.display_name ASC
      `),
      db.execute(sql`
        SELECT p.datum, p.ucenik_id AS "ucenikId", u.display_name AS "ucenikIme",
               p.status, p.napomena
        FROM prisustvo p
        JOIN users u ON u.id = p.ucenik_id
        WHERE p.grupa_id = ${grupaId}
        ORDER BY p.datum ASC, u.display_name ASC
      `),
      db.execute(sql`
        SELECT o.datum, o.ucenik_id AS "ucenikId", u.display_name AS "ucenikIme",
               o.kategorija, o.ocjena,
               o.lekcija_naziv AS "lekcijaNaziv", o.napomena
        FROM ocjene o
        JOIN users u ON u.id = o.ucenik_id
        WHERE o.grupa_id = ${grupaId}
        ORDER BY o.datum ASC, u.display_name ASC
      `),
      db.execute(sql`
        SELECT pl.datum, pl.napomena,
               COALESCE(pl.lekcija_naslov, '') AS "lekcijaNaslov"
        FROM plan_lekcija pl
        WHERE pl.grupa_id = ${grupaId}
        ORDER BY pl.datum ASC
      `),
    ]);

    res.json({
      grupa: { id: grupa.id, naziv: grupa.naziv, skolskaGodina: grupa.skolskaGodina },
      ucenici: ucenici.rows,
      prisustvo: prisustvo.rows,
      ocjene: ocjene.rows,
      planLekcija: planLekcija.rows,
    });
  } catch (err) {
    console.error("Izvještaj grupe error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/grupe
router.post("/grupe", async (req, res) => {
  try {
    const { naziv, skolskaGodina, daniNastave, vrijemeNastave, datumPocetka, datumKraja, muallimId: bodyMuallimId } = req.body;
    const userId = req.user!.userId;
    let muallimId = userId;

    // Glavni muallim može dodijeliti grupu drugom muallimu svog mekteba
    if (bodyMuallimId && Number(bodyMuallimId) !== userId) {
      const ctx = await getMektebCtx(userId);
      if (ctx?.isGlavni && ctx.mektebId) {
        const [ciljni] = await db.select().from(muallimProfiliTable)
          .where(and(eq(muallimProfiliTable.userId, Number(bodyMuallimId)), eq(muallimProfiliTable.mektebId, ctx.mektebId)));
        if (ciljni) muallimId = Number(bodyMuallimId);
      }
    }

    const [nova] = await db.insert(grupeTable).values({
      muallimId,
      naziv,
      skolskaGodina,
      daniNastave: daniNastave || [],
      vrijemeNastave,
      datumPocetka: datumPocetka || null,
      datumKraja: datumKraja || null,
    }).returning();
    res.status(201).json(nova);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/muallim/grupe/:id
router.put("/grupe/:id", async (req, res) => {
  try {
    const { naziv, skolskaGodina, daniNastave, vrijemeNastave, isActive, datumPocetka, datumKraja, muallimId: bodyMuallimId } = req.body;
    const userId = req.user!.userId;
    const grupaId = parseInt(req.params.id);
    const ctx = await getMektebCtx(userId);

    // Provjeri vlasništvo nad grupom: obični muallim samo vlastite, glavni muallim sve u svom mektebu
    const grupaWhere = ctx?.isGlavni && ctx.mektebId
      ? sql`g.id = ${grupaId} AND EXISTS (
          SELECT 1 FROM muallim_profili mp
          WHERE mp.user_id = g.muallim_id AND mp.mekteb_id = ${ctx.mektebId}
        )`
      : sql`g.id = ${grupaId} AND g.muallim_id = ${userId}`;

    const existing = await db.execute(sql`SELECT id FROM grupe g WHERE ${grupaWhere}`);
    if (!existing.rows.length) { res.status(404).json({ error: "Grupa nije pronađena" }); return; }

    const updateData: Record<string, unknown> = {};
    if (naziv !== undefined) updateData.naziv = naziv;
    if (skolskaGodina !== undefined) updateData.skolskaGodina = skolskaGodina;
    if (daniNastave !== undefined) updateData.daniNastave = daniNastave;
    if (vrijemeNastave !== undefined) updateData.vrijemeNastave = vrijemeNastave;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (datumPocetka !== undefined) updateData.datumPocetka = datumPocetka;
    if (datumKraja !== undefined) updateData.datumKraja = datumKraja;

    // Reassign muallima — samo glavni muallim smije, ciljni mora biti u istom mektebu
    if (bodyMuallimId !== undefined && ctx?.isGlavni && ctx.mektebId) {
      const [ciljni] = await db.select().from(muallimProfiliTable)
        .where(and(eq(muallimProfiliTable.userId, Number(bodyMuallimId)), eq(muallimProfiliTable.mektebId, ctx.mektebId)));
      if (ciljni) updateData.muallimId = Number(bodyMuallimId);
    }

    const [updated] = await db.update(grupeTable)
      .set(updateData)
      .where(eq(grupeTable.id, grupaId))
      .returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// DELETE /api/muallim/grupe/:id
router.delete("/grupe/:id", async (req, res) => {
  try {
    const grupaId = parseInt(req.params.id);
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const grupa = await verifyGrupaAccess(grupaId, userId, userRole);
    if (!grupa) { res.status(404).json({ error: "Grupa nije pronađena" }); return; }

    // Arhivirana grupa je zaštićena od brisanja — prvo je vrati iz arhive.
    const arhCheck = await db.execute(sql`SELECT is_archived FROM grupe WHERE id = ${grupaId}`);
    if ((arhCheck.rows[0] as { is_archived?: boolean } | undefined)?.is_archived) {
      res.status(400).json({ error: "Arhivirana grupa se ne može obrisati. Prvo je vrati iz arhive." });
      return;
    }

    await db.transaction(async (tx) => {
      await tx.update(ucenikProfiliTable)
        .set({ grupaId: null })
        .where(eq(ucenikProfiliTable.grupaId, grupaId));

      await tx.update(ocjeneTable)
        .set({ grupaId: null })
        .where(eq(ocjeneTable.grupaId, grupaId));

      await tx.delete(zadaceTable).where(eq(zadaceTable.grupaId, grupaId));
      await tx.delete(planLekcijaTable).where(eq(planLekcijaTable.grupaId, grupaId));
      await tx.delete(mektebKalendarTable).where(eq(mektebKalendarTable.grupaId, grupaId));
      await tx.delete(priustvoTable).where(eq(priustvoTable.grupaId, grupaId));
      // FK constraint: mora se obrisati prije grupe
      await tx.delete(grupaRasporedTable).where(eq(grupaRasporedTable.grupaId, grupaId));
      await tx.execute(sql`DELETE FROM grupa_muallimi WHERE grupa_id = ${grupaId}`);
      await tx.delete(grupeTable).where(eq(grupeTable.id, grupaId));
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Delete grupa error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/ucenici
// Obični muallim vidi samo vlastite učenike.
// Glavni muallim vidi SVE učenike svog džemata (sa muallimId + muallimDisplayName).
router.get("/ucenici", async (req, res) => {
  try {
    const userId = await resolveViewMuallimId(req);
    if (!userId) { res.status(403).json({ error: "Pregled muallima nije dozvoljen" }); return; }
    const ctx = await getMektebCtx(userId);
    const scopedView = Boolean(req.query.muallimId);

    if (ctx?.isGlavni && ctx.mektebId && !scopedView) {
      // Svi učenici džemata — join kroz muallim_profili (siguran i za starije zapise
      // gdje ucenik_profili.mekteb_id može biti NULL).
      const rows = await db.execute(sql`
        SELECT up.user_id, up.muallim_id, up.grupa_id, up.mekteb_id, up.is_archived,
               u.display_name, u.username, u.email, u.role,
               u.last_seen_at, u.total_screentime_sec,
               mu.display_name AS muallim_display_name,
               g.naziv AS grupa_naziv,
               EXISTS (
                 SELECT 1
                 FROM roditelj_ucenik ru
                 WHERE ru.ucenik_id = up.user_id
                   AND ru.status = 'approved'
               ) AS roditelj_povezan
        FROM ucenik_profili up
        JOIN muallim_profili mp ON mp.user_id = up.muallim_id AND mp.mekteb_id = ${ctx.mektebId}
        JOIN users u ON u.id = up.user_id
        LEFT JOIN users mu ON mu.id = up.muallim_id
        LEFT JOIN grupe g ON g.id = up.grupa_id
        WHERE (up.is_archived = false OR up.is_archived IS NULL)
          AND (up.grupa_id IS NULL OR COALESCE(g.is_archived, false) = false)
          AND (up.grupa_id IS NULL OR COALESCE(g.is_active, true) = true)
        ORDER BY u.display_name ASC
      `);

      type Row = {
        user_id: number; muallim_id: number; grupa_id: number | null; mekteb_id: number | null;
        is_archived: boolean | null; display_name: string; username: string; email: string | null;
        role: string;
        last_seen_at: string | null; total_screentime_sec: number | null;
        muallim_display_name: string | null; grupa_naziv: string | null;
        roditelj_povezan: boolean;
      };
      res.json((rows.rows as Row[]).map(r => ({
        id: r.user_id,
        displayName: r.display_name,
        username: r.username,
        email: r.email,
        role: r.role,
        lastSeenAt: r.last_seen_at,
        totalScreentimeSec: r.total_screentime_sec,
        grupaId: r.grupa_id,
        grupaIme: r.grupa_naziv,
        muallimId: r.muallim_id,
        muallimDisplayName: r.muallim_display_name,
        roditeljPovezan: r.roditelj_povezan,
        aktivanStatus: true,
        profil: { userId: r.user_id, muallimId: r.muallim_id, grupaId: r.grupa_id, mektebId: r.mekteb_id, isArchived: r.is_archived ?? false },
      })));
      return;
    }

    // Obični muallim — vlastiti učenici
    const profiliRaw = await db.select().from(ucenikProfiliTable)
      .where(eq(ucenikProfiliTable.muallimId, userId));
    const activeGrupaRows = await db.select({ id: grupeTable.id }).from(grupeTable)
      .where(and(
        eq(grupeTable.muallimId, userId),
        sql`COALESCE(is_archived, false) = false`,
        sql`COALESCE(is_active, true) = true`,
      ));
    const activeGrupaIds = new Set(activeGrupaRows.map(g => g.id));
    const profili = profiliRaw.filter(p =>
      !p.isArchived && (!p.grupaId || activeGrupaIds.has(p.grupaId)),
    );
    if (profili.length === 0) { res.json([]); return; }

    const userIds = profili.map(p => p.userId);
    const korisnici = await db.select().from(usersTable).where(inArray(usersTable.id, userIds));
    const roditeljskeVeze = await db.select({ ucenikId: roditeljUcenikTable.ucenikId })
      .from(roditeljUcenikTable)
      .where(and(
        inArray(roditeljUcenikTable.ucenikId, userIds),
        eq(roditeljUcenikTable.status, "approved"),
      ));
    const uceniciSPovezanimRoditeljem = new Set(roditeljskeVeze.map(v => v.ucenikId));
    const grupe = await db.select().from(grupeTable).where(and(
      eq(grupeTable.muallimId, userId),
      sql`COALESCE(is_archived, false) = false`,
      sql`COALESCE(is_active, true) = true`,
    ));
    const grupaMap = Object.fromEntries(grupe.map(g => [g.id, g.naziv]));

    const result = korisnici.map(u => {
      const profil = profili.find(p => p.userId === u.id);
      return {
        ...u,
        passwordHash: undefined,
        profil,
        grupaId: profil?.grupaId || null,
        grupaIme: profil?.grupaId ? grupaMap[profil.grupaId] || null : null,
        roditeljPovezan: uceniciSPovezanimRoditeljem.has(u.id),
        aktivanStatus: profil ? !profil.isArchived : true,
      };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/ucenici - create a new student (optionally with parent)
router.post("/ucenici", async (req, res) => {
  try {
    const { displayName, grupaId, password, roditelj } = req.body as {
      displayName: string;
      grupaId?: number;
      password?: string;
      roditelj?: { displayName: string };
    };

    if (!displayName?.trim()) {
      res.status(400).json({ error: "Ime i prezime učenika je obavezno" });
      return;
    }

    if (grupaId) {
      const postCtx = await getMektebCtx(req.user!.userId);
      const grupaErr = await validateTargetGrupa(
        parseInt(String(grupaId)), req.user!.userId, req.user!.role === "admin",
        postCtx?.mektebId ? { mektebId: postCtx.mektebId, isGlavni: postCtx.isGlavni } : null,
      );
      if (grupaErr) { res.status(grupaErr.status).json({ error: grupaErr.error }); return; }
    }

    // Roditelj (ako je poslan) ne ulazi u kvotu — broji se samo učenik
    const roditeljZahtjev = roditelj?.displayName?.trim();
    if (roditelj && !roditeljZahtjev) {
      res.status(400).json({ error: "Ime roditelja je obavezno kada se dodaje roditelj" });
      return;
    }

    // Check licence limit (samo učenik se broji)
    const [profil] = await db.select().from(muallimProfiliTable).where(eq(muallimProfiliTable.userId, req.user!.userId));
    if (profil && profil.licencesUsed >= profil.licenceCount) {
      res.status(403).json({ error: "Dostigli ste maksimalan broj učenika (limit licenci)" });
      return;
    }

    const muallimId = req.user!.userId;

    // Učenik i roditelj iz istog para dijele isti 4-cifreni sufiks i lozinku
    // (npr. amir.4567 / Mekteb4567 i ismet.4567 / Mekteb4567). Da bi sufiks
    // ostao usklađen i kod kolizije, cijelu pair transakciju retry-amo s
    // novim sufiksom. Bcrypt se izvršava jednom po pokušaju (ista lozinka).
    // Napomena: kad se kreira par, custom `password` se ignoriše da par
    // ostane konzistentan; muallim može kasnije promijeniti šifre preko
    // postojećih reset endpoint-a.
    const useCustomPassword = !!password && !roditeljZahtjev;

    let chosenSuffix = 0;
    let chosenPassword = "";
    let chosenUcenikPassword = "";
    let createdPair: { newUcenik: NewUserRow; newRoditelj: NewUserRow | null } | null = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const pair = generatePairCredentials();
      const ucenikPass = useCustomPassword ? password! : pair.password;
      const ucenikHash = await bcrypt.hash(ucenikPass, 10);
      const roditeljHash = roditeljZahtjev ? (useCustomPassword ? null : await bcrypt.hash(pair.password, 10)) : null;

      try {
        createdPair = await db.transaction(async (tx) => {
          const newUcenik = await tryInsertUser(tx, displayName, ucenikHash, displayName.trim(), "ucenik", pair.suffix);
          await tx.insert(ucenikProfiliTable).values({
            userId: newUcenik.id, muallimId, grupaId: grupaId || null,
          });

          let newRoditelj: NewUserRow | null = null;
          if (roditeljZahtjev && roditeljHash) {
            newRoditelj = await tryInsertUser(tx, roditeljZahtjev, roditeljHash, roditeljZahtjev, "roditelj", pair.suffix);
            await tx.insert(roditeljProfiliTable).values({ userId: newRoditelj.id });
            await tx.insert(roditeljUcenikTable).values({
              roditeljId: newRoditelj.id,
              ucenikId: newUcenik.id,
              status: "approved",
              approvedAt: new Date(),
              approvedBy: muallimId,
            });
          }

          if (profil) {
            await tx.update(muallimProfiliTable)
              .set({ licencesUsed: profil.licencesUsed + 1 })
              .where(eq(muallimProfiliTable.userId, muallimId));
          }
          return { newUcenik, newRoditelj };
        });
        chosenSuffix = pair.suffix;
        chosenPassword = pair.password;
        chosenUcenikPassword = ucenikPass;
        break;
      } catch (e: any) {
        if (attempt === 4 || !isUniqueViolation(e)) throw e;
      }
    }

    if (!createdPair) {
      res.status(409).json({ error: "Nije moguće generisati jedinstveno korisničko ime — pokušajte ponovo" });
      return;
    }

    res.status(201).json({
      ...createdPair.newUcenik,
      passwordHash: undefined,
      generatedPassword: chosenUcenikPassword,
      roditelj: createdPair.newRoditelj
        ? {
            id: createdPair.newRoditelj.id,
            displayName: createdPair.newRoditelj.displayName,
            username: createdPair.newRoditelj.username,
            generatedPassword: chosenPassword,
          }
        : null,
    });
  } catch (err: any) {
    console.error(err);
    if (err?.message === "USERNAME_COLLISION") {
      res.status(409).json({ error: "Nije moguće generisati jedinstveno korisničko ime — pokušajte ponovo" });
      return;
    }
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/ucenici/bulk - create multiple students at once,
// optionally each with a parent.
// Body shape (preferirano): { entries: Array<{ ucenik: string; roditelj?: string }>, grupaId? }
// Back-compat: { imena: string[], grupaId? } — bez roditelja.
// Roditelji NE ulaze u kvotu licenci.
router.post("/ucenici/bulk", async (req, res) => {
  try {
    const body = req.body as {
      entries?: Array<{ ucenik?: string; roditelj?: string | null }>;
      imena?: string[];
      grupaId?: number;
    };

    let normalized: Array<{ ucenik: string; roditelj: string | null }> = [];
    if (Array.isArray(body.entries) && body.entries.length > 0) {
      normalized = body.entries
        .map(e => ({
          ucenik: (e?.ucenik || "").trim(),
          roditelj: e?.roditelj ? String(e.roditelj).trim() : null,
        }))
        .filter(e => e.ucenik.length > 0)
        .map(e => ({ ucenik: e.ucenik, roditelj: e.roditelj && e.roditelj.length > 0 ? e.roditelj : null }));
    } else if (Array.isArray(body.imena) && body.imena.length > 0) {
      normalized = body.imena
        .map(n => ({ ucenik: (n || "").trim(), roditelj: null }))
        .filter(e => e.ucenik.length > 0);
    }

    if (normalized.length === 0) {
      res.status(400).json({ error: "Lista učenika je obavezna" });
      return;
    }

    if (body.grupaId) {
      const bulkCtx = await getMektebCtx(req.user!.userId);
      const grupaErr = await validateTargetGrupa(
        parseInt(String(body.grupaId)), req.user!.userId, req.user!.role === "admin",
        bulkCtx?.mektebId ? { mektebId: bulkCtx.mektebId, isGlavni: bulkCtx.isGlavni } : null,
      );
      if (grupaErr) { res.status(grupaErr.status).json({ error: grupaErr.error }); return; }
    }

    const muallimId = req.user!.userId;
    const [profil] = await db.select().from(muallimProfiliTable).where(eq(muallimProfiliTable.userId, muallimId));
    const remaining = profil ? profil.licenceCount - profil.licencesUsed : 999;
    if (normalized.length > remaining) {
      res.status(403).json({ error: `Možete dodati još ${remaining} učenika (limit licenci)` });
      return;
    }

    const grupaId = body.grupaId;

    const results: Array<{
      id: number; displayName: string; username: string; generatedPassword: string;
      roditelj: { id: number; displayName: string; username: string; generatedPassword: string } | null;
    }> = [];

    let kreiranoUcenika = 0;
    for (const e of normalized) {
      // Po jedan učenik (sa opcionim roditeljem) — retry petlja garantuje
      // da par dijeli sufiks i lozinku i kad postoji kolizija username-a.
      let createdEntry: typeof results[number] | null = null;
      let lastErr: any = null;

      for (let attempt = 0; attempt < 5; attempt++) {
        const pair = generatePairCredentials();
        const sharedHash = await bcrypt.hash(pair.password, 10);

        try {
          const created = await db.transaction(async (tx) => {
            const newUcenik = await tryInsertUser(tx, e.ucenik, sharedHash, e.ucenik, "ucenik", pair.suffix);
            await tx.insert(ucenikProfiliTable).values({
              userId: newUcenik.id, muallimId, grupaId: grupaId || null,
            });

            let newRoditelj: NewUserRow | null = null;
            if (e.roditelj) {
              newRoditelj = await tryInsertUser(tx, e.roditelj, sharedHash, e.roditelj, "roditelj", pair.suffix);
              await tx.insert(roditeljProfiliTable).values({ userId: newRoditelj.id });
              await tx.insert(roditeljUcenikTable).values({
                roditeljId: newRoditelj.id,
                ucenikId: newUcenik.id,
                status: "approved",
                approvedAt: new Date(),
                approvedBy: muallimId,
              });
            }
            return { newUcenik, newRoditelj };
          });

          createdEntry = {
            id: created.newUcenik.id,
            displayName: created.newUcenik.displayName,
            username: created.newUcenik.username,
            generatedPassword: pair.password,
            roditelj: created.newRoditelj
              ? {
                  id: created.newRoditelj.id,
                  displayName: created.newRoditelj.displayName,
                  username: created.newRoditelj.username,
                  generatedPassword: pair.password,
                }
              : null,
          };
          break;
        } catch (err: any) {
          lastErr = err;
          if (!isUniqueViolation(err)) throw err;
        }
      }

      if (!createdEntry) {
        throw lastErr ?? new Error("USERNAME_COLLISION");
      }

      results.push(createdEntry);
      kreiranoUcenika++;
    }

    if (profil && kreiranoUcenika > 0) {
      await db.update(muallimProfiliTable)
        .set({ licencesUsed: profil.licencesUsed + kreiranoUcenika })
        .where(eq(muallimProfiliTable.userId, muallimId));
    }

    res.status(201).json(results);
  } catch (err: any) {
    console.error("[POST /muallim/ucenici/bulk]", err);
    if (err?.message === "USERNAME_COLLISION") {
      res.status(409).json({ error: "Nije moguće generisati jedinstveno korisničko ime — pokušajte ponovo" });
      return;
    }
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/ucenici/:id/roditelji — lista roditelja postojećeg učenika.
router.get("/ucenici/:id/roditelji", async (req, res) => {
  try {
    const ucenikId = parseInt(req.params.id);
    const muallimId = req.user!.userId;

    const profil = await getManageableUcenikProfile(muallimId, ucenikId);
    if (!profil) { res.status(404).json({ error: "Učenik nije pronađen" }); return; }

    const veze = await db
      .select({
        id: usersTable.id,
        displayName: usersTable.displayName,
        username: usersTable.username,
        status: roditeljUcenikTable.status,
        approvedAt: roditeljUcenikTable.approvedAt,
      })
      .from(roditeljUcenikTable)
      .innerJoin(usersTable, eq(usersTable.id, roditeljUcenikTable.roditeljId))
      .where(eq(roditeljUcenikTable.ucenikId, ucenikId))
      .orderBy(asc(roditeljUcenikTable.id));

    res.json(veze);
  } catch (err) {
    console.error("[GET /muallim/ucenici/:id/roditelji]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/ucenici/:id/povezi-roditelja — poveže POSTOJEĆEG roditelja
// (po korisničkom imenu) sa POSTOJEĆIM učenikom muallima. Korisno kad roditelj
// već ima jedno dijete u mektebu, a muallim mu hoće dodati još jedno bez čekanja
// da roditelj sam podnese zahtjev.
// Body: { roditeljUsername: string }
router.post("/ucenici/:id/povezi-roditelja", async (req, res) => {
  try {
    const ucenikId = parseInt(req.params.id);
    const muallimId = req.user!.userId;
    const rawUsername = String((req.body?.roditeljUsername ?? "")).trim();
    if (!rawUsername) {
      res.status(400).json({ error: "Korisničko ime roditelja je obavezno" });
      return;
    }
    const username = rawUsername.replace(/^@/, "").toLowerCase();

    const profil = await getManageableUcenikProfile(muallimId, ucenikId);
    if (!profil) { res.status(404).json({ error: "Učenik nije pronađen" }); return; }

    // Pronađi roditelja po korisničkom imenu.
    const [roditelj] = await db.select().from(usersTable)
      .where(and(eq(usersTable.username, username), eq(usersTable.role, "roditelj")));
    if (!roditelj) {
      res.status(404).json({ error: "Roditelj sa tim korisničkim imenom nije pronađen" });
      return;
    }

    // Pravilo je 1 učenik = 1 odobren roditelj — provjeri prije povezivanja.
    const approvedVeze1 = await db.select({ roditeljId: roditeljUcenikTable.roditeljId })
      .from(roditeljUcenikTable)
      .where(and(eq(roditeljUcenikTable.ucenikId, ucenikId), eq(roditeljUcenikTable.status, "approved")));
    if (approvedVeze1.length >= 1) {
      res.status(409).json({ error: oneApprovedRoditeljError });
      return;
    }


    // Provjeri da li veza već postoji.
    const [postojeca] = await db.select().from(roditeljUcenikTable)
      .where(and(
        eq(roditeljUcenikTable.roditeljId, roditelj.id),
        eq(roditeljUcenikTable.ucenikId, ucenikId),
      ));

    if (postojeca) {
      if (postojeca.status === "approved") {
        res.status(409).json({ error: "Roditelj je već povezan sa ovim učenikom" });
        return;
      }
      // Pending ili rejected → reuse zapis i postavi approved.
      await db.update(roditeljUcenikTable)
        .set({ status: "approved", approvedAt: new Date(), approvedBy: muallimId })
        .where(eq(roditeljUcenikTable.id, postojeca.id));
    } else {
      await db.insert(roditeljUcenikTable).values({
        roditeljId: roditelj.id,
        ucenikId,
        status: "approved",
        approvedAt: new Date(),
        approvedBy: muallimId,
      });
    }

    // In-app obavijest roditelju.
    const [ucenikUser] = await db.select({ displayName: usersTable.displayName })
      .from(usersTable).where(eq(usersTable.id, ucenikId));
    try {
      await db.insert(porukeTable).values({
        posiljateljId: muallimId,
        primateljId: roditelj.id,
        naslov: "Povezani ste sa novim djetetom",
        sadrzaj: `Muallim vas je povezao sa učenikom ${ucenikUser?.displayName ?? `#${ucenikId}`}. Sada možete pratiti njegov napredak u svom roditeljskom panelu.`,
      });
    } catch (err) {
      console.error("[POST /muallim/ucenici/:id/poveži-roditelja] in-app poruka failed", err);
    }

    res.status(201).json({
      id: roditelj.id,
      displayName: roditelj.displayName,
      username: roditelj.username,
      status: "approved",
    });
  } catch (err: any) {
    console.error("[POST /muallim/ucenici/:id/poveži-roditelja]", err);
    if (isOneApprovedRoditeljViolation(err)) {
      res.status(409).json({ error: oneApprovedRoditeljError });
      return;
    }
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/ucenici/:id/roditelj — kreira roditelja za POSTOJEĆEG
// učenika i odmah ga povezuje (status='approved'). Roditelj NE ulazi u kvotu.
// Body: { displayName: string }
router.post("/ucenici/:id/roditelj", async (req, res) => {
  try {
    const ucenikId = parseInt(req.params.id);
    const muallimId = req.user!.userId;
    const displayName = String((req.body?.displayName ?? "")).trim();

    if (!displayName) {
      res.status(400).json({ error: "Ime roditelja je obavezno" });
      return;
    }

    const profil = await getManageableUcenikProfile(muallimId, ucenikId);
    if (!profil) { res.status(404).json({ error: "Učenik nije pronađen" }); return; }

    // Pravilo je 1 učenik = 1 odobren roditelj — provjeri prije kreiranja
    // korisnika, da ne ostane siroče roditeljski nalog/profil.
    const approvedVeze2 = await db.select({ id: roditeljUcenikTable.id })
      .from(roditeljUcenikTable)
      .where(and(eq(roditeljUcenikTable.ucenikId, ucenikId), eq(roditeljUcenikTable.status, "approved")));
    if (approvedVeze2.length >= 1) {
      res.status(409).json({ error: oneApprovedRoditeljError });
      return;
    }

    // Pokušaj iskoristiti isti 4-cifreni sufiks kao učenik (npr. amir.4567 →
    // ismet.4567 / Mekteb4567). Ako sufiks bude zauzet ili učenikov username
    // nije u tom formatu, padamo na nasumičan sufiks — ali lozinku uvijek
    // vežemo za STVARNI sufiks koji je završio u bazi (Mekteb<suffix>).
    const [ucenikRow] = await db.select({ username: usersTable.username })
      .from(usersTable).where(eq(usersTable.id, ucenikId));
    const suffixMatch = ucenikRow?.username?.match(/\.(\d{4})$/);
    const preferredSuffix = suffixMatch ? parseInt(suffixMatch[1], 10) : null;

    let createdRoditelj: NewUserRow | null = null;
    let finalPassword = "";
    let lastErr: any = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const suffix = attempt === 0 && preferredSuffix !== null ? preferredSuffix : randomSuffix();
      const password = `Mekteb${suffix}`;
      const hash = await bcrypt.hash(password, 10);

      try {
        createdRoditelj = await db.transaction(async (tx) => {
          const newRoditelj = await tryInsertUser(tx, displayName, hash, displayName, "roditelj", suffix);
          await tx.insert(roditeljProfiliTable).values({ userId: newRoditelj.id });
          await tx.insert(roditeljUcenikTable).values({
            roditeljId: newRoditelj.id,
            ucenikId,
            status: "approved",
            approvedAt: new Date(),
            approvedBy: muallimId,
          });
          return newRoditelj;
        });
        finalPassword = password;
        break;
      } catch (err: any) {
        lastErr = err;
        if (isOneApprovedRoditeljViolation(err)) throw err;
        if (!isUniqueViolation(err)) throw err;
      }
    }

    if (!createdRoditelj) {
      throw lastErr ?? new Error("USERNAME_COLLISION");
    }

    res.status(201).json({
      id: createdRoditelj.id,
      displayName: createdRoditelj.displayName,
      username: createdRoditelj.username,
      generatedPassword: finalPassword,
    });
  } catch (err: any) {
    console.error("[POST /muallim/ucenici/:id/roditelj]", err);
    if (isOneApprovedRoditeljViolation(err)) {
      res.status(409).json({ error: oneApprovedRoditeljError });
      return;
    }
    if (err?.message === "USERNAME_COLLISION") {
      res.status(409).json({ error: "Nije moguće generisati jedinstveno korisničko ime — pokušajte ponovo" });
      return;
    }
    res.status(500).json({ error: "Greška servera" });
  }
});

// DELETE /api/muallim/ucenici/:ucenikId/roditelji/:roditeljId
// Razvezuje (uklanja) vezu između rodatelja i učenika. NE briše roditeljski nalog.
// Muallim mora biti vlasnik učenika (ili glavni muallim džemata).
router.delete("/ucenici/:ucenikId/roditelji/:roditeljId", async (req, res) => {
  try {
    const ucenikId = parseInt(req.params.ucenikId);
    const roditeljId = parseInt(req.params.roditeljId);
    const muallimId = req.user!.userId;

    const profil = await getManageableUcenikProfile(muallimId, ucenikId);
    if (!profil) { res.status(404).json({ error: "Učenik nije pronađen" }); return; }

    const result = await db.delete(roditeljUcenikTable)
      .where(and(
        eq(roditeljUcenikTable.ucenikId, ucenikId),
        eq(roditeljUcenikTable.roditeljId, roditeljId),
      ));

    res.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /muallim/ucenici/:ucenikId/roditelji/:roditeljId]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});


// PUT /api/muallim/ucenici/:id/grupa - prebaci učenika u drugu grupu.
// Obični muallim: samo vlastiti učenici, vlastite grupe.
// Glavni muallim: svi učenici džemata, sve grupe džemata.
//   Kad se učenik prebacuje u grupu drugog muallima, vlasništvo se prenosi
//   (muallimId, mektebId) i licence se usklađuju (stari -1, novi +1).
router.put("/ucenici/:id/grupa", async (req, res) => {
  try {
    const ucenikId = parseInt(req.params.id);
    const userId = req.user!.userId;
    const isAdmin = req.user!.role === "admin";
    const { grupaId } = req.body as { grupaId?: number | null };
    const ctx = await getMektebCtx(userId);

    // Provjeri pristup grupi (ako je navedena)
    if (grupaId) {
      const err = await validateTargetGrupa(
        parseInt(String(grupaId)), userId, isAdmin,
        ctx?.mektebId ? { mektebId: ctx.mektebId, isGlavni: ctx.isGlavni } : null,
      );
      if (err) { res.status(err.status).json({ error: err.error }); return; }
    }

    // Provjeri pristup učeniku
    const [profil] = await db.select().from(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, ucenikId));
    if (!profil) { res.status(404).json({ error: "Učenik nije pronađen" }); return; }

    const isOwner = profil.muallimId === userId;
    // profil.mektebId može biti NULL za starije učenike → provjeri i kroz muallimov profil
    let isGlavniInSameMekteb = !!(ctx?.isGlavni && ctx.mektebId && profil.mektebId === ctx.mektebId);
    if (!isGlavniInSameMekteb && ctx?.isGlavni && ctx.mektebId) {
      const check = await db.execute(sql`
        SELECT 1 FROM ucenik_profili up
        JOIN muallim_profili mp ON mp.user_id = up.muallim_id
        WHERE up.user_id = ${ucenikId} AND mp.mekteb_id = ${ctx.mektebId}
        LIMIT 1
      `);
      isGlavniInSameMekteb = check.rows.length > 0;
    }
    if (!isAdmin && !isOwner && !isGlavniInSameMekteb) {
      res.status(403).json({ error: "Učenik ne pripada vama" }); return;
    }

    // Ako je ciljni grupaId u grupi drugog muallima → prenesi vlasništvo
    let noviMuallimId = profil.muallimId;
    let noviMektebId = profil.mektebId;
    if (grupaId) {
      const ciljnaGrupa = await db.execute(sql`
        SELECT muallim_id, mp.mekteb_id as mekteb_id
        FROM grupe g
        LEFT JOIN muallim_profili mp ON mp.user_id = g.muallim_id
        WHERE g.id = ${grupaId}
      `);
      const cg = ciljnaGrupa.rows[0] as { muallim_id: number; mekteb_id: number | null } | undefined;
      if (cg && cg.muallim_id !== profil.muallimId) {
        noviMuallimId = cg.muallim_id;
        noviMektebId = cg.mekteb_id ?? profil.mektebId;
      }
    }

    const transferVlasnistva = noviMuallimId !== profil.muallimId;

    if (transferVlasnistva) {
      await db.transaction(async (tx) => {
        // Ažuriraj profil učenika: grupaId + muallimId + mektebId
        await tx.update(ucenikProfiliTable)
          .set({ grupaId: grupaId || null, muallimId: noviMuallimId, mektebId: noviMektebId })
          .where(eq(ucenikProfiliTable.userId, ucenikId));

        // Uskladi licence: stari muallim –1 (ne ispod 0), novi muallim +1
        const staroMuallimId = profil.muallimId;
        if (staroMuallimId) {
          await tx.execute(sql`
            UPDATE muallim_profili SET licences_used = GREATEST(0, licences_used - 1)
            WHERE user_id = ${staroMuallimId}
          `);
        }
        await tx.execute(sql`
          UPDATE muallim_profili SET licences_used = licences_used + 1
          WHERE user_id = ${noviMuallimId}
        `);
      });
      res.json({ success: true, transferred: true });
    } else {
      const [updated] = await db.update(ucenikProfiliTable)
        .set({ grupaId: grupaId || null })
        .where(eq(ucenikProfiliTable.userId, ucenikId))
        .returning();
      res.json(updated);
    }
  } catch (err) {
    console.error("[PUT /muallim/ucenici/:id/grupa]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// DELETE /api/muallim/ucenici/:id - archive (free licence slot)
router.delete("/ucenici/:id", async (req, res) => {
  try {
    const ucenikId = parseInt(req.params.id);
    await db.update(ucenikProfiliTable)
      .set({ isArchived: true, archivedAt: new Date() })
      .where(and(eq(ucenikProfiliTable.userId, ucenikId), eq(ucenikProfiliTable.muallimId, req.user!.userId)));

    const [profil] = await db.select().from(muallimProfiliTable).where(eq(muallimProfiliTable.userId, req.user!.userId));
    if (profil && profil.licencesUsed > 0) {
      await db.update(muallimProfiliTable)
        .set({ licencesUsed: profil.licencesUsed - 1 })
        .where(eq(muallimProfiliTable.userId, req.user!.userId));
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/prisustvo - save attendance for a date
router.post("/prisustvo", async (req, res) => {
  try {
    const { grupaId, datum, prisustvo } = req.body;
    // prisustvo: [{ ucenikId, status, napomena }]

    for (const p of prisustvo) {
      const newStatus = p.status || "prisutan";

      // Upsert
      const existing = await db.select().from(priustvoTable)
        .where(and(eq(priustvoTable.ucenikId, p.ucenikId), eq(priustvoTable.datum, datum)));

      if (existing.length > 0) {
        const prev = existing[0];
        await db.update(priustvoTable)
          .set({ status: newStatus, napomena: p.napomena })
          .where(eq(priustvoTable.id, prev.id));
      } else {
        await db.insert(priustvoTable).values({
          ucenikId: p.ucenikId,
          grupaId,
          muallimId: req.user!.userId,
          datum,
          status: newStatus,
          napomena: p.napomena || null,
        });
      }
    }

    // Prisustvo NE generiše obavijesti roditeljima (po zahtjevu korisnika) — samo evidencija.
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/prisustvo?grupaId=X&datum=YYYY-MM-DD
router.get("/prisustvo", async (req, res) => {
  try {
    const grupaId = parseInt(req.query.grupaId as string);
    const datum = req.query.datum as string;
    const where = datum
      ? and(eq(priustvoTable.grupaId, grupaId), eq(priustvoTable.datum, datum))
      : eq(priustvoTable.grupaId, grupaId);
    const records = await db.select().from(priustvoTable).where(where);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/ocjene - add grade
router.post("/ocjene", async (req, res) => {
  try {
    const { ucenikId, grupaId, kategorija, ocjena, lekcijaNaziv, lekcijaSlug, napomena, datum, napametStavkaId } = req.body;
    const automatskaStavka = lekcijaSlug
      ? (await getGlobalNapametKatalog(false)).find((item) => item.sourceLessonSlug === String(lekcijaSlug))
      : undefined;
    // Ručni izbor ima prednost (npr. muallim želi ocijeniti drugu stavku uz
    // lekciju), a bez njega povezani slug automatski aktivira NAPAMET.
    const effectiveNapametStavkaId = napametStavkaId || automatskaStavka?.id;
    const isNapamet = Boolean(effectiveNapametStavkaId);
    const ctx = await getMektebCtx(req.user!.userId);
    if (isNapamet && (!ucenikId || !grupaId)) {
      res.status(400).json({ error: "NAPAMET ocjena mora pripadati grupi" });
      return;
    }
    if (grupaId) {
      const grupa = await verifyGrupaAccess(Number(grupaId), req.user!.userId, req.user!.role);
      if (!grupa) { res.status(403).json({ error: "Nemate pristup ovoj grupi" }); return; }
    }
    const program = isNapamet ? await getNapametKatalog({
      mektebId: ctx?.mektebId,
      grupaId: Number(grupaId),
      muallimId: req.user!.userId,
      includeHidden: true,
    }) : [];
    const stavka = isNapamet ? program.find(item => item.id === String(effectiveNapametStavkaId)) : undefined;
    if (isNapamet && (!stavka || stavka.isVisible === false)) {
      res.status(400).json({ error: "Neispravna NAPAMET stavka" });
      return;
    }
    if (isNapamet) {
      const [profilUcenika] = await db.select({ grupaId: ucenikProfiliTable.grupaId })
        .from(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, Number(ucenikId)));
      if (!profilUcenika || profilUcenika.grupaId !== Number(grupaId)) {
        res.status(403).json({ error: "Učenik ne pripada ovoj grupi" });
        return;
      }
    }
    const result = await db.transaction(async (tx) => {
      // Stari ručni NAPAMET unos bez odabrane lekcije ostaje jedan NAPAMET
      // zapis. Par nastaje samo kada konkretni slug lekcije aktivira vezu.
      if (!lekcijaSlug && stavka) {
        const [napametOcjena] = await tx.insert(ocjeneTable).values({
          ucenikId,
          muallimId: req.user!.userId,
          grupaId,
          kategorija: "napamet",
          ocjena,
          lekcijaNaziv: lekcijaNaziv || null,
          napomena,
          datum,
          napametNivo: stavka.nivo,
          napametStavkaId: stavka.id,
        }).returning();
        return napametOcjena;
      }
      const [nova] = await tx.insert(ocjeneTable).values({
        ucenikId,
        muallimId: req.user!.userId,
        grupaId,
        kategorija,
        ocjena,
        lekcijaNaziv: lekcijaNaziv || null,
        napomena,
        datum,
        napametNivo: null,
        napametStavkaId: null,
      }).returning();
      if (stavka) {
        await tx.insert(ocjeneTable).values({
          ucenikId,
          muallimId: req.user!.userId,
          grupaId,
          kategorija: "napamet",
          ocjena,
          lekcijaNaziv: null,
          napomena,
          datum,
          napametNivo: stavka.nivo,
          napametStavkaId: stavka.id,
        });
      }
      return nova;
    });
    res.status(201).json(result);

    // Notifikacija roditeljima — ne blokira odgovor
    (async () => {
      const [ucenik] = await db
        .select({ displayName: usersTable.displayName })
        .from(usersTable)
        .where(eq(usersTable.id, ucenikId));
      const ime = ucenik?.displayName || "vaše dijete";
      const naslov = `Nova ocjena za ${ime}`;
      const sadrzaj = `Vaše dijete ${ime} je dobilo novu ocjenu (${ocjena}) iz ${kategorija}.`;
      await notifyApprovedRoditelji({
        ucenikId,
        posiljateljId: req.user!.userId,
        naslov,
        sadrzaj,
        logTag: "ocjene-notify",
        pushData: { type: "ocjena" },
      });
    })().catch(err => console.error("[ocjene-notify] background notify failed", err));
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// Globalni katalog + lokalne stavke prijavljenog muallima za konkretnu grupu.
router.get("/napamet-program", async (req, res) => {
  try {
    const ctx = await getMektebCtx(req.user!.userId);
    if (!ctx?.mektebId) { res.status(403).json({ error: "Muallim nije vezan za mekteb" }); return; }
    const grupaId = Number(req.query.grupaId);
    if (grupaId && !(await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role))) {
      res.status(403).json({ error: "Nemate pristup ovoj grupi" }); return;
    }
    const katalog = await getNapametKatalog({
      mektebId: ctx.mektebId,
      grupaId: grupaId || undefined,
      muallimId: grupaId ? req.user!.userId : undefined,
      includeHidden: true,
    });
    if (grupaId) {
      const activeProfiles = await db.select({ userId: ucenikProfiliTable.userId })
        .from(ucenikProfiliTable)
        .innerJoin(usersTable, eq(usersTable.id, ucenikProfiliTable.userId))
        .where(and(
          eq(ucenikProfiliTable.grupaId, grupaId),
          eq(ucenikProfiliTable.isArchived, false),
          eq(usersTable.isActive, true),
        ));
      const studentIds = [...new Set(activeProfiles.map((profile) => profile.userId))];
      const grades = studentIds.length
        ? await db.select({
            ucenikId: ocjeneTable.ucenikId,
            napametStavkaId: ocjeneTable.napametStavkaId,
            datum: ocjeneTable.datum,
            id: ocjeneTable.id,
          }).from(ocjeneTable).where(and(
            inArray(ocjeneTable.ucenikId, studentIds),
            sql`${ocjeneTable.napametStavkaId} IS NOT NULL`,
          )).orderBy(desc(ocjeneTable.datum), desc(ocjeneTable.id))
        : [];
      const latestByStudentAndItem = new Set<string>();
      const assessedByItem = new Map<string, number>();
      for (const grade of grades) {
        const key = `${grade.ucenikId}:${grade.napametStavkaId}`;
        if (latestByStudentAndItem.has(key) || !grade.napametStavkaId) continue;
        latestByStudentAndItem.add(key);
        assessedByItem.set(grade.napametStavkaId, (assessedByItem.get(grade.napametStavkaId) ?? 0) + 1);
      }
      res.json({
        katalog: katalog.map((item) => ({
          ...item,
          ukupnoUcenika: studentIds.length,
          ocijenjenoUcenika: assessedByItem.get(item.id) ?? 0,
        })),
      });
      return;
    }
    res.json({ katalog });
  } catch { res.status(500).json({ error: "Greška servera" }); }
});

router.get("/napamet-program/:stavkaId/detalji", async (req, res) => {
  try {
    const ctx = await getMektebCtx(req.user!.userId);
    const grupaId = Number(req.query.grupaId);
    const stavkaId = String(req.params.stavkaId || "");
    if (!ctx?.mektebId || !grupaId || !stavkaId || !(await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role))) {
      res.status(403).json({ error: "Nemate pristup ovoj grupi" }); return;
    }
    const item = (await getNapametKatalog({
      mektebId: ctx.mektebId,
      grupaId,
      muallimId: req.user!.userId,
      includeHidden: true,
    })).find((candidate) => candidate.id === stavkaId);
    if (!item) { res.status(404).json({ error: "NAPAMET stavka nije pronađena" }); return; }

    const students = await db.select({
      id: usersTable.id,
      displayName: usersTable.displayName,
    }).from(ucenikProfiliTable)
      .innerJoin(usersTable, eq(usersTable.id, ucenikProfiliTable.userId))
      .where(and(
        eq(ucenikProfiliTable.grupaId, grupaId),
        eq(ucenikProfiliTable.isArchived, false),
        eq(usersTable.isActive, true),
      ));
    const studentIds = [...new Set(students.map((student) => student.id))];
    const grades = studentIds.length ? await db.select({
      ucenikId: ocjeneTable.ucenikId,
      ocjena: ocjeneTable.ocjena,
      datum: ocjeneTable.datum,
      id: ocjeneTable.id,
    }).from(ocjeneTable).where(and(
      inArray(ocjeneTable.ucenikId, studentIds),
      eq(ocjeneTable.napametStavkaId, stavkaId),
    )).orderBy(desc(ocjeneTable.datum), desc(ocjeneTable.id)) : [];
    const latest = new Map<number, typeof grades[number]>();
    for (const grade of grades) if (!latest.has(grade.ucenikId)) latest.set(grade.ucenikId, grade);
    const assessed = students.filter((student) => latest.has(student.id)).map((student) => {
      const grade = latest.get(student.id)!;
      return { id: student.id, displayName: student.displayName, ocjena: grade.ocjena, datum: grade.datum };
    });
    const unassessed = students.filter((student) => !latest.has(student.id));
    res.json({
      stavka: { id: item.id, naziv: item.naziv, nivo: item.nivo, scope: item.scope },
      ocijenjeni: assessed,
      nisuOcijenjeni: unassessed,
    });
  } catch { res.status(500).json({ error: "Greška servera" }); }
});

router.get("/napamet-lokalno", async (req, res) => {
  try {
    const ctx = await getMektebCtx(req.user!.userId);
    const grupaId = Number(req.query.grupaId);
    if (!ctx?.mektebId || !grupaId || !(await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role))) {
      res.status(403).json({ error: "Nemate pristup ovoj grupi" }); return;
    }
    const katalog = await getNapametKatalog({ grupaId, muallimId: req.user!.userId, includeHidden: true });
    const activeProfiles = await db.select({ userId: ucenikProfiliTable.userId })
      .from(ucenikProfiliTable)
      .innerJoin(usersTable, eq(usersTable.id, ucenikProfiliTable.userId))
      .where(and(
        eq(ucenikProfiliTable.grupaId, grupaId),
        eq(ucenikProfiliTable.isArchived, false),
        eq(usersTable.isActive, true),
      ));
    const studentIds = [...new Set(activeProfiles.map((profile) => profile.userId))];
    const grades = studentIds.length
      ? await db.select({
          ucenikId: ocjeneTable.ucenikId,
          napametStavkaId: ocjeneTable.napametStavkaId,
          datum: ocjeneTable.datum,
          id: ocjeneTable.id,
        }).from(ocjeneTable).where(and(
          inArray(ocjeneTable.ucenikId, studentIds),
          sql`${ocjeneTable.napametStavkaId} IS NOT NULL`,
        )).orderBy(desc(ocjeneTable.datum), desc(ocjeneTable.id))
      : [];
    const seen = new Set<string>();
    const assessedByItem = new Map<string, number>();
    for (const grade of grades) {
      const key = `${grade.ucenikId}:${grade.napametStavkaId}`;
      if (seen.has(key) || !grade.napametStavkaId) continue;
      seen.add(key);
      assessedByItem.set(grade.napametStavkaId, (assessedByItem.get(grade.napametStavkaId) ?? 0) + 1);
    }
    res.json({ katalog: katalog.filter((item) => item.scope === "lokalno").map((item) => ({
      ...item, ukupnoUcenika: studentIds.length, ocijenjenoUcenika: assessedByItem.get(item.id) ?? 0,
    })) });
  } catch { res.status(500).json({ error: "Greška servera" }); }
});

router.post("/napamet-lokalno", async (req, res) => {
  try {
    const grupaId = Number(req.body.grupaId);
    if (!grupaId || !(await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role))) {
      res.status(403).json({ error: "Nemate pristup ovoj grupi" }); return;
    }
    const naziv = String(req.body.naziv || "").trim();
    const nivo = Number(req.body.nivo);
    if (!naziv || naziv.length > 200 || ![1, 2, 3, 4].includes(nivo)) { res.status(400).json({ error: "Naziv i nivo nisu ispravni" }); return; }
    const stavkaId = `lokalno-${req.user!.userId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const [row] = await db.insert(napametMuallimProgramTable).values({
      muallimId: req.user!.userId, grupaId, stavkaId, nivo, naziv,
      redoslijed: Number(req.body.redoslijed) || 9999,
    }).returning();
    res.status(201).json({ id: row.stavkaId, nivo: row.nivo, naziv: row.naziv, redoslijed: row.redoslijed, isVisible: row.isVisible, scope: "lokalno" });
  } catch { res.status(500).json({ error: "Greška servera" }); }
});

router.put("/napamet-lokalno/:stavkaId", async (req, res) => {
  try {
    const grupaId = Number(req.query.grupaId);
    if (!grupaId || !(await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role))) {
      res.status(403).json({ error: "Nemate pristup ovoj grupi" }); return;
    }
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (req.body.naziv !== undefined) {
      const naziv = String(req.body.naziv).trim();
      if (!naziv || naziv.length > 200) { res.status(400).json({ error: "Naziv nije ispravan" }); return; }
      values.naziv = naziv;
    }
    if (req.body.nivo !== undefined) {
      const nivo = Number(req.body.nivo);
      if (![1, 2, 3, 4].includes(nivo)) { res.status(400).json({ error: "Nivo nije ispravan" }); return; }
      values.nivo = nivo;
    }
    if (req.body.isVisible !== undefined) values.isVisible = Boolean(req.body.isVisible);
    const [row] = await db.update(napametMuallimProgramTable).set(values)
      .where(and(
        eq(napametMuallimProgramTable.grupaId, grupaId),
        eq(napametMuallimProgramTable.muallimId, req.user!.userId),
        eq(napametMuallimProgramTable.stavkaId, req.params.stavkaId),
      )).returning();
    if (!row) { res.status(404).json({ error: "Stavka nije pronađena" }); return; }
    res.json({ id: row.stavkaId, nivo: row.nivo, naziv: row.naziv, redoslijed: row.redoslijed, isVisible: row.isVisible, scope: "lokalno" });
  } catch { res.status(500).json({ error: "Greška servera" }); }
});

router.put("/napamet-lokalno-redoslijed", async (req, res) => {
  try {
    const grupaId = Number(req.body.grupaId);
    if (!grupaId || !(await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role))) {
      res.status(403).json({ error: "Nemate pristup ovoj grupi" }); return;
    }
    const stavke = Array.isArray(req.body.stavke) ? req.body.stavke : [];
    for (const item of stavke) {
      const nivo = Number(item.nivo);
      if (![1, 2, 3, 4].includes(nivo)) continue;
      await db.update(napametMuallimProgramTable).set({ nivo, redoslijed: Number(item.redoslijed), updatedAt: new Date() })
        .where(and(
          eq(napametMuallimProgramTable.grupaId, grupaId),
          eq(napametMuallimProgramTable.muallimId, req.user!.userId),
          eq(napametMuallimProgramTable.stavkaId, String(item.id)),
        ));
    }
    const katalog = await getNapametKatalog({ grupaId, muallimId: req.user!.userId, includeHidden: true });
    res.json({ success: true, katalog: katalog.filter((item) => item.scope === "lokalno") });
  } catch { res.status(500).json({ error: "Greška servera" }); }
});

// GET /api/muallim/napamet/:ucenikId — shared mekteb catalogue + this student's grades.
// A teacher can only view students in a group they can already access.
router.get("/napamet/:ucenikId", async (req, res) => {
  try {
    const ucenikId = parseInt(req.params.ucenikId);
    const ctx = await getMektebCtx(req.user!.userId);
    if (!ctx?.mektebId) { res.status(403).json({ error: "Muallim nije vezan za mekteb" }); return; }
    const [profilUcenika] = await db.select({
      grupaId: ucenikProfiliTable.grupaId,
      mektebId: ucenikProfiliTable.mektebId,
    }).from(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, ucenikId));
    if (!profilUcenika || !profilUcenika.grupaId) {
      res.status(403).json({ error: "Nemate pristup ovom učeniku" }); return;
    }
    const grupa = await verifyGrupaAccess(profilUcenika.grupaId, req.user!.userId, req.user!.role);
    if (!grupa) { res.status(403).json({ error: "Nemate pristup ovoj grupi" }); return; }
    const ocjene = await db.select().from(ocjeneTable).where(and(
      eq(ocjeneTable.ucenikId, ucenikId),
      sql`${ocjeneTable.napametStavkaId} IS NOT NULL`,
    )).orderBy(desc(ocjeneTable.datum), desc(ocjeneTable.id));
    const latest = new Map<string, typeof ocjene[number]>();
    for (const o of ocjene) if (o.napametStavkaId && !latest.has(o.napametStavkaId)) latest.set(o.napametStavkaId, o);
    res.json({ katalog: await getNapametKatalog({
      mektebId: ctx.mektebId,
      grupaId: profilUcenika.grupaId,
    }), ocjene: [...latest.values()] });
  } catch { res.status(500).json({ error: "Greška servera" }); }
});

// GET /api/muallim/ocjene/:ucenikId
router.get("/ocjene/:ucenikId", async (req, res) => {
  try {
    const ocjene = await db.select().from(ocjeneTable)
      .where(and(eq(ocjeneTable.ucenikId, parseInt(req.params.ucenikId)), eq(ocjeneTable.muallimId, req.user!.userId)));
    res.json(ocjene);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/prisustvo-ucenik/:ucenikId - all attendance for one student
router.get("/prisustvo-ucenik/:ucenikId", async (req, res) => {
  try {
    const ucenikId = parseInt(req.params.ucenikId);
    const records = await db.select().from(priustvoTable)
      .where(and(eq(priustvoTable.ucenikId, ucenikId), eq(priustvoTable.muallimId, req.user!.userId)));
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/approve-roditelj - approve parent-child link
router.post("/approve-roditelj", async (req, res) => {
  try {
    const { roditeljUcenikId, approved } = req.body;

    const [request] = await db.select().from(roditeljUcenikTable)
      .where(and(eq(roditeljUcenikTable.id, roditeljUcenikId), eq(roditeljUcenikTable.status, "pending")));
    if (!request) { res.status(404).json({ error: "Zahtjev nije pronađen" }); return; }

    const profili = await db.select().from(ucenikProfiliTable)
      .where(and(eq(ucenikProfiliTable.userId, request.ucenikId), eq(ucenikProfiliTable.muallimId, req.user!.userId)));
    if (profili.length === 0) { res.status(403).json({ error: "Učenik nije vaš" }); return; }

    // Model 1 učenik = 1 roditelj (licence): ne dozvoli odobravanje drugog
    // roditelja za učenika koji već ima odobrenog (odbijanje je i dalje OK).
    if (approved) {
      const [vecImaRoditelja] = await db.select().from(roditeljUcenikTable)
        .where(and(
          eq(roditeljUcenikTable.ucenikId, request.ucenikId),
          eq(roditeljUcenikTable.status, "approved"),
        ));
      if (vecImaRoditelja && vecImaRoditelja.roditeljId !== request.roditeljId) {
        res.status(409).json({ error: oneApprovedRoditeljError });
        return;
      }
    }

    await db.update(roditeljUcenikTable)
      .set({
        status: approved ? "approved" : "rejected",
        approvedAt: new Date(),
        approvedBy: req.user!.userId,
      })
      .where(eq(roditeljUcenikTable.id, roditeljUcenikId));

    // Pošalji notifikaciju roditelju (samo in-app poruka — email se NE šalje)
    const logCtx = { roditeljUcenikId, roditeljId: request.roditeljId, ucenikId: request.ucenikId, approved };
    let usersInfo: { id: number; displayName: string }[] = [];
    try {
      usersInfo = await db
        .select({ id: usersTable.id, displayName: usersTable.displayName })
        .from(usersTable)
        .where(inArray(usersTable.id, [request.ucenikId, req.user!.userId]));
    } catch (lookupErr) {
      console.error("[approve-roditelj] User lookup failed", logCtx, lookupErr);
    }

    const userMap = Object.fromEntries(usersInfo.map(u => [u.id, u]));
    const ucenikIme = userMap[request.ucenikId]?.displayName || "vaše dijete";
    const muallimIme = userMap[req.user!.userId]?.displayName || "Muallim";

    const naslov = approved
      ? `Zahtjev za ${ucenikIme} je odobren`
      : `Zahtjev za ${ucenikIme} je odbijen`;
    const sadrzaj = approved
      ? `Vaš zahtjev za povezivanje s djetetom ${ucenikIme} je odobren. Sada možete pratiti napredak svog djeteta u roditeljskom portalu.`
      : `Vaš zahtjev za povezivanje s djetetom ${ucenikIme} je odbijen. Za više informacija obratite se muallimu (${muallimIme}).`;

    // In-app poruka — jedini kanal notifikacije
    let notificationDelivered = true;
    try {
      await db.insert(porukeTable).values({
        posiljateljId: req.user!.userId,
        primateljId: request.roditeljId,
        naslov,
        sadrzaj,
      });
    } catch (porukaErr) {
      notificationDelivered = false;
      console.error("[approve-roditelj] In-app poruka insert failed", logCtx, porukaErr);
    }

    res.json({ success: true, notificationDelivered });
  } catch (err) {
    if (isOneApprovedRoditeljViolation(err)) {
      res.status(409).json({ error: oneApprovedRoditeljError });
      return;
    }
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/pending-roditelji - pending parent link requests with names
router.get("/pending-roditelji", async (req, res) => {
  try {
    const profili = await db.select().from(ucenikProfiliTable).where(eq(ucenikProfiliTable.muallimId, req.user!.userId));
    if (profili.length === 0) { res.json([]); return; }
    const ucenikIds = profili.map(p => p.userId);
    const pending = await db.select().from(roditeljUcenikTable)
      .where(and(inArray(roditeljUcenikTable.ucenikId, ucenikIds), eq(roditeljUcenikTable.status, "pending")));

    if (pending.length === 0) { res.json([]); return; }

    const allUserIds = [...new Set(pending.flatMap(p => [p.roditeljId, p.ucenikId]))];
    const users = await db.select({ id: usersTable.id, displayName: usersTable.displayName, username: usersTable.username })
      .from(usersTable).where(inArray(usersTable.id, allUserIds));
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    const enriched = pending.map(p => ({
      ...p,
      roditelj: userMap[p.roditeljId] || { displayName: "Nepoznat", username: "" },
      ucenik: userMap[p.ucenikId] || { displayName: "Nepoznat", username: "" },
    }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/ucenik-rezultati/:id - quiz results for specific student
router.get("/ucenik-rezultati/:id", async (req, res) => {
  try {
    const muallimId = req.user!.userId;
    const ucenikId = parseInt(req.params.id);

    if (req.user!.role !== "admin") {
      const profili = await db.select().from(ucenikProfiliTable)
        .where(and(
          eq(ucenikProfiliTable.userId, ucenikId),
          eq(ucenikProfiliTable.muallimId, muallimId),
        ));
      if (profili.length === 0) {
        res.status(403).json({ error: "Učenik nije vaš" });
        return;
      }
    }

    const rezultati = await db.select().from(kvizRezultatiTable)
      .where(eq(kvizRezultatiTable.userId, ucenikId))
      .orderBy(desc(kvizRezultatiTable.completedAt));

    const napredak = await db.select().from(korisnikNapredakTable)
      .where(eq(korisnikNapredakTable.userId, ucenikId));

    res.json({ rezultati, napredak });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/svi-rezultati - all students' quiz results
router.get("/svi-rezultati", async (req, res) => {
  try {
    const muallimId = req.user!.userId;

    const profili = await db.select({ userId: ucenikProfiliTable.userId })
      .from(ucenikProfiliTable)
      .where(eq(ucenikProfiliTable.muallimId, muallimId));

    if (profili.length === 0) { res.json([]); return; }
    const ucenikIds = profili.map(p => p.userId);

    const rezultati = await db.select({
      id: kvizRezultatiTable.id,
      userId: kvizRezultatiTable.userId,
      kvizNaslov: kvizRezultatiTable.kvizNaslov,
      tacniOdgovori: kvizRezultatiTable.tacniOdgovori,
      ukupnoPitanja: kvizRezultatiTable.ukupnoPitanja,
      procenat: kvizRezultatiTable.procenat,
      bodovi: kvizRezultatiTable.bodovi,
      completedAt: kvizRezultatiTable.completedAt,
      displayName: usersTable.displayName,
      username: usersTable.username,
    }).from(kvizRezultatiTable)
      .leftJoin(usersTable, eq(kvizRezultatiTable.userId, usersTable.id))
      .where(inArray(kvizRezultatiTable.userId, ucenikIds))
      .orderBy(desc(kvizRezultatiTable.completedAt))
      .limit(100);

    res.json(rezultati);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// ── KALENDAR ───────────────────────────────────────────────────────────────────

// Helper: verify group ownership (muallim owns the group, admin, glavni muallim, or secondary muallim)
async function verifyGrupaAccess(grupaId: number, userId: number, userRole: string) {
  if (userRole === "admin") {
    const [grupa] = await db.select().from(grupeTable).where(and(
      eq(grupeTable.id, grupaId),
      sql`COALESCE(is_archived, false) = false`,
      sql`COALESCE(is_active, true) = true`,
    ));
    return grupa || null;
  }
  // Owner?
  const [grupaOwned] = await db.select().from(grupeTable)
    .where(and(
      eq(grupeTable.id, grupaId),
      eq(grupeTable.muallimId, userId),
      sql`COALESCE(is_archived, false) = false`,
        sql`COALESCE(is_active, true) = true`,
    ));
  if (grupaOwned) return grupaOwned;
  // Glavni muallim — može pristupiti svim grupama svog džemata
  const ctx = await getMektebCtx(userId);
  if (ctx?.isGlavni && ctx.mektebId) {
    const rows = await db.execute(sql`
      SELECT g.* FROM grupe g
      JOIN muallim_profili mp ON mp.user_id = g.muallim_id
       WHERE g.id = ${grupaId}
         AND mp.mekteb_id = ${ctx.mektebId}
         AND COALESCE(g.is_archived, false) = false
         AND COALESCE(g.is_active, true) = true
    `);
    return (rows.rows[0] as typeof grupaOwned) || null;
  }
  // Sekundarni muallim — dodijeljen grupi ali nije primarni vlasnik
  const secRow = await db.execute(sql`
    SELECT g.* FROM grupe g
    JOIN grupa_muallimi gm ON gm.grupa_id = g.id
     WHERE g.id = ${grupaId}
       AND gm.muallim_id = ${userId}
       AND COALESCE(g.is_archived, false) = false
       AND COALESCE(g.is_active, true) = true
    LIMIT 1
  `);
  return (secRow.rows[0] as typeof grupaOwned) || null;
}

// ── PER-GRUPA RASPORED LEKCIJA ──────────────────────────────────────────────
// Muallim slaže vlastiti redoslijed lekcija za svoju grupu (po nivou). Ako
// grupa nema raspored, student ide po globalnom `ilmihal_lekcije.redoslijed`
// (default). Medaljon-lekcije (redoslijed >= 9000) se NE uključuju.

// GET /api/muallim/grupa/:id/raspored?nivo=1
router.get("/grupa/:id/raspored", async (req, res) => {
  try {
    const grupaId = parseInt(req.params.id);
    const nivo = parseInt(req.query.nivo as string);
    if (!grupaId || !nivo || nivo < 1 || nivo > 3) {
      res.status(400).json({ error: "grupaId i nivo (1-3) su obavezni" }); return;
    }
    const grupa = await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role);
    if (!grupa) { res.status(403).json({ error: "Nije vaša grupa" }); return; }

    const lekcije = await db
      .select({
        id: ilmihalLekcijeTable.id,
        slug: ilmihalLekcijeTable.slug,
        naslov: ilmihalLekcijeTable.naslov,
        redoslijed: ilmihalLekcijeTable.redoslijed,
      })
      .from(ilmihalLekcijeTable)
      .where(and(eq(ilmihalLekcijeTable.nivo, nivo), sql`${ilmihalLekcijeTable.redoslijed} < 9000`))
      .orderBy(asc(ilmihalLekcijeTable.redoslijed));

    const posMap = await getRasporedPositions(grupaId, nivo);
    const eff = resolveEffectiveRedoslijed(lekcije, posMap);
    const poredano = [...lekcije].sort((a, b) => eff.get(a.id)! - eff.get(b.id)!);

    res.json({
      grupaId,
      nivo,
      imaRaspored: posMap !== null,
      lekcije: poredano.map((l, i) => ({
        lekcijaId: l.id,
        slug: l.slug,
        naslov: l.naslov,
        globalniRedoslijed: l.redoslijed,
        pozicija: i + 1,
      })),
    });
  } catch (err) {
    console.error("Raspored GET error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/muallim/grupa/:id/raspored  body: { nivo, lekcijaIds: number[] }
router.put("/grupa/:id/raspored", async (req, res) => {
  try {
    const grupaId = parseInt(req.params.id);
    const { nivo, lekcijaIds } = req.body as { nivo?: number; lekcijaIds?: number[] };
    if (!grupaId || !nivo || nivo < 1 || nivo > 3 || !Array.isArray(lekcijaIds) || lekcijaIds.length === 0) {
      res.status(400).json({ error: "grupaId, nivo i lekcijaIds (niz) su obavezni" }); return;
    }
    const grupa = await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role);
    if (!grupa) { res.status(403).json({ error: "Nije vaša grupa" }); return; }

    // Validacija: svi lekcijaIds moraju biti regularne lekcije ovog nivoa.
    const validne = await db
      .select({ id: ilmihalLekcijeTable.id })
      .from(ilmihalLekcijeTable)
      .where(and(eq(ilmihalLekcijeTable.nivo, nivo), sql`${ilmihalLekcijeTable.redoslijed} < 9000`));
    const validSet = new Set(validne.map((l) => l.id));
    const seen = new Set<number>();
    for (const id of lekcijaIds) {
      if (!validSet.has(id)) { res.status(400).json({ error: `Lekcija ${id} ne pripada nivou ${nivo}` }); return; }
      if (seen.has(id)) { res.status(400).json({ error: `Duplikat lekcije ${id}` }); return; }
      seen.add(id);
    }

    await db.transaction(async (tx) => {
      await tx.delete(grupaRasporedTable)
        .where(and(eq(grupaRasporedTable.grupaId, grupaId), eq(grupaRasporedTable.nivo, nivo)));
      await tx.insert(grupaRasporedTable).values(
        lekcijaIds.map((lekcijaId, i) => ({ grupaId, nivo, lekcijaId, pozicija: i + 1 })),
      );
    });
    res.json({ ok: true, grupaId, nivo, broj: lekcijaIds.length });
  } catch (err) {
    console.error("Raspored PUT error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// DELETE /api/muallim/grupa/:id/raspored?nivo=1  → reset na default redoslijed
router.delete("/grupa/:id/raspored", async (req, res) => {
  try {
    const grupaId = parseInt(req.params.id);
    const nivo = parseInt(req.query.nivo as string);
    if (!grupaId || !nivo) { res.status(400).json({ error: "grupaId i nivo su obavezni" }); return; }
    const grupa = await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role);
    if (!grupa) { res.status(403).json({ error: "Nije vaša grupa" }); return; }
    await db.delete(grupaRasporedTable)
      .where(and(eq(grupaRasporedTable.grupaId, grupaId), eq(grupaRasporedTable.nivo, nivo)));
    res.json({ ok: true });
  } catch (err) {
    console.error("Raspored DELETE error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/kalendar?grupaId=X&mjesec=YYYY-MM
router.get("/kalendar", async (req, res) => {
  try {
    const grupaId = parseInt(req.query.grupaId as string);
    if (!grupaId) { res.status(400).json({ error: "grupaId obavezan" }); return; }

    const grupa = await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role);
    if (!grupa) { res.status(403).json({ error: "Nije vaša grupa" }); return; }

    const entries = await db.select().from(mektebKalendarTable)
      .where(eq(mektebKalendarTable.grupaId, grupaId))
      .orderBy(asc(mektebKalendarTable.datum));

    res.json(entries);
  } catch (err) {
    console.error("Kalendar GET error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/kalendar — add/update calendar entry
router.post("/kalendar", async (req, res) => {
  try {
    const { grupaId, datum, tip, opis } = req.body;
    if (!grupaId || !datum || !tip) { res.status(400).json({ error: "grupaId, datum i tip su obavezni" }); return; }
    if (!["mekteb", "ferije", "vazan_datum", "ramazan"].includes(tip)) { res.status(400).json({ error: "tip mora biti: mekteb, ferije, vazan_datum, ramazan" }); return; }

    const grupa = await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role);
    if (!grupa) { res.status(403).json({ error: "Nije vaša grupa" }); return; }

    const existing = await db.select().from(mektebKalendarTable)
      .where(and(eq(mektebKalendarTable.grupaId, grupaId), eq(mektebKalendarTable.datum, datum)));

    if (existing.length > 0) {
      const [updated] = await db.update(mektebKalendarTable)
        .set({ tip, opis: opis || null })
        .where(eq(mektebKalendarTable.id, existing[0].id))
        .returning();
      res.json(updated);
    } else {
      const [nova] = await db.insert(mektebKalendarTable).values({
        grupaId, muallimId: req.user!.userId, datum, tip, opis: opis || null,
      }).returning();
      res.status(201).json(nova);
    }
  } catch (err) {
    console.error("Kalendar POST error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/kalendar/batch — mark multiple dates at once
router.post("/kalendar/batch", async (req, res) => {
  try {
    const { grupaId, datumi, tip, opis } = req.body;
    if (!grupaId || !datumi || !Array.isArray(datumi) || datumi.length === 0 || !tip) {
      res.status(400).json({ error: "grupaId, datumi (niz) i tip su obavezni" }); return;
    }
    if (!["mekteb", "ferije", "vazan_datum", "ramazan"].includes(tip)) {
      res.status(400).json({ error: "tip mora biti: mekteb, ferije, vazan_datum, ramazan" }); return;
    }

    const grupa = await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role);
    if (!grupa) { res.status(403).json({ error: "Nije vaša grupa" }); return; }

    const results: any[] = [];
    for (const datum of datumi) {
      const existing = await db.select().from(mektebKalendarTable)
        .where(and(eq(mektebKalendarTable.grupaId, grupaId), eq(mektebKalendarTable.datum, datum)));

      if (existing.length > 0) {
        const [updated] = await db.update(mektebKalendarTable)
          .set({ tip, opis: opis || null })
          .where(eq(mektebKalendarTable.id, existing[0].id))
          .returning();
        results.push(updated);
      } else {
        const [nova] = await db.insert(mektebKalendarTable).values({
          grupaId, muallimId: req.user!.userId, datum, tip, opis: opis || null,
        }).returning();
        results.push(nova);
      }
    }
    res.json(results);
  } catch (err) {
    console.error("Kalendar batch error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/kalendar/kopiraj — kopira sve unose iz jednog kalendara
// (datumi nastave, ferije, važni datumi) u drugi kalendar iste muallime.
// Body: { sourceGrupaId: number, targetGrupaId: number, override?: boolean }
// Po defaultu skip-uje datume koji već postoje u target-u; ako je override=true
// upsertuje preko postojećih.
router.post("/kalendar/kopiraj", async (req, res) => {
  try {
    const { sourceGrupaId, targetGrupaId, override } = req.body || {};
    const srcId = parseInt(String(sourceGrupaId));
    const tgtId = parseInt(String(targetGrupaId));
    if (!srcId || !tgtId) {
      res.status(400).json({ error: "sourceGrupaId i targetGrupaId su obavezni" });
      return;
    }
    if (srcId === tgtId) {
      res.status(400).json({ error: "Izvorna i odredišna grupa moraju biti različite" });
      return;
    }

    const muallimId = req.user!.userId;
    const role = req.user!.role;
    const sourceGrupa = await verifyGrupaAccess(srcId, muallimId, role);
    const targetGrupa = await verifyGrupaAccess(tgtId, muallimId, role);
    if (!sourceGrupa || !targetGrupa) {
      res.status(403).json({ error: "Nije vaša grupa" });
      return;
    }

    const sourceEntries = await db.select().from(mektebKalendarTable)
      .where(eq(mektebKalendarTable.grupaId, srcId));
    if (sourceEntries.length === 0) {
      res.json({ kopirano: 0, preskoceno: 0, ukupno: 0 });
      return;
    }

    const existingTarget = await db.select().from(mektebKalendarTable)
      .where(eq(mektebKalendarTable.grupaId, tgtId));
    const existingByDate = new Map(existingTarget.map(e => [e.datum, e]));

    let kopirano = 0;
    let preskoceno = 0;
    for (const entry of sourceEntries) {
      const existing = existingByDate.get(entry.datum);
      if (existing) {
        if (override) {
          await db.update(mektebKalendarTable)
            .set({ tip: entry.tip, opis: entry.opis })
            .where(eq(mektebKalendarTable.id, existing.id));
          kopirano++;
        } else {
          preskoceno++;
        }
      } else {
        await db.insert(mektebKalendarTable).values({
          grupaId: tgtId,
          muallimId,
          datum: entry.datum,
          tip: entry.tip,
          opis: entry.opis,
        });
        kopirano++;
      }
    }

    res.json({ kopirano, preskoceno, ukupno: sourceEntries.length });
  } catch (err) {
    console.error("Kalendar kopiraj error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// DELETE /api/muallim/kalendar/:id
router.delete("/kalendar/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [entry] = await db.select().from(mektebKalendarTable).where(eq(mektebKalendarTable.id, id));
    if (!entry || entry.muallimId !== req.user!.userId) { res.status(403).json({ error: "Nemaš pristup" }); return; }
    await db.delete(mektebKalendarTable).where(eq(mektebKalendarTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// ── PLAN LEKCIJA ────────────────────────────────────────────────────────────────

// GET /api/muallim/plan-lekcija?grupaId=X&datum=YYYY-MM-DD
router.get("/plan-lekcija", async (req, res) => {
  try {
    const grupaId = parseInt(req.query.grupaId as string);
    if (!grupaId) { res.status(400).json({ error: "grupaId obavezan" }); return; }

    const grupa = await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role);
    if (!grupa) { res.status(403).json({ error: "Nije vaša grupa" }); return; }

    const datum = req.query.datum as string;
    const where = datum
      ? and(eq(planLekcijaTable.grupaId, grupaId), eq(planLekcijaTable.datum, datum))
      : eq(planLekcijaTable.grupaId, grupaId);

    const lekcije = await db.select().from(planLekcijaTable)
      .where(where)
      .orderBy(asc(planLekcijaTable.datum), asc(planLekcijaTable.redoslijed));

    res.json(lekcije);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/plan-lekcija — add lesson to day plan
router.post("/plan-lekcija", async (req, res) => {
  try {
    const { grupaId, datum, lekcijaNaslov, lekcijaTip, redoslijed } = req.body;
    if (!grupaId || !datum || !lekcijaNaslov) { res.status(400).json({ error: "grupaId, datum i lekcijaNaslov su obavezni" }); return; }

    const grupa = await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role);
    if (!grupa) { res.status(403).json({ error: "Nije vaša grupa" }); return; }

    const [nova] = await db.insert(planLekcijaTable).values({
      grupaId, muallimId: req.user!.userId, datum, lekcijaNaslov,
      lekcijaTip: lekcijaTip || "ilmihal",
      redoslijed: redoslijed || 0,
    }).returning();

    res.status(201).json(nova);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// DELETE /api/muallim/plan-lekcija/:id
router.delete("/plan-lekcija/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [entry] = await db.select().from(planLekcijaTable).where(eq(planLekcijaTable.id, id));
    if (!entry || entry.muallimId !== req.user!.userId) { res.status(403).json({ error: "Nemaš pristup" }); return; }
    await db.delete(planLekcijaTable).where(eq(planLekcijaTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/lekcije-za-plan — list available lessons for plan assignment
router.get("/lekcije-za-plan", async (req, res) => {
  try {
    const lekcije = await db.select({
      id: ilmihalLekcijeTable.id,
      naslov: ilmihalLekcijeTable.naslov,
      nivo: ilmihalLekcijeTable.nivo,
      slug: ilmihalLekcijeTable.slug,
    }).from(ilmihalLekcijeTable).orderBy(asc(ilmihalLekcijeTable.nivo), asc(ilmihalLekcijeTable.redoslijed));

    res.json(lekcije);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/print-kartice — SAMO prikaz za štampu kartica. Vraća
// standardne lozinke (Mekteb<broj>, deterministički izvedene iz korisničkog
// imena) i NE mijenja bazu. Lozinka koja se printa = ona koja je trenutno u
// upotrebi, jer se prijava/reset uvijek drže iste standardne vrijednosti.
router.post("/print-kartice", async (req, res) => {
  try {
    const { ucenikIds } = req.body as { ucenikIds: number[] };
    if (!ucenikIds || !Array.isArray(ucenikIds) || ucenikIds.length === 0) {
      res.status(400).json({ error: "ucenikIds je obavezan" });
      return;
    }

    const userId = req.user!.userId;
    const ctx = await getMektebCtx(userId);

    // Glavni muallim smije printati kartice za sve učenike svog mekteba.
    // Obični muallim samo za svoje učenike.
    let allowedIds: number[];
    if (ctx?.isGlavni && ctx.mektebId) {
      const muallimDzamata = await db
        .select({ userId: muallimProfiliTable.userId })
        .from(muallimProfiliTable)
        .where(eq(muallimProfiliTable.mektebId, ctx.mektebId));
      const muallimIds = muallimDzamata.map(m => m.userId);
      const profili = muallimIds.length > 0
        ? await db.select({ userId: ucenikProfiliTable.userId })
            .from(ucenikProfiliTable)
            .where(and(
              inArray(ucenikProfiliTable.userId, ucenikIds),
              inArray(ucenikProfiliTable.muallimId, muallimIds),
            ))
        : [];
      allowedIds = profili.map(p => p.userId);
    } else {
      const profili = await db.select({ userId: ucenikProfiliTable.userId })
        .from(ucenikProfiliTable)
        .where(and(
          inArray(ucenikProfiliTable.userId, ucenikIds),
          eq(ucenikProfiliTable.muallimId, userId),
        ));
      allowedIds = profili.map(p => p.userId);
    }

    if (allowedIds.length === 0) {
      res.status(403).json({ error: "Nemate pristup ovim učenicima" });
      return;
    }

    const users = await db.select({ id: usersTable.id, displayName: usersTable.displayName, username: usersTable.username })
      .from(usersTable).where(inArray(usersTable.id, allowedIds));

    // Roditelji povezani sa ovim učenicima (samo "approved" veze).
    // Jedan roditelj može imati više djece → ista se standardna lozinka
    // pojavljuje na svim karticama te djece.
    const veze = await db.select({
      roditeljId: roditeljUcenikTable.roditeljId,
      ucenikId: roditeljUcenikTable.ucenikId,
    }).from(roditeljUcenikTable).where(and(
      inArray(roditeljUcenikTable.ucenikId, allowedIds),
      eq(roditeljUcenikTable.status, "approved"),
    ));
    const uniqueRoditeljIds = [...new Set(veze.map(v => v.roditeljId))];
    const roditeljiData = uniqueRoditeljIds.length > 0
      ? await db.select({ id: usersTable.id, username: usersTable.username, displayName: usersTable.displayName })
          .from(usersTable).where(inArray(usersTable.id, uniqueRoditeljIds))
      : [];
    const roditeljNewPass = new Map<number, { username: string; displayName: string | null; password: string }>();
    for (const r of roditeljiData) {
      if (r.username.toLowerCase().startsWith("demo.")) {
        roditeljNewPass.set(r.id, { username: r.username, displayName: r.displayName, password: "demo123" });
        continue;
      }
      // SAMO prikaz standardne lozinke (Mekteb<broj>) — ista za učenika i
      // roditelja iz para. Print NE mijenja bazu.
      const pass = passwordFromUsername(r.username, r.id);
      roditeljNewPass.set(r.id, { username: r.username, displayName: r.displayName, password: pass });
    }
    // Mapa ucenikId → niz roditelja (najčešće 0 ili 1, rijetko više).
    const roditeljiPoUceniku = new Map<number, Array<{ username: string; displayName: string | null; password: string }>>();
    for (const v of veze) {
      const r = roditeljNewPass.get(v.roditeljId);
      if (!r) continue;
      if (!roditeljiPoUceniku.has(v.ucenikId)) roditeljiPoUceniku.set(v.ucenikId, []);
      roditeljiPoUceniku.get(v.ucenikId)!.push(r);
    }

    const results = [];
    for (const u of users) {
      const isDemo = u.username.toLowerCase().startsWith("demo.");
      // SAMO prikaz trenutne standardne lozinke (Mekteb<broj>) — print NE mijenja bazu.
      const newPass = isDemo ? "demo123" : passwordFromUsername(u.username, u.id);
      results.push({
        id: u.id,
        displayName: u.displayName,
        username: u.username,
        generatedPassword: newPass,
        roditelji: roditeljiPoUceniku.get(u.id) || [],
      });
    }

    res.json(results);
  } catch (err) {
    console.error("Print kartice error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/muallim/profil — update muallim profile (displayName)
router.put("/profil", async (req, res) => {
  try {
    const { displayName } = req.body;
    if (!displayName || displayName.trim().length < 2) { res.status(400).json({ error: "Ime mora imati minimalno 2 karaktera" }); return; }

    const [updated] = await db.update(usersTable)
      .set({ displayName: displayName.trim() })
      .where(eq(usersTable.id, req.user!.userId))
      .returning();

    res.json({ displayName: updated.displayName });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/muallim/profil/password — promjena šifre (svaki muallim za sebe).
router.put("/profil/password", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Popunite sva polja" }); return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "Nova šifra mora imati najmanje 6 znakova" }); return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) { res.status(404).json({ error: "Korisnik nije pronađen" }); return; }
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) { res.status(400).json({ error: "Trenutna šifra nije ispravna" }); return; }
    const hash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.id, userId));
    res.json({ success: true });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// ── STATISTIKA GRUPE ─────────────────────────────────────────────────────────

async function getGrupaFullStats(grupaId: number) {
  const profili = await db.select().from(ucenikProfiliTable)
    .where(and(eq(ucenikProfiliTable.grupaId, grupaId), eq(ucenikProfiliTable.isArchived, false)));
  if (profili.length === 0) return { ucenici: [] as any[], ukupnoCasova: 0, svaDatumi: [], mjesecniPregled: [], grupaPrisustvoPct: null, grupaProsjekOcjena: null, aktivnihProslejSedmice: 0, ukupnoKvizova: 0, ukupnoBodovaGrupa: 0, prosjekBodovaGrupa: 0, prisustvoPoDatumu: [] as any[], zvjezdicePozitivne: 0, zvjezdiceNegativne: 0 };

  const ucenikIds = profili.map(p => p.userId);
  const users = await db.select({ id: usersTable.id, displayName: usersTable.displayName })
    .from(usersTable).where(inArray(usersTable.id, ucenikIds));
  const userMap = Object.fromEntries(users.map(u => [u.id, u.displayName]));

  const svoPrisustvoRaw = await db.select().from(priustvoTable)
    .where(eq(priustvoTable.grupaId, grupaId));
  const svoPrisustvo = svoPrisustvoRaw.filter(p =>
    ucenikIds.includes(p.ucenikId) && isFromCurrentSchoolYear(p.datum),
  );
  const sveOcjeneRaw = await db.select().from(ocjeneTable)
    .where(eq(ocjeneTable.grupaId, grupaId));
  const sveOcjene = sveOcjeneRaw.filter(o =>
    ucenikIds.includes(o.ucenikId) && isFromCurrentSchoolYear(o.datum),
  );
  const kvizRezultati = ucenikIds.length > 0
    ? await db.select().from(kvizRezultatiTable)
        .where(inArray(kvizRezultatiTable.userId, ucenikIds))
    : [];
  const zvjezdiceMap = await getZvjezdiceZaUcenike(ucenikIds);

  const svaDatumi = [...new Set(svoPrisustvo.map(p => p.datum))].sort();
  const ukupnoCasova = svaDatumi.length;

  const mjesecSet = new Set<string>();
  svoPrisustvo.forEach(p => { if (p.datum) mjesecSet.add(p.datum.substring(0, 7)); });
  const mjeseci = [...mjesecSet].sort();

  const ucenici = ucenikIds.map(uid => {
    const prisutvoRec = svoPrisustvo.filter(p => p.ucenikId === uid);
    const prisutanCount = prisutvoRec.filter(p => p.status === "prisutan").length;
    const odsutanCount = prisutvoRec.filter(p => p.status === "odsutan").length;
    const zakasnioCount = prisutvoRec.filter(p => p.status === "zakasnio").length;
    const opravdanCount = prisutvoRec.filter(p => p.status === "opravdan").length;
    const ukupnoPrisustvo = prisutvoRec.length;
    const prisustvoPct = ukupnoPrisustvo > 0 ? Math.round((prisutanCount / ukupnoPrisustvo) * 100) : null;

    const prisustvoPoDatumu: Record<string, string> = {};
    prisutvoRec.forEach(p => { prisustvoPoDatumu[p.datum] = p.status; });

    const mjesecnoStats = mjeseci.map(m => {
      const mRec = prisutvoRec.filter(p => p.datum.startsWith(m));
      const mPrisutan = mRec.filter(p => p.status === "prisutan").length;
      return { mjesec: m, prisutan: mPrisutan, ukupno: mRec.length, pct: mRec.length > 0 ? Math.round((mPrisutan / mRec.length) * 100) : null };
    });

    const ocjeneRec = sveOcjene.filter(o => o.ucenikId === uid);
    const kategorije: Record<string, number[]> = {};
    for (const o of ocjeneRec) {
      if (!kategorije[o.kategorija]) kategorije[o.kategorija] = [];
      kategorije[o.kategorija].push(o.ocjena);
    }
    const prosjecneOcjene: Record<string, number> = {};
    for (const [kat, vals] of Object.entries(kategorije)) {
      prosjecneOcjene[kat] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
    }
    const ukupnaProsjecna = ocjeneRec.length > 0
      ? Math.round((ocjeneRec.reduce((a, o) => a + o.ocjena, 0) / ocjeneRec.length) * 10) / 10
      : null;

    const kvizovi = kvizRezultati.filter(k => k.userId === uid);
    const kvizCount = kvizovi.length;
    const kvizProsjecniProcenat = kvizCount > 0
      ? Math.round(kvizovi.reduce((a, k) => a + k.procenat, 0) / kvizCount)
      : null;
    const ukupnoBodova = kvizovi.reduce((a, k) => a + (k.bodovi || 0), 0);

    const sedmicaDatum = new Date();
    sedmicaDatum.setDate(sedmicaDatum.getDate() - 7);
    const sedmicaStr = sedmicaDatum.toISOString().split("T")[0];
    const kvizovaProslejSedmice = kvizovi.filter(k => k.completedAt && new Date(k.completedAt).toISOString().split("T")[0] >= sedmicaStr).length;

    return {
      id: uid,
      ime: userMap[uid] || "Nepoznat",
      prisustvoPct,
      prisutanCount,
      odsutanCount,
      zakasnioCount,
      opravdanCount,
      ukupnoPrisustvo,
      prisustvoPoDatumu,
      mjesecnoStats,
      prosjecneOcjene,
      ukupnaProsjecna,
      brojOcjena: ocjeneRec.length,
      kvizCount,
      kvizProsjecniProcenat,
      ukupnoBodova,
      kvizovaProslejSedmice,
      zvjezdicePozitivne: zvjezdiceMap.get(uid)?.pozitivne ?? 0,
      zvjezdiceNegativne: zvjezdiceMap.get(uid)?.negativne ?? 0,
    };
  });

  const sedmicaDatum = new Date();
  sedmicaDatum.setDate(sedmicaDatum.getDate() - 7);
  const sedmicaStr = sedmicaDatum.toISOString().split("T")[0];
  const aktivnihProslejSedmice = ucenici.filter(u => u.kvizovaProslejSedmice > 0).length;

  const ukupnoKvizova = ucenici.reduce((a, u) => a + u.kvizCount, 0);
  const ukupnoBodovaGrupa = ucenici.reduce((a, u) => a + u.ukupnoBodova, 0);
  const prosjekBodovaGrupa = ucenici.length > 0 ? Math.round(ukupnoBodovaGrupa / ucenici.length) : 0;

  const totalPrisustva = ucenici.reduce((a, u) => a + (u.prisutanCount || 0), 0);
  const totalRecords = ucenici.reduce((a, u) => a + (u.ukupnoPrisustvo || 0), 0);
  const grupaPrisustvoPct = totalRecords > 0 ? Math.round((totalPrisustva / totalRecords) * 100) : null;

  const ocjeneWithVals = ucenici.filter(u => u.ukupnaProsjecna !== null);
  const grupaProsjekOcjena = ocjeneWithVals.length > 0
    ? Math.round((ocjeneWithVals.reduce((a, u) => a + (u.ukupnaProsjecna || 0), 0) / ocjeneWithVals.length) * 10) / 10
    : null;

  const mjesecniPregled = mjeseci.map(m => {
    const mRecs = svoPrisustvo.filter(p => p.datum.startsWith(m));
    const mPrisutan = mRecs.filter(p => p.status === "prisutan").length;
    const mOdsutan = mRecs.filter(p => p.status === "odsutan").length;
    const mZakasnio = mRecs.filter(p => p.status === "zakasnio").length;
    const mOpravdan = mRecs.filter(p => p.status === "opravdan").length;
    return { mjesec: m, prisutan: mPrisutan, odsutan: mOdsutan, zakasnio: mZakasnio, opravdan: mOpravdan, ukupno: mRecs.length, pct: mRecs.length > 0 ? Math.round((mPrisutan / mRecs.length) * 100) : null };
  });

  const prisustvoPoDatumu = svaDatumi.map(d => {
    const recs = svoPrisustvo.filter(p => p.datum === d);
    const perStudent: Record<number, string> = {};
    recs.forEach(r => { perStudent[r.ucenikId] = r.status; });
    const prisutanCount = recs.filter(r => r.status === "prisutan").length;
    return { datum: d, prisutan: prisutanCount, ukupno: recs.length, pct: recs.length > 0 ? Math.round((prisutanCount / recs.length) * 100) : null, perStudent };
  });

  const zvjezdicePozitivne = ucenici.reduce((a, u) => a + u.zvjezdicePozitivne, 0);
  const zvjezdiceNegativne = ucenici.reduce((a, u) => a + u.zvjezdiceNegativne, 0);

  return { ucenici, ukupnoCasova, svaDatumi, mjesecniPregled, grupaPrisustvoPct, grupaProsjekOcjena, aktivnihProslejSedmice, ukupnoKvizova, ukupnoBodovaGrupa, prosjekBodovaGrupa, prisustvoPoDatumu, zvjezdicePozitivne, zvjezdiceNegativne };
}

router.get("/grupa/:id/statistika", async (req, res) => {
  try {
    const grupaId = parseInt(req.params.id);
    const grupa = await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role);
    if (!grupa) { res.status(403).json({ error: "Nije vaša grupa" }); return; }
    const stats = await getGrupaFullStats(grupaId);
    res.json(stats);
  } catch (err) {
    console.error("Statistika error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/dashboard-stats — agregat za panel pregled
// Query param: ?skolskaGodina=2025/26  →  filtrira po školskoj godini.
// Ako nije navedena, vraća sve (backward compat).
router.get("/dashboard-stats", async (req, res) => {
  try {
    const muallimId = await resolveViewMuallimId(req);
    if (!muallimId) { res.status(403).json({ error: "Pregled muallima nije dozvoljen" }); return; }
    const filterYear = (req.query.skolskaGodina as string) || null;
    const userRole = req.query.muallimId ? "muallim" : req.user!.role;
    const ctx = await getMektebCtx(muallimId);
    const scopedView = Boolean(req.query.muallimId);

    // Dashboard mora koristiti iste grupe koje muallim vidi u GET /grupe:
    // glavni vidi cijeli mekteb, sekundarni vidi dodijeljene grupe, a obični
    // muallim svoje grupe. Ranije se ovdje gledao samo grupe.muallim_id,
    // pa je Pregled glavnog/sekundarnog muallima ostajao prazan.
    let dostupneGrupeRows: Array<{ id: number; skolskaGodina: string | null }>;
    if (userRole === "admin") {
      const rows = await db.execute(sql`
        SELECT id, skolska_godina AS "skolskaGodina"
        FROM grupe
        WHERE COALESCE(is_archived, false) = false
          AND COALESCE(is_active, true) = true
        ORDER BY id
      `);
      dostupneGrupeRows = rows.rows as typeof dostupneGrupeRows;
    } else if (ctx?.isGlavni && ctx.mektebId && !scopedView) {
      const rows = await db.execute(sql`
        SELECT g.id, g.skolska_godina AS "skolskaGodina"
        FROM grupe g
        JOIN muallim_profili mp ON mp.user_id = g.muallim_id
        WHERE mp.mekteb_id = ${ctx.mektebId}
          AND COALESCE(g.is_archived, false) = false
          AND COALESCE(g.is_active, true) = true
        ORDER BY g.id
      `);
      dostupneGrupeRows = rows.rows as typeof dostupneGrupeRows;
    } else {
      const rows = await db.execute(sql`
        SELECT DISTINCT g.id, g.skolska_godina AS "skolskaGodina"
        FROM grupe g
        LEFT JOIN grupa_muallimi gm ON gm.grupa_id = g.id
        WHERE (g.muallim_id = ${muallimId} OR gm.muallim_id = ${muallimId})
          AND COALESCE(g.is_archived, false) = false
          AND COALESCE(g.is_active, true) = true
        ORDER BY g.id
      `);
      dostupneGrupeRows = rows.rows as typeof dostupneGrupeRows;
    }

    const sveGrupe = dostupneGrupeRows;
    const grupe = filterYear
      ? sveGrupe.filter(g => g.skolskaGodina === filterYear)
      : sveGrupe;
    const grupeIds = grupe.map(g => g.id);

    // Profil je vezan za grupu; kod glavnog/sekundarnog muallima vlasnički
    // muallim_id profila može biti drugi muallim, zato ne filtriramo po njemu.
    const profili = grupeIds.length > 0
      ? await db.select().from(ucenikProfiliTable)
          .where(and(
            inArray(ucenikProfiliTable.grupaId, grupeIds),
            eq(ucenikProfiliTable.isArchived, false),
          ))
      : [];

    const ucenikIds = profili.map(p => p.userId);
    const aktivnihUcenika = profili.length;

    let prosjekPrisustva: number | null = null;
    let prosjekOcjena: number | null = null;
    let ukupnoLekcijaZavrseno = 0;
    let ukupnoKvizovaUradeno = 0;
    let ukupnoBodova = 0;
    let danasnjePrisustvoPct: number | null = null;
    let danasnjeEvidentirano = 0;

    if (ucenikIds.length > 0) {
      const today = new Date().toISOString().split("T")[0];
      // Prisustvo i ocjene filtriramo po dostupnim grupama. Ne ograničavamo
      // muallim_id jer je zapis mogao unijeti sekundarni muallim.
      const [prisustvoRaw, ocjeneRaw, kvizovi, lekcije, danasnjeRaw] = await Promise.all([
        grupeIds.length > 0
          ? db.select().from(priustvoTable)
              .where(inArray(priustvoTable.grupaId, grupeIds))
          : db.select().from(priustvoTable).where(sql`false`),
        grupeIds.length > 0
          ? db.select().from(ocjeneTable)
              .where(inArray(ocjeneTable.grupaId, grupeIds))
          : db.select().from(ocjeneTable).where(sql`false`),
        db.select().from(kvizRezultatiTable).where(inArray(kvizRezultatiTable.userId, ucenikIds)),
        db.select({ id: korisnikNapredakTable.id }).from(korisnikNapredakTable)
          .where(and(inArray(korisnikNapredakTable.userId, ucenikIds), eq(korisnikNapredakTable.zavrsen, true))),
        grupeIds.length > 0
          ? db.select().from(priustvoTable)
              .where(and(eq(priustvoTable.datum, today), inArray(priustvoTable.grupaId, grupeIds)))
          : db.select().from(priustvoTable).where(sql`false`),
      ]);
      const prisustvo = prisustvoRaw.filter(p => isFromCurrentSchoolYear(p.datum));
      const ocjene = ocjeneRaw.filter(o => isFromCurrentSchoolYear(o.datum));
      const danasnje = danasnjeRaw.filter(p => isFromCurrentSchoolYear(p.datum));

      const prisutnih = prisustvo.filter(p => p.status === "prisutan").length;
      prosjekPrisustva = prisustvo.length > 0 ? Math.round((prisutnih / prisustvo.length) * 100) : null;
      prosjekOcjena = ocjene.length > 0
        ? Math.round((ocjene.reduce((a, o) => a + o.ocjena, 0) / ocjene.length) * 10) / 10
        : null;
      ukupnoLekcijaZavrseno = lekcije.length;
      ukupnoKvizovaUradeno = kvizovi.length;
      ukupnoBodova = kvizovi.reduce((a, k) => a + (k.bodovi || 0), 0);
      const danasPrisutnih = danasnje.filter(p => p.status === "prisutan").length;
      danasnjePrisustvoPct = danasnje.length > 0 ? Math.round((danasPrisutnih / danasnje.length) * 100) : null;
      danasnjeEvidentirano = danasnje.length;
    }

    const denom = aktivnihUcenika || profili.length || 1;
    // Dostupne godine (sve grupe ovog muallima) — za frontend dropdown
    const dostupneGodine = [...new Set(sveGrupe.map(g => g.skolskaGodina).filter(Boolean))].sort().reverse();

    res.json({
      ukupnoUcenika: profili.length,
      aktivnihUcenika,
      ukupnoGrupa: grupe.length,
      skolskaGodina: filterYear,
      dostupneGodine,
      prosjekPrisustva,
      prosjekOcjena,
      ukupnoLekcijaZavrseno,
      prosjekLekcijaPoUceniku: Math.round((ukupnoLekcijaZavrseno / denom) * 10) / 10,
      ukupnoKvizovaUradeno,
      prosjekKvizovaPoUceniku: Math.round((ukupnoKvizovaUradeno / denom) * 10) / 10,
      ukupnoBodova,
      danasnjePrisustvoPct,
      danasnjeEvidentirano,
    });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/statistika-mekteb — agregat statistike kroz sve grupe muallima
router.get("/statistika-mekteb", async (req, res) => {
  try {
    const muallimId = await resolveViewMuallimId(req);
    if (!muallimId) { res.status(403).json({ error: "Pregled muallima nije dozvoljen" }); return; }
    const userRole = req.query.muallimId ? "muallim" : req.user!.role;
    const ctx = await getMektebCtx(muallimId);
    const scopedView = Boolean(req.query.muallimId);

    // Isti skup grupe kao u dashboard-stats i GET /grupe:
    // admin → sve, glavni → cijeli mekteb, ostali → vlastite + sekundarne
    let grupeRows: Array<{ id: number }>;
    if (userRole === "admin") {
      const rows = await db.execute(sql`
        SELECT id FROM grupe
        WHERE COALESCE(is_archived, false) = false
          AND COALESCE(is_active, true) = true
        ORDER BY id
      `);
      grupeRows = rows.rows as typeof grupeRows;
    } else if (ctx?.isGlavni && ctx.mektebId && !scopedView) {
      const rows = await db.execute(sql`
        SELECT g.id FROM grupe g
        JOIN muallim_profili mp ON mp.user_id = g.muallim_id
        WHERE mp.mekteb_id = ${ctx.mektebId}
          AND COALESCE(g.is_archived, false) = false
          AND COALESCE(g.is_active, true) = true
        ORDER BY g.id
      `);
      grupeRows = rows.rows as typeof grupeRows;
    } else {
      const rows = await db.execute(sql`
        SELECT DISTINCT g.id FROM grupe g
        LEFT JOIN grupa_muallimi gm ON gm.grupa_id = g.id
        WHERE (g.muallim_id = ${muallimId} OR gm.muallim_id = ${muallimId})
          AND COALESCE(g.is_archived, false) = false
          AND COALESCE(g.is_active, true) = true
        ORDER BY g.id
      `);
      grupeRows = rows.rows as typeof grupeRows;
    }
    const grupeIds = grupeRows.map(r => r.id);
    const grupe = grupeIds.length > 0
      ? await db.select().from(grupeTable).where(inArray(grupeTable.id, grupeIds))
      : [];

    if (grupe.length === 0) {
      res.json({
        perGrupa: [],
        global: {
          ukupnoGrupa: 0, ukupnoUcenika: 0, ukupnoCasova: 0,
          prosjekPrisustva: null, prosjekOcjena: null,
          ukupnoKvizova: 0, ukupnoBodova: 0,
          prosjekLekcijaPoUceniku: 0, prosjekKvizovaPoUceniku: 0,
          zvjezdicePozitivne: 0, zvjezdiceNegativne: 0,
        },
      });
      return;
    }

    const perGrupa = await Promise.all(grupe.map(async (g) => {
      const stats = await getGrupaFullStats(g.id);
      return {
        id: g.id,
        naziv: g.naziv,
        skolskaGodina: g.skolskaGodina,
        ukupnoUcenika: stats.ucenici.length,
        ukupnoCasova: stats.ukupnoCasova,
        prisustvoPct: stats.grupaPrisustvoPct,
        prosjekOcjena: stats.grupaProsjekOcjena,
        ukupnoKvizova: stats.ukupnoKvizova,
        ukupnoBodova: stats.ukupnoBodovaGrupa,
        prosjekBodova: stats.prosjekBodovaGrupa,
        aktivnihProslejSedmice: stats.aktivnihProslejSedmice,
        zvjezdicePozitivne: stats.zvjezdicePozitivne,
        zvjezdiceNegativne: stats.zvjezdiceNegativne,
      };
    }));

    const totalUcenika = perGrupa.reduce((a, g) => a + g.ukupnoUcenika, 0);
    const totalCasova = perGrupa.reduce((a, g) => a + g.ukupnoCasova, 0);
    const totalKvizova = perGrupa.reduce((a, g) => a + g.ukupnoKvizova, 0);
    const totalBodova = perGrupa.reduce((a, g) => a + g.ukupnoBodova, 0);

    const validPris = perGrupa.filter(g => g.prisustvoPct !== null);
    const prosjekPrisustva = validPris.length > 0
      ? Math.round(validPris.reduce((a, g) => a + (g.prisustvoPct || 0) * g.ukupnoUcenika, 0) / Math.max(validPris.reduce((a, g) => a + g.ukupnoUcenika, 0), 1))
      : null;
    const validOc = perGrupa.filter(g => g.prosjekOcjena !== null);
    const prosjekOcjena = validOc.length > 0
      ? Math.round((validOc.reduce((a, g) => a + (g.prosjekOcjena || 0) * g.ukupnoUcenika, 0) / Math.max(validOc.reduce((a, g) => a + g.ukupnoUcenika, 0), 1)) * 10) / 10
      : null;

    // Lekcije završeno preko korisnik-napredak za sve učenike svih grupa.
    const profili = await db.select().from(ucenikProfiliTable)
      .where(and(
        inArray(ucenikProfiliTable.grupaId, grupeIds),
        eq(ucenikProfiliTable.isArchived, false),
      ));
    const ucenikIds = profili.map(p => p.userId);
    const lekcije = ucenikIds.length > 0
      ? await db.select({ id: korisnikNapredakTable.id }).from(korisnikNapredakTable)
          .where(and(inArray(korisnikNapredakTable.userId, ucenikIds), eq(korisnikNapredakTable.zavrsen, true)))
      : [];
    const denom = totalUcenika || 1;

    res.json({
      perGrupa,
      global: {
        ukupnoGrupa: grupe.length,
        ukupnoUcenika: totalUcenika,
        ukupnoCasova: totalCasova,
        prosjekPrisustva,
        prosjekOcjena,
        ukupnoKvizova: totalKvizova,
        ukupnoBodova: totalBodova,
        ukupnoLekcijaZavrseno: lekcije.length,
        prosjekLekcijaPoUceniku: Math.round((lekcije.length / denom) * 10) / 10,
        prosjekKvizovaPoUceniku: Math.round((totalKvizova / denom) * 10) / 10,
        zvjezdicePozitivne: perGrupa.reduce((a, g) => a + g.zvjezdicePozitivne, 0),
        zvjezdiceNegativne: perGrupa.reduce((a, g) => a + g.zvjezdiceNegativne, 0),
      },
    });
  } catch (err) {
    console.error("Statistika mekteb error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/kalendar/sve — objedinjeni kalendar svih grupa muallima
// Vraća sve kalendar entry-je + plan-lekcija unose svih svojih grupa, sa
// grupaNaziv labelom za prikaz badgeova.
router.get("/kalendar/sve", async (req, res) => {
  try {
    const muallimId = await resolveViewMuallimId(req);
    if (!muallimId) { res.status(403).json({ error: "Pregled muallima nije dozvoljen" }); return; }
    const scopedView = Boolean(req.query.muallimId);
    const grupe = await db.select().from(grupeTable).where(and(
      eq(grupeTable.muallimId, muallimId),
      sql`COALESCE(is_archived, false) = false`,
      sql`COALESCE(is_active, true) = true`,
    ));
    const grupeIds = grupe.map(g => g.id);
    const grupaMap = new Map(grupe.map(g => [g.id, g.naziv]));

    if (grupeIds.length === 0) {
      res.json({ kalendar: [], planLekcija: [] });
      return;
    }

    const [kalendar, planLekcija] = await Promise.all([
      db.select().from(mektebKalendarTable)
        .where(inArray(mektebKalendarTable.grupaId, grupeIds))
        .orderBy(asc(mektebKalendarTable.datum)),
      db.select().from(planLekcijaTable)
        .where(inArray(planLekcijaTable.grupaId, grupeIds))
        .orderBy(asc(planLekcijaTable.datum), asc(planLekcijaTable.redoslijed)),
    ]);

    res.json({
      kalendar: kalendar.map(k => ({ ...k, grupaNaziv: grupaMap.get(k.grupaId) || null })),
      planLekcija: planLekcija.map(p => ({ ...p, grupaNaziv: grupaMap.get(p.grupaId) || null })),
    });
  } catch (err) {
    console.error("Kalendar sve error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/h5p-stats?grupaId=X
// Agregira H5P pokušaje učenika date grupe po (prilog × učenik). Za svaki H5P
// prilog koji je makar jedan učenik iz grupe pokušao vraća: koliko učenika ga
// je pokrenulo, ukupan broj pokušaja, prosječan procenat svih pokušaja, te
// najslabijeg učenika (po prosjeku procenata) sa linkom na njegov profil.
router.get("/h5p-stats", async (req, res) => {
  try {
    const grupaId = parseInt(req.query.grupaId as string);
    if (!grupaId) { res.status(400).json({ error: "grupaId obavezan" }); return; }

    const grupa = await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role);
    if (!grupa) { res.status(403).json({ error: "Nije vaša grupa" }); return; }

    // Aktivni učenici grupe (preskačemo arhivirane).
    const profili = await db.select({ userId: ucenikProfiliTable.userId })
      .from(ucenikProfiliTable)
      .where(and(
        eq(ucenikProfiliTable.grupaId, grupaId),
        eq(ucenikProfiliTable.isArchived, false),
      ));
    const ucenikIds = profili.map(p => p.userId);
    const ukupnoUcenika = ucenikIds.length;

    if (ucenikIds.length === 0) {
      res.json({ ukupnoUcenika: 0, vjezbe: [] });
      return;
    }

    // Imena učenika (za prikaz najslabijih).
    const ucenici = await db.select({
      id: usersTable.id,
      displayName: usersTable.displayName,
    }).from(usersTable).where(inArray(usersTable.id, ucenikIds));
    const imeMap = new Map<number, string>(ucenici.map(u => [u.id, u.displayName]));

    // Svi H5P pokušaji ovih učenika.
    const pokusaji = await db.select({
      id: h5pPokusajiTable.id,
      userId: h5pPokusajiTable.userId,
      priloziId: h5pPokusajiTable.priloziId,
      procenat: h5pPokusajiTable.procenat,
      attemptNo: h5pPokusajiTable.attemptNo,
      completedAt: h5pPokusajiTable.completedAt,
    }).from(h5pPokusajiTable).where(inArray(h5pPokusajiTable.userId, ucenikIds));

    if (pokusaji.length === 0) {
      res.json({ ukupnoUcenika, vjezbe: [] });
      return;
    }

    // Učitaj prilog + lekciju metadata samo za one koje su učenici stvarno radili.
    const priloziIds = [...new Set(pokusaji.map(p => p.priloziId))];
    const priloziInfo = await db.select({
      id: prilozi.id,
      lekcijaId: prilozi.lekcijaId,
      originalName: prilozi.originalName,
      kind: prilozi.kind,
    }).from(prilozi).where(inArray(prilozi.id, priloziIds));
    const priloziMap = new Map(priloziInfo.map(p => [p.id, p]));

    const lekcijaIds = [...new Set(priloziInfo.map(p => p.lekcijaId))];
    const lekcije = lekcijaIds.length > 0
      ? await db.select({
          id: ilmihalLekcijeTable.id,
          naslov: ilmihalLekcijeTable.naslov,
          slug: ilmihalLekcijeTable.slug,
          nivo: ilmihalLekcijeTable.nivo,
        }).from(ilmihalLekcijeTable).where(inArray(ilmihalLekcijeTable.id, lekcijaIds))
      : [];
    const lekcijaMap = new Map(lekcije.map(l => [l.id, l]));

    // Agregacija: po prilog → po učenik → svi pokušaji.
    type UcenikAgg = { userId: number; displayName: string; brojPokusaja: number; prosjekProcenat: number };
    type PrilogAgg = {
      priloziId: number;
      priloziName: string;
      lekcijaId: number;
      lekcijaNaslov: string | null;
      lekcijaSlug: string | null;
      lekcijaNivo: number | null;
      brojUcenika: number;
      ukupnoPokusaja: number;
      prosjekProcenat: number;
      najslabijiUcenik: { id: number; displayName: string; prosjekProcenat: number; brojPokusaja: number } | null;
    };

    const perPrilog = new Map<number, { sumProcenat: number; brojPokusaja: number; perUcenik: Map<number, { sum: number; count: number }> }>();
    for (const p of pokusaji) {
      let entry = perPrilog.get(p.priloziId);
      if (!entry) {
        entry = { sumProcenat: 0, brojPokusaja: 0, perUcenik: new Map() };
        perPrilog.set(p.priloziId, entry);
      }
      entry.sumProcenat += p.procenat;
      entry.brojPokusaja += 1;
      const u = entry.perUcenik.get(p.userId);
      if (u) { u.sum += p.procenat; u.count += 1; }
      else { entry.perUcenik.set(p.userId, { sum: p.procenat, count: 1 }); }
    }

    const vjezbe: PrilogAgg[] = [];
    for (const [priloziId, agg] of perPrilog.entries()) {
      const info = priloziMap.get(priloziId);
      // Preskoči ako prilog više ne postoji ili nije H5P (čišći podaci).
      if (!info || info.kind !== "h5p") continue;
      const lek = lekcijaMap.get(info.lekcijaId) || null;

      // Najslabiji učenik = najmanji prosjek %; tie-breaker više pokušaja.
      let najslabiji: PrilogAgg["najslabijiUcenik"] = null;
      for (const [userId, u] of agg.perUcenik.entries()) {
        const avg = Math.round(u.sum / u.count);
        const ime = imeMap.get(userId) || "Nepoznat";
        if (
          !najslabiji ||
          avg < najslabiji.prosjekProcenat ||
          (avg === najslabiji.prosjekProcenat && u.count > najslabiji.brojPokusaja)
        ) {
          najslabiji = { id: userId, displayName: ime, prosjekProcenat: avg, brojPokusaja: u.count };
        }
      }

      vjezbe.push({
        priloziId,
        priloziName: info.originalName,
        lekcijaId: info.lekcijaId,
        lekcijaNaslov: lek?.naslov || null,
        lekcijaSlug: lek?.slug || null,
        lekcijaNivo: lek?.nivo ?? null,
        brojUcenika: agg.perUcenik.size,
        ukupnoPokusaja: agg.brojPokusaja,
        prosjekProcenat: Math.round(agg.sumProcenat / agg.brojPokusaja),
        najslabijiUcenik: najslabiji,
      });
    }

    // Default sort: najpopularnije (najviše učenika) → najviše pokušaja → ime.
    vjezbe.sort((a, b) => {
      if (b.brojUcenika !== a.brojUcenika) return b.brojUcenika - a.brojUcenika;
      if (b.ukupnoPokusaja !== a.ukupnoPokusaja) return b.ukupnoPokusaja - a.ukupnoPokusaja;
      return a.priloziName.localeCompare(b.priloziName);
    });

    res.json({ ukupnoUcenika, vjezbe });
  } catch (err) {
    console.error("H5P stats error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/h5p-stats/trends?grupaId=X&weeks=N
// Vraća sedmične bucket-e H5P pokušaja za zadnjih N sedmica (default 8).
// Za svaku sedmicu: weekStart (ponedjeljak, ISO datum), brojPokusaja, prosjekProcenat.
// Sedmice se računaju u UTC, ponedjeljak kao prvi dan, da bude konzistentno
// nezavisno od korisnikove vremenske zone.
router.get("/h5p-stats/trends", async (req, res) => {
  try {
    const grupaId = parseInt(req.query.grupaId as string);
    if (!grupaId) { res.status(400).json({ error: "grupaId obavezan" }); return; }

    const weeksRaw = parseInt(req.query.weeks as string);
    const weeks = Number.isFinite(weeksRaw) && weeksRaw >= 1 && weeksRaw <= 52 ? weeksRaw : 8;

    const grupa = await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role);
    if (!grupa) { res.status(403).json({ error: "Nije vaša grupa" }); return; }

    // Aktivni učenici grupe
    const profili = await db.select({ userId: ucenikProfiliTable.userId })
      .from(ucenikProfiliTable)
      .where(and(
        eq(ucenikProfiliTable.grupaId, grupaId),
        eq(ucenikProfiliTable.isArchived, false),
      ));
    const ucenikIds = profili.map(p => p.userId);

    // Pripremi N bucket-a, ponedjeljak UTC, najstariji prvi.
    // currentMonday = ponedjeljak ove sedmice u UTC.
    const now = new Date();
    const dow = now.getUTCDay(); // 0=Sun..6=Sat
    const daysSinceMonday = (dow + 6) % 7; // 0 if Monday
    const currentMonday = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday,
    ));
    const rangeStart = new Date(currentMonday.getTime() - (weeks - 1) * 7 * 24 * 60 * 60 * 1000);

    type Bucket = { weekStart: string; brojPokusaja: number; prosjekProcenat: number; sumProcenat: number };
    const buckets: Bucket[] = [];
    for (let i = 0; i < weeks; i++) {
      const ws = new Date(rangeStart.getTime() + i * 7 * 24 * 60 * 60 * 1000);
      buckets.push({
        weekStart: ws.toISOString().slice(0, 10),
        brojPokusaja: 0,
        prosjekProcenat: 0,
        sumProcenat: 0,
      });
    }

    if (ucenikIds.length === 0) {
      res.json({ weeks, rangeStart: rangeStart.toISOString().slice(0, 10), buckets });
      return;
    }

    const pokusaji = await db.select({
      procenat: h5pPokusajiTable.procenat,
      completedAt: h5pPokusajiTable.completedAt,
    }).from(h5pPokusajiTable)
      .where(and(
        inArray(h5pPokusajiTable.userId, ucenikIds),
        gte(h5pPokusajiTable.completedAt, rangeStart),
      ));

    const weekMs = 7 * 24 * 60 * 60 * 1000;
    for (const p of pokusaji) {
      const t = new Date(p.completedAt).getTime();
      const idx = Math.floor((t - rangeStart.getTime()) / weekMs);
      if (idx < 0 || idx >= weeks) continue;
      const b = buckets[idx];
      b.brojPokusaja += 1;
      b.sumProcenat += p.procenat;
    }

    for (const b of buckets) {
      b.prosjekProcenat = b.brojPokusaja > 0 ? Math.round(b.sumProcenat / b.brojPokusaja) : 0;
      // sumProcenat je interni helper — ne šaljemo ga klijentu
      delete (b as Partial<Bucket>).sumProcenat;
    }

    res.json({
      weeks,
      rangeStart: rangeStart.toISOString().slice(0, 10),
      buckets,
    });
  } catch (err) {
    console.error("H5P trends error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/h5p-stats/:priloziId?grupaId=X
// Drilldown za jedan H5P prilog: za SVAKOG aktivnog učenika date grupe vraća
// njegov najbolji procenat, prosjek, broj pokušaja i datum zadnjeg pokušaja.
// Učenici bez pokušaja se vraćaju eksplicitno (sa null statistikama) kako bi
// muallim mogao vidjeti ko još uopšte nije probao vježbu.
router.get("/h5p-stats/:priloziId", async (req, res) => {
  try {
    const priloziId = parseInt(req.params.priloziId);
    const grupaId = parseInt(req.query.grupaId as string);
    if (!priloziId) { res.status(400).json({ error: "priloziId nevalidan" }); return; }
    if (!grupaId) { res.status(400).json({ error: "grupaId obavezan" }); return; }

    const grupa = await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role);
    if (!grupa) { res.status(403).json({ error: "Nije vaša grupa" }); return; }

    // Prilog + lekcija metadata
    const [info] = await db.select({
      id: prilozi.id,
      lekcijaId: prilozi.lekcijaId,
      originalName: prilozi.originalName,
      kind: prilozi.kind,
    }).from(prilozi).where(eq(prilozi.id, priloziId));

    if (!info) { res.status(404).json({ error: "Prilog nije pronađen" }); return; }

    let lek: { id: number; naslov: string; slug: string; nivo: number | null } | null = null;
    if (info.lekcijaId) {
      const lekRes = await db.select({
        id: ilmihalLekcijeTable.id,
        naslov: ilmihalLekcijeTable.naslov,
        slug: ilmihalLekcijeTable.slug,
        nivo: ilmihalLekcijeTable.nivo,
      }).from(ilmihalLekcijeTable).where(eq(ilmihalLekcijeTable.id, info.lekcijaId));
      lek = lekRes[0] || null;
    }

    const prilog = {
      id: info.id,
      originalName: info.originalName,
      kind: info.kind,
      lekcijaId: info.lekcijaId,
      lekcijaNaslov: lek?.naslov || null,
      lekcijaSlug: lek?.slug || null,
      lekcijaNivo: lek?.nivo ?? null,
    };

    // Aktivni učenici u grupi (preskačemo arhivirane)
    const profili = await db.select({ userId: ucenikProfiliTable.userId })
      .from(ucenikProfiliTable)
      .where(and(
        eq(ucenikProfiliTable.grupaId, grupaId),
        eq(ucenikProfiliTable.isArchived, false),
      ));
    const ucenikIds = profili.map(p => p.userId);

    if (ucenikIds.length === 0) {
      res.json({ prilog, ucenici: [] });
      return;
    }

    const users = await db.select({
      id: usersTable.id,
      displayName: usersTable.displayName,
      username: usersTable.username,
    }).from(usersTable).where(inArray(usersTable.id, ucenikIds));
    const userMap = new Map(users.map(u => [u.id, u]));

    // Svi pokušaji ovog priloga od učenika ove grupe
    const pokusaji = await db.select({
      userId: h5pPokusajiTable.userId,
      procenat: h5pPokusajiTable.procenat,
      attemptNo: h5pPokusajiTable.attemptNo,
      completedAt: h5pPokusajiTable.completedAt,
    }).from(h5pPokusajiTable)
      .where(and(
        eq(h5pPokusajiTable.priloziId, priloziId),
        inArray(h5pPokusajiTable.userId, ucenikIds),
      ));

    type Agg = {
      brojPokusaja: number;
      sumProcenat: number;
      najboljiProcenat: number;
      zadnjiPokusajAt: Date | null;
    };
    const perUcenik = new Map<number, Agg>();
    for (const p of pokusaji) {
      let a = perUcenik.get(p.userId);
      if (!a) {
        a = { brojPokusaja: 0, sumProcenat: 0, najboljiProcenat: 0, zadnjiPokusajAt: null };
        perUcenik.set(p.userId, a);
      }
      a.brojPokusaja += 1;
      a.sumProcenat += p.procenat;
      if (p.procenat > a.najboljiProcenat) a.najboljiProcenat = p.procenat;
      const t = p.completedAt instanceof Date ? p.completedAt : new Date(p.completedAt);
      if (!a.zadnjiPokusajAt || t > a.zadnjiPokusajAt) a.zadnjiPokusajAt = t;
    }

    const ucenici = ucenikIds.map(id => {
      const u = userMap.get(id);
      const a = perUcenik.get(id);
      return {
        id,
        displayName: u?.displayName || "Nepoznat",
        username: u?.username || "",
        brojPokusaja: a?.brojPokusaja || 0,
        najboljiProcenat: a ? a.najboljiProcenat : null,
        prosjekProcenat: a ? Math.round(a.sumProcenat / a.brojPokusaja) : null,
        zadnjiPokusajAt: a?.zadnjiPokusajAt ? a.zadnjiPokusajAt.toISOString() : null,
      };
    });

    // Default sort: učenici bez pokušaja na dnu, ostali po najboljem procentu rastuće
    // (najslabiji prvi — muallim brzo vidi kome treba pomoć).
    ucenici.sort((a, b) => {
      if (a.brojPokusaja === 0 && b.brojPokusaja > 0) return 1;
      if (b.brojPokusaja === 0 && a.brojPokusaja > 0) return -1;
      if (a.brojPokusaja === 0 && b.brojPokusaja === 0) {
        return a.displayName.localeCompare(b.displayName);
      }
      const an = a.najboljiProcenat ?? 0;
      const bn = b.najboljiProcenat ?? 0;
      if (an !== bn) return an - bn;
      return a.displayName.localeCompare(b.displayName);
    });

    res.json({ prilog, ucenici });
  } catch (err) {
    console.error("H5P stats per prilog error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/ucenik/:id/h5p-pokusaji?priloziId=optional
// Vraća sve H5P pokušaje datog učenika (najnoviji prvi), opciono filtrirano
// po jednom prilogu. Koristi se za drilldown sa /muallim/h5p-statistika
// na profil učenika. Pristup imaju: muallim koji je zadužen za učenika i admin.
router.get("/ucenik/:id/h5p-pokusaji", async (req, res) => {
  try {
    const muallimId = req.user!.userId;
    const ucenikId = parseInt(req.params.id);
    if (!ucenikId) { res.status(400).json({ error: "ID učenika nevalidan" }); return; }

    const priloziIdParam = req.query.priloziId ? parseInt(req.query.priloziId as string) : null;

    if (req.user!.role !== "admin") {
      const profili = await db.select().from(ucenikProfiliTable)
        .where(and(
          eq(ucenikProfiliTable.userId, ucenikId),
          eq(ucenikProfiliTable.muallimId, muallimId),
        ));
      if (profili.length === 0) {
        res.status(403).json({ error: "Učenik nije vaš" });
        return;
      }
    }

    const baseConds = [eq(h5pPokusajiTable.userId, ucenikId)];
    if (priloziIdParam) baseConds.push(eq(h5pPokusajiTable.priloziId, priloziIdParam));

    const pokusaji = await db.select({
      id: h5pPokusajiTable.id,
      priloziId: h5pPokusajiTable.priloziId,
      attemptNo: h5pPokusajiTable.attemptNo,
      score: h5pPokusajiTable.score,
      maxScore: h5pPokusajiTable.maxScore,
      procenat: h5pPokusajiTable.procenat,
      hasanatGained: h5pPokusajiTable.hasanatGained,
      completedAt: h5pPokusajiTable.completedAt,
    }).from(h5pPokusajiTable)
      .where(and(...baseConds))
      .orderBy(desc(h5pPokusajiTable.completedAt));

    if (pokusaji.length === 0) {
      res.json({ pokusaji: [], prilozi: [] });
      return;
    }

    const priloziIds = [...new Set(pokusaji.map(p => p.priloziId))];
    const priloziInfo = await db.select({
      id: prilozi.id,
      lekcijaId: prilozi.lekcijaId,
      originalName: prilozi.originalName,
      kind: prilozi.kind,
    }).from(prilozi).where(inArray(prilozi.id, priloziIds));

    const lekcijaIds = [...new Set(priloziInfo.map(p => p.lekcijaId))];
    const lekcije = lekcijaIds.length > 0
      ? await db.select({
          id: ilmihalLekcijeTable.id,
          naslov: ilmihalLekcijeTable.naslov,
          slug: ilmihalLekcijeTable.slug,
          nivo: ilmihalLekcijeTable.nivo,
        }).from(ilmihalLekcijeTable).where(inArray(ilmihalLekcijeTable.id, lekcijaIds))
      : [];
    const lekcijaMap = new Map(lekcije.map(l => [l.id, l]));

    const priloziOut = priloziInfo.map(p => {
      const lek = lekcijaMap.get(p.lekcijaId) || null;
      return {
        id: p.id,
        originalName: p.originalName,
        lekcijaId: p.lekcijaId,
        lekcijaNaslov: lek?.naslov || null,
        lekcijaSlug: lek?.slug || null,
        lekcijaNivo: lek?.nivo ?? null,
      };
    });

    res.json({ pokusaji, prilozi: priloziOut });
  } catch (err) {
    console.error("Ucenik H5P pokusaji error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

function sanitizeExcelCell(val: any): any {
  if (typeof val !== "string") return val;
  if (/^[=+\-@\t\r]/.test(val)) return "'" + val;
  return val;
}

router.get("/grupa/:id/izvjestaj-excel", async (req, res) => {
  try {
    const XLSX = await import("xlsx");
    const grupaId = parseInt(req.params.id);
    const grupa = await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role);
    if (!grupa) { res.status(403).json({ error: "Nije vaša grupa" }); return; }

    const stats = await getGrupaFullStats(grupaId);
    const wb = XLSX.utils.book_new();

    const prisustvoRows: any[] = [];
    const headerRow: string[] = ["Učenik", ...stats.svaDatumi, "Prisutan", "Odsutan", "Zakasnio", "Opravdan", "Ukupno", "%"];
    prisustvoRows.push(headerRow);
    for (const u of stats.ucenici) {
      const row: any[] = [sanitizeExcelCell(u.ime)];
      for (const d of stats.svaDatumi) {
        const st = u.prisustvoPoDatumu[d];
        row.push(st === "prisutan" ? "P" : st === "odsutan" ? "O" : st === "zakasnio" ? "Z" : st === "opravdan" ? "OP" : "");
      }
      row.push(u.prisutanCount, u.odsutanCount, u.zakasnioCount, u.opravdanCount, u.ukupnoPrisustvo, u.prisustvoPct !== null ? `${u.prisustvoPct}%` : "—");
      prisustvoRows.push(row);
    }
    if (stats.prisustvoPoDatumu.length > 0) {
      const totalRow: any[] = ["UKUPNO GRUPA"];
      for (const d of stats.prisustvoPoDatumu) {
        totalRow.push(`${d.prisutan}/${d.ukupno}`);
      }
      const tp = (stats.ucenici as any[]).reduce((a, u) => a + u.prisutanCount, 0);
      const to = (stats.ucenici as any[]).reduce((a, u) => a + u.odsutanCount, 0);
      const tz = (stats.ucenici as any[]).reduce((a, u) => a + u.zakasnioCount, 0);
      const top = (stats.ucenici as any[]).reduce((a, u) => a + u.opravdanCount, 0);
      const tt = (stats.ucenici as any[]).reduce((a, u) => a + u.ukupnoPrisustvo, 0);
      totalRow.push(tp, to, tz, top, tt, stats.grupaPrisustvoPct !== null ? `${stats.grupaPrisustvoPct}%` : "—");
      prisustvoRows.push(totalRow);
    }
    const ws1 = XLSX.utils.aoa_to_sheet(prisustvoRows);
    ws1["!cols"] = [{ wch: 20 }, ...stats.svaDatumi.map(() => ({ wch: 12 })), { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 6 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Prisustvo");

    const mjesecniRows: any[] = [["Mjesec", "Prisutan", "Odsutan", "Zakasnio", "Opravdan", "Ukupno", "%"]];
    const MJESEC_NAZIVI: Record<string, string> = { "01": "Januar", "02": "Februar", "03": "Mart", "04": "April", "05": "Maj", "06": "Juni", "07": "Juli", "08": "August", "09": "Septembar", "10": "Oktobar", "11": "Novembar", "12": "Decembar" };
    for (const m of stats.mjesecniPregled) {
      const parts = m.mjesec.split("-");
      const naziv = `${MJESEC_NAZIVI[parts[1]] || parts[1]} ${parts[0]}`;
      mjesecniRows.push([naziv, m.prisutan, m.odsutan, m.zakasnio, m.opravdan, m.ukupno, m.pct !== null ? `${m.pct}%` : "—"]);
    }
    const ws1b = XLSX.utils.aoa_to_sheet(mjesecniRows);
    ws1b["!cols"] = [{ wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 6 }];
    XLSX.utils.book_append_sheet(wb, ws1b, "Prisustvo po mjesecu");

    const sveOcjeneExcel = await db.select().from(ocjeneTable).where(eq(ocjeneTable.grupaId, grupaId));
    const activeIds = new Set(stats.ucenici.map(u => u.id));
    const ocjeneRows: any[] = [["Učenik", "Datum", "Kategorija", "Ocjena", "Lekcija", "Napomena"]];
    for (const u of stats.ucenici) {
      const uocjene = sveOcjeneExcel.filter(o => o.ucenikId === u.id && activeIds.has(o.ucenikId)).sort((a, b) => b.datum.localeCompare(a.datum));
      for (const o of uocjene) {
        ocjeneRows.push([sanitizeExcelCell(u.ime), o.datum, sanitizeExcelCell(o.kategorija), o.ocjena, sanitizeExcelCell(o.lekcijaNaziv || ""), sanitizeExcelCell(o.napomena || "")]);
      }
    }
    const ws2 = XLSX.utils.aoa_to_sheet(ocjeneRows);
    ws2["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 30 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Ocjene");

    const summaryRows: any[] = [
      ["IZVJEŠTAJ GRUPE", sanitizeExcelCell((grupa as any).naziv || "")],
      [],
      ["Ukupno učenika", stats.ucenici.length],
      ["Ukupno časova", stats.ukupnoCasova],
      ["Prisustvo grupe (%)", stats.grupaPrisustvoPct !== null ? `${stats.grupaPrisustvoPct}%` : "—"],
      ["Prosječna ocjena grupe", stats.grupaProsjekOcjena || "—"],
      ["Ukupno kvizova", stats.ukupnoKvizova],
      ["Ukupno bodova", stats.ukupnoBodovaGrupa],
      [],
      ["Učenik", "Prisustvo %", "Prisutan", "Odsutan", "Zakasnio", "Opravdan", "Prosj. ocjena", "Br. ocjena", "Kvizova", "Bodova"],
    ];
    for (const u of stats.ucenici) {
      summaryRows.push([
        sanitizeExcelCell(u.ime),
        u.prisustvoPct !== null ? `${u.prisustvoPct}%` : "—",
        u.prisutanCount,
        u.odsutanCount,
        u.zakasnioCount,
        u.opravdanCount,
        u.ukupnaProsjecna || "—",
        u.brojOcjena,
        u.kvizCount,
        u.ukupnoBodova,
      ]);
    }
    const ws3 = XLSX.utils.aoa_to_sheet(summaryRows);
    ws3["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws3, "Zbirni izvještaj");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const safeNaziv = ((grupa as any).naziv || "grupa").replace(/[^a-zA-Z0-9\u00C0-\u024F\u0100-\u017F_\- ]/g, "").trim().substring(0, 50);
    const filename = `izvjestaj_${safeNaziv}_${new Date().toISOString().split("T")[0]}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="izvjestaj.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error("Excel export error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// Izvoz spiska svih učenika mekteba — glavni muallim dobija cijeli mekteb,
// obični muallim samo svoje/dodijeljene grupe. Jedan glavni list je sortiran
// po muallimu i grupi, a dodatni listovi daju spisak po muallimu i grupama.
router.get("/mekteb/spisak-excel", async (req, res) => {
  try {
    const XLSX = await import("xlsx");
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const ctx = await getMektebCtx(userId);
    const filterYear = String(req.query.skolskaGodina ?? "").trim() || null;

    let scopeSql;
    if (userRole === "admin") {
      scopeSql = sql`TRUE`;
    } else if (ctx?.isGlavni && ctx.mektebId) {
      scopeSql = sql`owner.mekteb_id = ${ctx.mektebId}`;
    } else {
      scopeSql = sql`(
        up.muallim_id = ${userId}
        OR EXISTS (
          SELECT 1 FROM grupa_muallimi gm_access
          WHERE gm_access.grupa_id = up.grupa_id
            AND gm_access.muallim_id = ${userId}
        )
      )`;
    }

    const yearSql = filterYear ? sql`AND g.skolska_godina = ${filterYear}` : sql``;
    const rows = await db.execute(sql`
      SELECT
        up.user_id,
        u.display_name,
        u.username,
        g.id AS grupa_id,
        COALESCE(g.naziv, 'Bez grupe') AS grupa_naziv,
        g.skolska_godina,
        COALESCE((
          SELECT string_agg(names.display_name, ', ' ORDER BY names.display_name)
          FROM (
            SELECT primary_muallim.display_name
            FROM users primary_muallim
            WHERE primary_muallim.id = g.muallim_id
            UNION
            SELECT secondary_muallim.display_name
            FROM users secondary_muallim
            JOIN grupa_muallimi gm_names ON gm_names.muallim_id = secondary_muallim.id
            WHERE gm_names.grupa_id = g.id
          ) names
        ), 'Bez muallima') AS muallimi
      FROM ucenik_profili up
      JOIN users u ON u.id = up.user_id
      JOIN muallim_profili owner ON owner.user_id = up.muallim_id
      LEFT JOIN grupe g ON g.id = up.grupa_id
      WHERE (up.is_archived = false OR up.is_archived IS NULL)
        AND ${scopeSql}
        ${yearSql}
      ORDER BY muallimi ASC, grupa_naziv ASC, u.display_name ASC
    `);

    type SpisakRow = {
      user_id: number;
      display_name: string;
      username: string;
      grupa_id: number | null;
      grupa_naziv: string;
      skolska_godina: string | null;
      muallimi: string;
    };
    const spisak = rows.rows as SpisakRow[];
    const wb = XLSX.utils.book_new();

    const pregledRows: any[] = [
      ["SPISAK UČENIKA MEKTEBA"],
      ...(filterYear ? [["Školska godina", filterYear]] : [["Školske godine", "Sve"]]),
      [],
      ["R.br.", "Muallim(i)", "Grupa", "Školska godina", "Učenik", "Korisničko ime"],
    ];
    spisak.forEach((r, index) => {
      pregledRows.push([
        index + 1,
        sanitizeExcelCell(r.muallimi),
        sanitizeExcelCell(r.grupa_naziv),
        sanitizeExcelCell(r.skolska_godina || ""),
        sanitizeExcelCell(r.display_name),
        sanitizeExcelCell(r.username),
      ]);
    });
    const pregledSheet = XLSX.utils.aoa_to_sheet(pregledRows);
    pregledSheet["!cols"] = [
      { wch: 7 }, { wch: 28 }, { wch: 24 }, { wch: 18 }, { wch: 28 }, { wch: 24 },
    ];
    XLSX.utils.book_append_sheet(wb, pregledSheet, "Spisak učenika");

    const poMuallimu = new Map<string, SpisakRow[]>();
    for (const row of spisak) {
      if (!poMuallimu.has(row.muallimi)) poMuallimu.set(row.muallimi, []);
      poMuallimu.get(row.muallimi)!.push(row);
    }
    const muallimiRows: any[] = [["Muallim(i)", "Grupa", "Školska godina", "Broj učenika"]];
    for (const [muallimi, rowsForMuallim] of poMuallimu) {
      const poGrupi = new Map<string, SpisakRow[]>();
      for (const row of rowsForMuallim) {
        const key = `${row.grupa_naziv}\u0000${row.skolska_godina || ""}`;
        if (!poGrupi.has(key)) poGrupi.set(key, []);
        poGrupi.get(key)!.push(row);
      }
      for (const rowsForGrupa of poGrupi.values()) {
        const first = rowsForGrupa[0];
        muallimiRows.push([
          sanitizeExcelCell(muallimi),
          sanitizeExcelCell(first.grupa_naziv),
          sanitizeExcelCell(first.skolska_godina || ""),
          rowsForGrupa.length,
        ]);
      }
    }
    const muallimiSheet = XLSX.utils.aoa_to_sheet(muallimiRows);
    muallimiSheet["!cols"] = [{ wch: 28 }, { wch: 24 }, { wch: 18 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, muallimiSheet, "Po muallimima");

    const usedSheetNames = new Set(["Spisak učenika", "Po muallimima"]);
    const safeSheetName = (name: string) => {
      const base = (name || "Grupa").replace(/[\\/*?:[\]]/g, "").trim().slice(0, 31) || "Grupa";
      let candidate = base;
      let suffix = 2;
      while (usedSheetNames.has(candidate)) {
        const suffixText = ` (${suffix++})`;
        candidate = `${base.slice(0, 31 - suffixText.length)}${suffixText}`;
      }
      usedSheetNames.add(candidate);
      return candidate;
    };
    const poGrupama = new Map<string, SpisakRow[]>();
    for (const row of spisak) {
      const key = `${row.grupa_naziv}\u0000${row.skolska_godina || ""}`;
      if (!poGrupama.has(key)) poGrupama.set(key, []);
      poGrupama.get(key)!.push(row);
    }
    for (const rowsForGrupa of poGrupama.values()) {
      const first = rowsForGrupa[0];
      const groupRows: any[] = [
        ["Grupa", sanitizeExcelCell(first.grupa_naziv)],
        ["Muallim(i)", sanitizeExcelCell(first.muallimi)],
        ["Školska godina", sanitizeExcelCell(first.skolska_godina || "")],
        [],
        ["R.br.", "Učenik", "Korisničko ime"],
      ];
      rowsForGrupa.forEach((r, index) => {
        groupRows.push([index + 1, sanitizeExcelCell(r.display_name), sanitizeExcelCell(r.username)]);
      });
      const groupSheet = XLSX.utils.aoa_to_sheet(groupRows);
      groupSheet["!cols"] = [{ wch: 7 }, { wch: 28 }, { wch: 24 }];
      XLSX.utils.book_append_sheet(wb, groupSheet, safeSheetName(first.grupa_naziv));
    }

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const suffix = filterYear ? `_${filterYear.replace("/", "-")}` : "";
    const filename = `spisak_ucenika_mekteba${suffix}_${new Date().toISOString().split("T")[0]}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="spisak_ucenika_mekteba.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error("Mekteb roster Excel export error:", err);
    res.status(500).json({ error: "Greška pri izvozu spiska učenika" });
  }
});

// ── ZADAĆE ───────────────────────────────────────────────────────────────────

router.get("/zadace", async (req, res) => {
  try {
    const grupaId = req.query.grupaId ? parseInt(req.query.grupaId as string) : undefined;
    const activeGrupaRows = await db.select({ id: grupeTable.id }).from(grupeTable).where(and(
      eq(grupeTable.muallimId, req.user!.userId),
      sql`COALESCE(is_archived, false) = false`,
      sql`COALESCE(is_active, true) = true`,
    ));
    const activeGrupaIds = new Set(activeGrupaRows.map(g => g.id));
    const where = grupaId
      ? and(
          eq(zadaceTable.muallimId, req.user!.userId),
          eq(zadaceTable.grupaId, grupaId),
          gte(zadaceTable.createdAt, currentSchoolYearResetTimestamp()),
        )
      : and(
          eq(zadaceTable.muallimId, req.user!.userId),
          gte(zadaceTable.createdAt, currentSchoolYearResetTimestamp()),
        );
    const zadaceRaw = await db.select().from(zadaceTable).where(where).orderBy(desc(zadaceTable.createdAt));
    const zadace = zadaceRaw.filter(z => activeGrupaIds.has(z.grupaId));

    if (zadace.length === 0) { res.json([]); return; }

    const targets = await db.select().from(zadaceUceniciTable)
      .where(inArray(zadaceUceniciTable.zadacaId, zadace.map(z => z.id)));
    const targetMap = new Map<number, number[]>();
    for (const t of targets) {
      const arr = targetMap.get(t.zadacaId) || [];
      arr.push(t.ucenikId);
      targetMap.set(t.zadacaId, arr);
    }

    // Završeni statusi po zadaći (status = 'zavrseno') — čuvamo i ucenikId
    // da bismo brojali SAMO trenutne adresate (stari statusi za nekadašnje
    // adresate / arhivirane učenike ne smiju lažno označiti zadaću završenom).
    const statusi = await db.select({ zadacaId: zadaceStatusTable.zadacaId, ucenikId: zadaceStatusTable.ucenikId })
      .from(zadaceStatusTable)
      .where(and(
        inArray(zadaceStatusTable.zadacaId, zadace.map(z => z.id)),
        eq(zadaceStatusTable.status, "zavrseno"),
      ));
    const doneMap = new Map<number, Set<number>>();
    for (const s of statusi) {
      const set = doneMap.get(s.zadacaId) || new Set<number>();
      set.add(s.ucenikId);
      doneMap.set(s.zadacaId, set);
    }

    // Aktivni (ne-arhivirani) učenici po grupi — za zadaće namijenjene cijeloj
    // grupi (bez eksplicitnih adresata).
    const grupaIds = Array.from(new Set(zadace.map(z => z.grupaId)));
    const grupaUcenici = await db.select({ grupaId: ucenikProfiliTable.grupaId, userId: ucenikProfiliTable.userId })
      .from(ucenikProfiliTable)
      .where(and(inArray(ucenikProfiliTable.grupaId, grupaIds), eq(ucenikProfiliTable.isArchived, false)));
    const grupaUceniciMap = new Map<number, number[]>();
    for (const g of grupaUcenici) {
      if (g.grupaId == null) continue;
      const arr = grupaUceniciMap.get(g.grupaId) || [];
      arr.push(g.userId);
      grupaUceniciMap.set(g.grupaId, arr);
    }

    res.json(zadace.map(z => {
      const ucenikIds = targetMap.get(z.id) || [];
      // Trenutni adresati: eksplicitni ciljani učenici, inače aktivna grupa.
      const recipients = ucenikIds.length > 0 ? ucenikIds : (grupaUceniciMap.get(z.grupaId) || []);
      const ukupno = recipients.length;
      const doneSet = doneMap.get(z.id);
      const zavrsenih = doneSet ? recipients.filter(uid => doneSet.has(uid)).length : 0;
      const completed = ukupno > 0 && zavrsenih >= ukupno;
      return { ...z, ucenikIds, zavrsenih, ukupno, completed };
    }));
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

router.post("/zadace", async (req, res) => {
  try {
    const { grupaId, naslov, opis, rokDo, lekcijaNaslov, lekcijaSlug, lekcijaTip, ucenikIds } = req.body;
    // naslov više nije obavezan — nova UX koristi lekciju kao naziv zadaće.
    if (!grupaId) { res.status(400).json({ error: "grupaId je obavezan" }); return; }
    const naslovFinal = (naslov && String(naslov).trim()) || (lekcijaNaslov && String(lekcijaNaslov).trim()) || null;
    if (!naslovFinal) { res.status(400).json({ error: "Odaberi lekciju ili unesi naslov" }); return; }

    const grupa = await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role);
    if (!grupa) { res.status(403).json({ error: "Nije vaša grupa" }); return; }

    let canonicalSlug: string | null = null;
    if (typeof lekcijaSlug === "string" && lekcijaSlug.trim()) {
      const [lekcija] = await db.select({ slug: ilmihalLekcijeTable.slug, naslov: ilmihalLekcijeTable.naslov })
        .from(ilmihalLekcijeTable).where(eq(ilmihalLekcijeTable.slug, lekcijaSlug.trim()));
      if (!lekcija || lekcija.naslov !== String(lekcijaNaslov || "").trim()) {
        res.status(400).json({ error: "Odabrana lekcija nije ispravna" }); return;
      }
      canonicalSlug = lekcija.slug;
    }

    let validUcenikIds: number[] = [];
    if (Array.isArray(ucenikIds) && ucenikIds.length > 0) {
      const numericIds = ucenikIds.map((x: any) => Number(x)).filter((x: number) => Number.isFinite(x));
      if (numericIds.length > 0) {
        const ucenici = await db.select({ userId: ucenikProfiliTable.userId })
          .from(ucenikProfiliTable)
          .where(and(eq(ucenikProfiliTable.grupaId, grupaId), inArray(ucenikProfiliTable.userId, numericIds)));
        validUcenikIds = ucenici.map(u => u.userId);
      }
    }

    const [nova] = await db.insert(zadaceTable).values({
      grupaId,
      muallimId: req.user!.userId,
      naslov: naslovFinal,
      opis: opis || null,
      rokDo: rokDo || null,
      lekcijaNaslov: lekcijaNaslov || null,
      lekcijaSlug: canonicalSlug,
      // Kanonski slug uvijek označava Ilmihal, nezavisno od klijentskog polja.
      lekcijaTip: canonicalSlug ? "ilmihal" : (lekcijaTip || null),
    }).returning();

    if (validUcenikIds.length > 0) {
      await db.insert(zadaceUceniciTable).values(
        validUcenikIds.map(uid => ({ zadacaId: nova.id, ucenikId: uid }))
      );
    }

    // Push notifikacija — ciljanim učenicima ili cijeloj grupi (default).
    const notifyIds = validUcenikIds.length > 0
      ? validUcenikIds
      : (await db.select({ userId: ucenikProfiliTable.userId })
          .from(ucenikProfiliTable)
          .where(eq(ucenikProfiliTable.grupaId, grupaId))).map(u => u.userId);
    if (notifyIds.length > 0) {
      const opisPreview = opis && typeof opis === "string" && opis.trim()
        ? (opis.trim().length > 80 ? opis.trim().slice(0, 80) + "…" : opis.trim())
        : "Otvori da vidiš detalje.";
      sendPushNotification({
        userIds: notifyIds,
        title: `Nova zadaća: ${naslovFinal}`,
        body: opisPreview,
        url: "/ucenik/zadace",
        data: { type: "zadaca", zadacaId: nova.id },
      }).catch((err) => console.error("[Zadace push]", err));
    }

    // In-app + push obavijest roditeljima ciljanih učenika.
    if (notifyIds.length > 0) {
      (async () => {
        const djeca = await db
          .select({ id: usersTable.id, displayName: usersTable.displayName })
          .from(usersTable)
          .where(inArray(usersTable.id, notifyIds));
        const imeMap = new Map(djeca.map(d => [d.id, d.displayName]));
        for (const uid of notifyIds) {
          const ime = imeMap.get(uid) || "vaše dijete";
          await notifyApprovedRoditelji({
            ucenikId: uid,
            posiljateljId: req.user!.userId,
            naslov: `Nova zadaća za ${ime}`,
            sadrzaj: `Vaše dijete ${ime} je dobilo novu zadaću: "${naslovFinal}".`,
            logTag: "zadaca-notify-roditelj",
            pushData: { type: "zadaca", zadacaId: nova.id },
          });
        }
      })().catch(err => console.error("[zadaca-notify-roditelj] background notify failed", err));
    }

    res.status(201).json({ ...nova, ucenikIds: validUcenikIds });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

router.put("/zadace/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { naslov, opis, rokDo, lekcijaNaslov, lekcijaSlug, lekcijaTip, isActive, ucenikIds } = req.body;

    const [existing] = await db.select().from(zadaceTable)
      .where(and(eq(zadaceTable.id, id), eq(zadaceTable.muallimId, req.user!.userId)));
    if (!existing) { res.status(404).json({ error: "Zadaća nije pronađena" }); return; }

    let canonicalSlug: string | null = null;
    if (typeof lekcijaSlug === "string" && lekcijaSlug.trim()) {
      const [lekcija] = await db.select({ slug: ilmihalLekcijeTable.slug, naslov: ilmihalLekcijeTable.naslov })
        .from(ilmihalLekcijeTable).where(eq(ilmihalLekcijeTable.slug, lekcijaSlug.trim()));
      if (!lekcija || lekcija.naslov !== String(lekcijaNaslov || "").trim()) {
        res.status(400).json({ error: "Odabrana lekcija nije ispravna" }); return;
      }
      canonicalSlug = lekcija.slug;
    } else if (lekcijaNaslov === undefined) {
      canonicalSlug = existing.lekcijaSlug;
    }

    const [updated] = await db.update(zadaceTable)
      .set({
        naslov,
        opis,
        rokDo,
        lekcijaNaslov,
        lekcijaSlug: canonicalSlug,
        lekcijaTip: canonicalSlug ? "ilmihal" : lekcijaTip,
        isActive,
      })
      .where(and(eq(zadaceTable.id, id), eq(zadaceTable.muallimId, req.user!.userId)))
      .returning();

    if (Array.isArray(ucenikIds)) {
      await db.delete(zadaceUceniciTable).where(eq(zadaceUceniciTable.zadacaId, id));
      const numericIds = ucenikIds.map((x: any) => Number(x)).filter((x: number) => Number.isFinite(x));
      if (numericIds.length > 0) {
        const ucenici = await db.select({ userId: ucenikProfiliTable.userId })
          .from(ucenikProfiliTable)
          .where(and(eq(ucenikProfiliTable.grupaId, existing.grupaId), inArray(ucenikProfiliTable.userId, numericIds)));
        const validIds = ucenici.map(u => u.userId);
        if (validIds.length > 0) {
          await db.insert(zadaceUceniciTable).values(
            validIds.map(uid => ({ zadacaId: id, ucenikId: uid }))
          );
        }
      }
    }

    const targets = await db.select().from(zadaceUceniciTable).where(eq(zadaceUceniciTable.zadacaId, id));
    res.json({ ...updated, ucenikIds: targets.map(t => t.ucenikId) });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

router.delete("/zadace/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [entry] = await db.select().from(zadaceTable).where(eq(zadaceTable.id, id));
    if (!entry || entry.muallimId !== req.user!.userId) { res.status(403).json({ error: "Nemaš pristup" }); return; }
    await db.delete(zadaceTable).where(eq(zadaceTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// Razrješava primatelje zadaće: ako ima ciljanih (zadace_ucenici) -> oni;
// inače cijela grupa (svi aktivni učenici grupe).
async function resolveZadacaRecipients(zadacaId: number, grupaId: number): Promise<number[]> {
  const targets = await db.select({ ucenikId: zadaceUceniciTable.ucenikId })
    .from(zadaceUceniciTable).where(eq(zadaceUceniciTable.zadacaId, zadacaId));
  if (targets.length > 0) return targets.map(t => t.ucenikId);
  const grupa = await db.select({ userId: ucenikProfiliTable.userId })
    .from(ucenikProfiliTable)
    .where(and(eq(ucenikProfiliTable.grupaId, grupaId), eq(ucenikProfiliTable.isArchived, false)));
  return grupa.map(g => g.userId);
}

// GET /api/muallim/zadace/:id/pregled — cijela grupa + status po učeniku.
// Muallim iz jednog panela pregleda i ocjenjuje zadaću za sve učenike.
router.get("/zadace/:id/pregled", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [zadaca] = await db.select().from(zadaceTable)
      .where(and(eq(zadaceTable.id, id), eq(zadaceTable.muallimId, req.user!.userId)));
    if (!zadaca) { res.status(404).json({ error: "Zadaća nije pronađena" }); return; }

    const recipientIds = await resolveZadacaRecipients(id, zadaca.grupaId);
    if (recipientIds.length === 0) { res.json({ zadaca, ucenici: [] }); return; }

    const korisnici = await db.select({ id: usersTable.id, displayName: usersTable.displayName, username: usersTable.username })
      .from(usersTable).where(inArray(usersTable.id, recipientIds));
    const statusi = await db.select().from(zadaceStatusTable).where(eq(zadaceStatusTable.zadacaId, id));
    const statusMap = new Map(statusi.map(s => [s.ucenikId, s]));

    const ucenici = korisnici
      .map(u => {
        const s = statusMap.get(u.id);
        return {
          ucenikId: u.id,
          displayName: u.displayName,
          username: u.username,
          uradjeno: s?.uradjeno ?? false,
          ocjena: s?.ocjena ?? null,
          kapiMeda: s?.kapiMeda ?? 0,
          noviRok: s?.noviRok ?? null,
          prolongCount: s?.prolongCount ?? 0,
          status: s?.status ?? "na_cekanju",
        };
      })
      .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || "", "bs"));

    res.json({ zadaca, ucenici });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/ucenik/:id/zadace — pregled svih zadaća jednog učenika
// (read-only): aktivne grupne + pojedinačne zadaće sa statusom tog učenika.
router.get("/ucenik/:id/zadace", async (req, res) => {
  try {
    const muallimId = req.user!.userId;
    const ucenikId = parseInt(req.params.id);
    if (!ucenikId) { res.status(400).json({ error: "ID učenika nevalidan" }); return; }

    // Vlasništvo: učenik mora biti u grupi ovog muallima (admin zaobilazi).
    const [profil] = await db.select().from(ucenikProfiliTable)
      .where(req.user!.role === "admin"
        ? eq(ucenikProfiliTable.userId, ucenikId)
        : and(eq(ucenikProfiliTable.userId, ucenikId), eq(ucenikProfiliTable.muallimId, muallimId)));
    if (!profil) { res.status(403).json({ error: "Učenik nije vaš" }); return; }
    if (!profil.grupaId) { res.json([]); return; }

    const grupneZadace = await db.select().from(zadaceTable)
      .where(and(
        eq(zadaceTable.grupaId, profil.grupaId),
        eq(zadaceTable.isActive, true),
        gte(zadaceTable.createdAt, currentSchoolYearResetTimestamp()),
      ))
      .orderBy(desc(zadaceTable.createdAt));
    if (grupneZadace.length === 0) { res.json([]); return; }

    const targets = await db.select().from(zadaceUceniciTable)
      .where(inArray(zadaceUceniciTable.zadacaId, grupneZadace.map(z => z.id)));
    const targetMap = new Map<number, Set<number>>();
    for (const t of targets) {
      if (!targetMap.has(t.zadacaId)) targetMap.set(t.zadacaId, new Set());
      targetMap.get(t.zadacaId)!.add(t.ucenikId);
    }

    // Vidljive ovom učeniku: bez targeta = cijela grupa; inače mora biti adresat.
    const visible = grupneZadace.filter(z => {
      const targeted = targetMap.get(z.id);
      if (!targeted) return true;
      return targeted.has(ucenikId);
    });
    if (visible.length === 0) { res.json([]); return; }

    const statusi = await db.select().from(zadaceStatusTable).where(and(
      inArray(zadaceStatusTable.zadacaId, visible.map(z => z.id)),
      eq(zadaceStatusTable.ucenikId, ucenikId),
    ));
    const statusMap = new Map(statusi.map(s => [s.zadacaId, s]));
    const today = new Date().toISOString().split("T")[0];

    const withStatus = visible.map(z => {
      const s = statusMap.get(z.id);
      const status = s?.status ?? "na_cekanju";
      const efektivniRok = s?.noviRok ?? z.rokDo ?? null;
      const kategorija = status === "zavrseno" ? "zavrsene" : "aktivne";
      const istekao = !!(efektivniRok && efektivniRok < today);
      return {
        ...z,
        efektivniRok,
        status,
        uradjeno: s?.uradjeno ?? false,
        ocjena: s?.ocjena ?? null,
        kapiMeda: s?.kapiMeda ?? 0,
        noviRok: s?.noviRok ?? null,
        prolongCount: s?.prolongCount ?? 0,
        istekao,
        kategorija,
      };
    });

    res.json(withStatus);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/muallim/zadace/:id/status/:ucenikId — upsert status jednog učenika.
// Body: { uradjeno?, ocjena?, kapiMeda?, noviRok?, oznaciZavrseno? }
router.put("/zadace/:id/status/:ucenikId", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const ucenikId = parseInt(req.params.ucenikId);
    const { uradjeno, ocjena, kapiMeda, noviRok, oznaciZavrseno } = req.body;

    const [zadaca] = await db.select().from(zadaceTable)
      .where(and(eq(zadaceTable.id, id), eq(zadaceTable.muallimId, req.user!.userId)));
    if (!zadaca) { res.status(404).json({ error: "Zadaća nije pronađena" }); return; }

    // Učenik mora biti stvarni adresat ove zadaće (spriječi pisanje statusa /
    // dodjelu hasanata proizvoljnim korisnicima).
    const recipientIds = await resolveZadacaRecipients(id, zadaca.grupaId);
    if (!recipientIds.includes(ucenikId)) {
      res.status(403).json({ error: "Učenik nije adresat ove zadaće" });
      return;
    }

    const [postojeci] = await db.select().from(zadaceStatusTable)
      .where(and(eq(zadaceStatusTable.zadacaId, id), eq(zadaceStatusTable.ucenikId, ucenikId)));

    const prevKapi = postojeci?.kapiMeda ?? 0;
    const newKapi = Number.isFinite(Number(kapiMeda)) ? Math.max(0, Math.trunc(Number(kapiMeda))) : prevKapi;
    const prevNoviRok = postojeci?.noviRok ?? null;
    const noviRokVal = noviRok ? String(noviRok) : null;
    // prolongacija raste kad muallim postavi NOVI (drugačiji, neprazan) rok
    const prolong = (noviRokVal && noviRokVal !== prevNoviRok)
      ? (postojeci?.prolongCount ?? 0) + 1
      : (postojeci?.prolongCount ?? 0);
    const ocjenaVal = ocjena === null || ocjena === undefined || ocjena === ""
      ? null
      : Math.min(6, Math.max(1, Math.trunc(Number(ocjena))));
    const statusVal = oznaciZavrseno === true ? "zavrseno"
      : oznaciZavrseno === false ? "na_cekanju"
      : (postojeci?.status ?? "na_cekanju");
    // Završavanje je nezavisno od ocjene. Muallim može zadaću označiti
    // završenom i bez dodijeljene ocjene, a učenik je odmah vidi u svom
    // tabu "Završene".
    const uradjenoVal = statusVal === "zavrseno"
      ? true
      : typeof uradjeno === "boolean" ? uradjeno : (postojeci?.uradjeno ?? false);

    const values = {
      zadacaId: id,
      ucenikId,
      uradjeno: uradjenoVal,
      ocjena: ocjenaVal,
      kapiMeda: newKapi,
      noviRok: noviRokVal,
      prolongCount: prolong,
      status: statusVal,
      reviewedAt: statusVal === "zavrseno" ? new Date() : (postojeci?.reviewedAt ?? null),
      muallimId: req.user!.userId,
      updatedAt: new Date(),
    };

    let saved;
    if (postojeci) {
      [saved] = await db.update(zadaceStatusTable).set(values)
        .where(eq(zadaceStatusTable.id, postojeci.id)).returning();
    } else {
      [saved] = await db.insert(zadaceStatusTable).values(values).returning();
    }

    // Ocjena iz zadaće se evidentira i u tabeli ocjene (kategorija "zadaća"),
    // da se vidi među redovnim ocjenama učenika. Upsert preko zadaca_id —
    // ponovna ocjena ažurira isti red; brisanje ocjene uklanja red.
    let ocjeneSyncOk = true;
    try {
      const [postojecaOcjena] = await db.select({ id: ocjeneTable.id }).from(ocjeneTable)
        .where(and(eq(ocjeneTable.zadacaId, id), eq(ocjeneTable.ucenikId, ucenikId)));
      if (ocjenaVal === null) {
        if (postojecaOcjena) {
          await db.delete(ocjeneTable).where(eq(ocjeneTable.id, postojecaOcjena.id));
        }
      } else {
        const ocjenaNaziv = zadaca.lekcijaNaslov || zadaca.naslov || null;
        const ocjenaDatum = new Date().toISOString().slice(0, 10);
        if (postojecaOcjena) {
          await db.update(ocjeneTable).set({
            ocjena: ocjenaVal,
            lekcijaNaziv: ocjenaNaziv,
            grupaId: zadaca.grupaId,
            muallimId: req.user!.userId,
          }).where(eq(ocjeneTable.id, postojecaOcjena.id));
        } else {
          await db.insert(ocjeneTable).values({
            ucenikId,
            muallimId: req.user!.userId,
            grupaId: zadaca.grupaId,
            kategorija: "zadaća",
            ocjena: ocjenaVal,
            lekcijaNaziv: ocjenaNaziv,
            napomena: null,
            datum: ocjenaDatum,
            zadacaId: id,
          });
        }
      }
    } catch (ocErr) {
      ocjeneSyncOk = false;
      console.error("[zadaca ocjena->ocjene]", ocErr);
    }

    // Obavijesti roditelje kad zadaća dobije NOVU ili promijenjenu ocjenu.
    // Šaljemo samo ako je ocjena uspješno upisana u tabelu ocjene, da roditelj
    // ne dobije obavijest za ocjenu koja se neće prikazati u njihovom panelu.
    const prevOcjena = postojeci?.ocjena ?? null;
    if (ocjeneSyncOk && ocjenaVal !== null && ocjenaVal !== prevOcjena) {
      (async () => {
        const [dijete] = await db
          .select({ displayName: usersTable.displayName })
          .from(usersTable)
          .where(eq(usersTable.id, ucenikId));
        const ime = dijete?.displayName || "vaše dijete";
        const lekcija = zadaca.lekcijaNaslov || zadaca.naslov || "";
        await notifyApprovedRoditelji({
          ucenikId,
          posiljateljId: req.user!.userId,
          naslov: `Nova ocjena za ${ime}`,
          sadrzaj: lekcija
            ? `Vaše dijete ${ime} je dobilo ocjenu ${ocjenaVal} iz zadaće "${lekcija}".`
            : `Vaše dijete ${ime} je dobilo ocjenu ${ocjenaVal} iz zadaće.`,
          logTag: "zadaca-ocjena-notify",
          pushData: { type: "ocjena", zadacaId: id },
        });
      })().catch(err => console.error("[zadaca-ocjena-notify] background notify failed", err));
    }

    // Kapi meda (znanjska valuta = total_hasanat) — primijeni samo razliku
    // da ponovno spremanje ne duplira nagradu.
    const delta = newKapi - prevKapi;
    if (delta !== 0) {
      const studentIdStr = String(ucenikId);
      try {
        await db.execute(sql`
          INSERT INTO student_progress (student_id, total_hasanat, total_med, completed_lessons, badges, streak_days, last_activity_date, created_at, updated_at)
          VALUES (${studentIdStr}, ${Math.max(0, delta)}, 0, '[]'::jsonb, '[]'::jsonb, 0, NULL, NOW(), NOW())
          ON CONFLICT (student_id) DO UPDATE
            SET total_hasanat = GREATEST(0, student_progress.total_hasanat + ${delta}),
                updated_at = NOW()
        `);
      } catch (medErr) {
        console.error("[zadaca kapi meda]", medErr);
      }
    }

    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/zadace-pregled-badge — broj zadaća kojima je rok prošao
// a nisu sve pregledane (status != zavrseno). Crvena notifikacija.
router.get("/zadace-pregled-badge", async (req, res) => {
  try {
    const grupaId = req.query.grupaId ? parseInt(req.query.grupaId as string) : undefined;
    const today = new Date().toISOString().split("T")[0];
    const baseWhere = grupaId
      ? and(
          eq(zadaceTable.muallimId, req.user!.userId),
          eq(zadaceTable.grupaId, grupaId),
          eq(zadaceTable.isActive, true),
          gte(zadaceTable.createdAt, currentSchoolYearResetTimestamp()),
        )
      : and(
          eq(zadaceTable.muallimId, req.user!.userId),
          eq(zadaceTable.isActive, true),
          gte(zadaceTable.createdAt, currentSchoolYearResetTimestamp()),
        );
    const zadace = await db.select().from(zadaceTable).where(baseWhere);
    if (zadace.length === 0) { res.json({ count: 0 }); return; }

    // Status rows samo za ove zadaće, indeksirano po (zadacaId, ucenikId).
    const statusi = await db.select().from(zadaceStatusTable)
      .where(inArray(zadaceStatusTable.zadacaId, zadace.map(z => z.id)));
    const statusMap = new Map<string, typeof statusi[number]>();
    for (const s of statusi) statusMap.set(`${s.zadacaId}:${s.ucenikId}`, s);

    let count = 0;
    for (const z of zadace) {
      const recipients = await resolveZadacaRecipients(z.id, z.grupaId);
      if (recipients.length === 0) continue;
      // Zadaća se broji ako bar jedan adresat ima prošli EFEKTIVNI rok
      // (per-učenik noviRok ?? zadaca.rokDo) a nije označen završenim.
      const hasOverdueUnreviewed = recipients.some(uid => {
        const s = statusMap.get(`${z.id}:${uid}`);
        const efektivni = s?.noviRok ?? z.rokDo;
        if (!efektivni || efektivni >= today) return false;
        return (s?.status ?? "na_cekanju") !== "zavrseno";
      });
      if (hasOverdueUnreviewed) count++;
    }
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// ── BULK RESET ŠIFRI — SAMO GLAVNI MUALLIM ────────────────────────────────────
// POST /api/muallim/bulk-reset-passwords
// Resetuje sve šifre učenika i roditelja u mektebu na standardnu Mekteb<broj>.
// Samo glavni muallim može pokrenuti ovu operaciju.
router.post("/bulk-reset-passwords", async (req, res) => {
  try {
    const ctx = await getMektebCtx(req.user!.userId);
    if (!ctx?.isGlavni || !ctx.mektebId) {
      res.status(403).json({ error: "Samo glavni muallim može resetirati sve šifre" });
      return;
    }

    const mektebId = ctx.mektebId;

    // Svi aktivni učenici u mektebu — DVA načina jer stariji nalozi imaju mekteb_id = NULL:
    // 1. Direktno: ucenik_profili.mekteb_id = mektebId
    // 2. Indirektno: ucenik_profili.muallim_id je muallim koji pripada ovom mektebu
    const ucenikProfili = await db.execute(sql`
      SELECT DISTINCT up.user_id AS "userId"
      FROM ucenik_profili up
      WHERE up.is_archived = false
        AND (
          up.mekteb_id = ${mektebId}
          OR up.muallim_id IN (
            SELECT user_id FROM muallim_profili WHERE mekteb_id = ${mektebId}
          )
        )
    `);

    const ucenikIds = (ucenikProfili.rows as Array<{ userId: number }>).map(p => p.userId);
    if (ucenikIds.length === 0) {
      res.json({ ok: true, resetovano: 0 });
      return;
    }

    // Dohvati user zapise za učenike
    const ucenikUsers = await db.select({ id: usersTable.id, username: usersTable.username, role: usersTable.role })
      .from(usersTable)
      .where(and(inArray(usersTable.id, ucenikIds), eq(usersTable.role, "ucenik")));

    // Dohvati roditelje ovih učenika (preko roditelj_ucenik tabele)
    const roditeljVeze = await db.select({ roditeljId: roditeljUcenikTable.roditeljId })
      .from(roditeljUcenikTable)
      .where(inArray(roditeljUcenikTable.ucenikId, ucenikIds));

    const roditeljIds = [...new Set(roditeljVeze.map(v => v.roditeljId))];
    const roditeljUsers = roditeljIds.length > 0
      ? await db.select({ id: usersTable.id, username: usersTable.username, role: usersTable.role })
          .from(usersTable)
          .where(and(inArray(usersTable.id, roditeljIds), eq(usersTable.role, "roditelj")))
      : [];

    const sviKorisnici = [...ucenikUsers, ...roditeljUsers]
      .filter(u => !u.username.toLowerCase().startsWith("demo."));

    // Resetuj šifre (bcrypt je spor — radimo sekvencijalno da ne overloadamo server)
    let resetovano = 0;
    for (const user of sviKorisnici) {
      const newPassword = passwordFromUsername(user.username, user.id);
      const hash = await bcrypt.hash(newPassword, 10);
      await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.id, user.id));
      resetovano++;
    }

    res.json({ ok: true, resetovano });
  } catch (err) {
    console.error("Bulk reset passwords error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// ── RESET ŠIFRE 1 UČENIKA ──────────────────────────────────────────────────────

// POST /api/muallim/ucenik/:id/reset-password
router.post("/ucenik/:id/reset-password", async (req, res) => {
  try {
    const ucenikId = parseInt(req.params.id);
    if (!ucenikId) { res.status(400).json({ error: "id obavezan" }); return; }

    const [profil] = await db.select().from(ucenikProfiliTable)
      .where(and(eq(ucenikProfiliTable.userId, ucenikId), eq(ucenikProfiliTable.muallimId, req.user!.userId)));
    if (!profil && req.user!.role !== "admin") { res.status(403).json({ error: "Nije vaš učenik" }); return; }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, ucenikId));
    if (!user || user.role !== "ucenik") { res.status(404).json({ error: "Učenik ne postoji" }); return; }
    if (user.username.toLowerCase().startsWith("demo.")) {
      res.status(403).json({ error: "Demo nalozima nije dozvoljena promjena šifre." });
      return;
    }

    // "Resetiraj šifru" UVIJEK vraća na standardnu/izvornu lozinku izvedenu iz
    // korisničkog imena (Mekteb<broj>) — ista koja se printa na kartici i koju
    // dijeli par učenik/roditelj. Nema nasumičnih ni custom lozinki, da prijava
    // i odštampana kartica uvijek budu usklađeni.
    const newPassword = passwordFromUsername(user.username, user.id);
    const hash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.id, ucenikId));

    res.json({ ok: true, newPassword, displayName: user.displayName, username: user.username });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// ── IZVJEŠTAJI ─────────────────────────────────────────────────────────────────

async function buildUcenikIzvjestaj(ucenikId: number, muallimId?: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, ucenikId));
  if (!user) return null;

  const [profil] = await db.select().from(ucenikProfiliTable).where(and(
    eq(ucenikProfiliTable.userId, ucenikId),
    eq(ucenikProfiliTable.isArchived, false),
  ));
  let grupa = null as { id: number; naziv: string } | null;
  if (profil?.grupaId) {
    const [g] = await db.select().from(grupeTable).where(eq(grupeTable.id, profil.grupaId));
    if (g) grupa = { id: g.id, naziv: g.naziv };
  }

  // Konstrasti po muallimId ako je dat (sprječava cross-muallim leak istorije ocjena/prisustva).
  // Kvizovi su sistemski (nemaju muallimId) — uvijek po userId.
  const prisustvoWhere = muallimId
    ? and(eq(priustvoTable.ucenikId, ucenikId), eq(priustvoTable.muallimId, muallimId))
    : eq(priustvoTable.ucenikId, ucenikId);
  const ocjeneWhere = muallimId
    ? and(eq(ocjeneTable.ucenikId, ucenikId), eq(ocjeneTable.muallimId, muallimId))
    : eq(ocjeneTable.ucenikId, ucenikId);

  const [prisustvo, ocjene, kvizRezultati, napredak, zvjezdiceMap] = await Promise.all([
    db.select().from(priustvoTable).where(prisustvoWhere).orderBy(asc(priustvoTable.datum)),
    db.select().from(ocjeneTable).where(ocjeneWhere).orderBy(desc(ocjeneTable.datum)),
    db.select().from(kvizRezultatiTable).where(eq(kvizRezultatiTable.userId, ucenikId)).orderBy(desc(kvizRezultatiTable.completedAt)),
    db.select({ id: korisnikNapredakTable.id }).from(korisnikNapredakTable)
      .where(and(eq(korisnikNapredakTable.userId, ucenikId), eq(korisnikNapredakTable.zavrsen, true))),
    getZvjezdiceZaUcenike([ucenikId]),
  ]);

  return {
    ucenik: { id: user.id, displayName: user.displayName, username: user.username },
    grupaNaziv: grupa?.naziv || null,
    grupaId: grupa?.id || null,
    prisustvo: prisustvo.filter(p => isFromCurrentSchoolYear(p.datum)),
    ocjene: ocjene.filter(o => isFromCurrentSchoolYear(o.datum)),
    kvizRezultati,
    zavrseneLekcijeBroj: napredak.length,
    zvjezdicePozitivne: zvjezdiceMap.get(ucenikId)?.pozitivne ?? 0,
    zvjezdiceNegativne: zvjezdiceMap.get(ucenikId)?.negativne ?? 0,
  };
}

async function buildMektebHeader(muallimId: number) {
  const [muallim] = await db.select().from(usersTable).where(eq(usersTable.id, muallimId));
  const [profil] = await db.select().from(muallimProfiliTable).where(eq(muallimProfiliTable.userId, muallimId));
  let mektebNaziv: string | null = null;
  if (profil?.mektebId) {
    const [mekteb] = await db.select().from(mektebiTable).where(eq(mektebiTable.id, profil.mektebId));
    mektebNaziv = mekteb?.naziv || null;
  }
  return {
    muallimDisplayName: muallim?.displayName || "Muallim",
    mektebNaziv,
    skolskaGodina: profil?.tekucaSkolskaGodina || null,
  };
}

// GET /api/muallim/izvjestaj/ucenik/:id
router.get("/izvjestaj/ucenik/:id", async (req, res) => {
  try {
    const ucenikId = parseInt(req.params.id);
    if (!ucenikId) { res.status(400).json({ error: "id obavezan" }); return; }

    const [profil] = await db.select().from(ucenikProfiliTable)
      .where(and(eq(ucenikProfiliTable.userId, ucenikId), eq(ucenikProfiliTable.muallimId, req.user!.userId)));
    if (!profil && req.user!.role !== "admin") { res.status(403).json({ error: "Nije vaš učenik" }); return; }

    // Admin vidi sve istorije; muallim samo svoju (filtrira ocjene+prisustvo).
    const filterMuallimId = req.user!.role === "admin" ? undefined : req.user!.userId;
    const data = await buildUcenikIzvjestaj(ucenikId, filterMuallimId);
    if (!data) { res.status(404).json({ error: "Učenik ne postoji" }); return; }

    const header = await buildMektebHeader(req.user!.userId);
    res.json({
      ...header,
      tip: "ucenik" as const,
      naslov: data.ucenik.displayName,
      podnaslov: data.grupaNaziv ? `Grupa: ${data.grupaNaziv}` : null,
      ucenici: [data],
    });
  } catch (err) {
    console.error("Izvjestaj ucenik error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/izvjestaj/grupa/:id
router.get("/izvjestaj/grupa/:id", async (req, res) => {
  try {
    const grupaId = parseInt(req.params.id);
    if (!grupaId) { res.status(400).json({ error: "id obavezan" }); return; }

    const grupa = await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role);
    if (!grupa) { res.status(403).json({ error: "Nije vaša grupa" }); return; }

    const profili = await db.select().from(ucenikProfiliTable).where(eq(ucenikProfiliTable.grupaId, grupaId));
    // Filtriraj ocjene/prisustvo po vlasniku grupe (sprječava miks istorija drugih muallima).
    const filterMuallimId = grupa.muallimId;
    const izvjestaji = (await Promise.all(profili.map(p => buildUcenikIzvjestaj(p.userId, filterMuallimId))))
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const header = await buildMektebHeader(req.user!.userId);
    res.json({
      ...header,
      tip: "grupa" as const,
      naslov: `Grupa: ${grupa.naziv}`,
      podnaslov: header.skolskaGodina,
      grupaNaziv: grupa.naziv,
      grupaId: grupa.id,
      ucenici: izvjestaji,
    });
  } catch (err) {
    console.error("Izvjestaj grupa error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/izvjestaj/svi
router.get("/izvjestaj/svi", async (req, res) => {
  try {
    const muallimId = await resolveViewMuallimId(req);
    if (!muallimId) { res.status(403).json({ error: "Pregled muallima nije dozvoljen" }); return; }
    const ctx = await getMektebCtx(muallimId);
    const scopedView = Boolean(req.query.muallimId);
    let grupaIds: number[] = [];

    if (req.user!.role === "admin") {
      const rows = await db.select({ id: grupeTable.id }).from(grupeTable)
        .where(and(
          sql`COALESCE(is_archived, false) = false`,
          sql`COALESCE(is_active, true) = true`,
        ));
      grupaIds = rows.map(g => g.id);
    } else if (ctx?.isGlavni && ctx.mektebId && !scopedView) {
      const rows = await db.execute(sql`
        SELECT g.id
        FROM grupe g
        JOIN muallim_profili mp ON mp.user_id = g.muallim_id
        WHERE mp.mekteb_id = ${ctx.mektebId}
          AND COALESCE(g.is_archived, false) = false
          AND COALESCE(g.is_active, true) = true
      `);
      grupaIds = (rows.rows as Array<{ id: number }>).map(g => g.id);
    } else {
      const rows = await db.select({ id: grupeTable.id }).from(grupeTable)
        .where(and(
          eq(grupeTable.muallimId, muallimId),
          sql`COALESCE(is_archived, false) = false`,
          sql`COALESCE(is_active, true) = true`,
        ));
      grupaIds = rows.map(g => g.id);
    }

    const profili = grupaIds.length > 0
      ? await db.select().from(ucenikProfiliTable).where(and(
          inArray(ucenikProfiliTable.grupaId, grupaIds),
          eq(ucenikProfiliTable.isArchived, false),
        ))
      : [];
    // Globalni izvještaj ne prikazuje grupe, ali podaci pripadaju samo
    // aktivnim učenicima iz dozvoljenog skupa grupa.
    const izvjestaji = (await Promise.all(profili.map(async p => {
      const r = await buildUcenikIzvjestaj(p.userId, req.user!.role === "admin" ? undefined : (p.muallimId ?? undefined));
      return r ? { ...r, muallimId: p.muallimId ?? null } : null;
    })))
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // Nivo izvještaja: mektebski (glavni muallim bez scope-a) prikazuje zbirni
    // red po MUALLIMU, muallimski prikazuje zbirni red po GRUPI.
    const mektebNivo = Boolean(ctx?.isGlavni && ctx.mektebId && !scopedView && req.user!.role !== "admin");
    const muallimIdsUReportu = [...new Set(izvjestaji.map(u => u.muallimId).filter((x): x is number => x != null))];
    const muallimNames = muallimIdsUReportu.length > 0
      ? await db.select({ id: usersTable.id, displayName: usersTable.displayName })
          .from(usersTable).where(inArray(usersTable.id, muallimIdsUReportu))
      : [];
    const muallimNameMap = new Map(muallimNames.map(u => [u.id, u.displayName]));
    const ucenici = izvjestaji.map(u => ({
      ...u,
      muallimNaziv: u.muallimId != null ? (muallimNameMap.get(u.muallimId) ?? null) : null,
    }));

    const header = await buildMektebHeader(muallimId);
    res.json({
      ...header,
      tip: "svi" as const,
      nivo: mektebNivo ? ("mekteb" as const) : ("muallim" as const),
      naslov: mektebNivo ? "Cijeli mekteb" : "Sve moje grupe",
      podnaslov: header.skolskaGodina,
      ucenici,
    });
  } catch (err) {
    console.error("Izvjestaj svi error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// OBAVJEŠTENJA (Story za roditelje)
// ══════════════════════════════════════════════════════════════════════════════

// Ciljane grupe obavještenja (join tabela obavjestenja_grupe iz residual
// scheme). Stara jednogrupna obavještenja i dalje nose obavjestenja.grupa_id,
// pa se oba izvora spajaju. Prazan skup = "svi roditelji".
async function ucitajGrupeObavjestenja(ids: number[]): Promise<Map<number, number[]>> {
  const map = new Map<number, number[]>();
  if (ids.length === 0) return map;
  const rows = await db.execute<{ obavjestenje_id: number; grupa_id: number }>(sql`
    SELECT obavjestenje_id, grupa_id FROM obavjestenja_grupe
    WHERE obavjestenje_id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})
    ORDER BY grupa_id
  `);
  for (const row of rows.rows) {
    const arr = map.get(row.obavjestenje_id);
    if (arr) arr.push(row.grupa_id);
    else map.set(row.obavjestenje_id, [row.grupa_id]);
  }
  return map;
}

// Upisuje skup ciljanih grupa za jedno obavještenje (replace semantika).
async function upisiGrupeObavjestenja(obavjestenjeId: number, grupaIds: number[]) {
  await db.execute(sql`DELETE FROM obavjestenja_grupe WHERE obavjestenje_id = ${obavjestenjeId}`);
  if (grupaIds.length === 0) return;
  await db.execute(sql`
    INSERT INTO obavjestenja_grupe (obavjestenje_id, grupa_id)
    VALUES ${sql.join(grupaIds.map(gid => sql`(${obavjestenjeId}, ${gid})`), sql`, `)}
    ON CONFLICT DO NOTHING
  `);
}

// Normalizuje ulaz (grupaIds[] ili legacy grupaId) i provjerava da su sve
// grupe zaista muallimove — bez toga bi se moglo objaviti u tuđu grupu.
async function razrijesiCiljaneGrupe(
  body: { grupaIds?: unknown; grupaId?: unknown },
  muallimId: number,
): Promise<{ ok: true; grupaIds: number[] } | { ok: false; error: string }> {
  const raw = Array.isArray(body.grupaIds)
    ? body.grupaIds
    : (body.grupaId ? [body.grupaId] : []);
  const ids = [...new Set(raw.map(v => Number(v)).filter(v => Number.isInteger(v) && v > 0))];
  if (ids.length === 0) return { ok: true, grupaIds: [] };
  const grupe = await db.select().from(grupeTable)
    .where(and(inArray(grupeTable.id, ids), eq(grupeTable.muallimId, muallimId)));
  if (grupe.length !== ids.length) return { ok: false, error: "Grupa nije pronađena" };
  return { ok: true, grupaIds: ids };
}

router.get("/obavjestenja", async (req, res) => {
  try {
    const rows = await db.select().from(obavjestenjaTable)
      .where(and(
        eq(obavjestenjaTable.muallimId, req.user!.userId),
        gte(obavjestenjaTable.createdAt, currentSchoolYearResetTimestamp()),
      ))
      .orderBy(desc(obavjestenjaTable.createdAt));
    const grupeAll = await db.select().from(grupeTable)
      .where(and(
        eq(grupeTable.muallimId, req.user!.userId),
        sql`COALESCE(is_archived, false) = false`,
        sql`COALESCE(is_active, true) = true`,
      ));
    const grupaMap = Object.fromEntries(grupeAll.map(g => [g.id, g.naziv]));
    const grupeMap = await ucitajGrupeObavjestenja(rows.map(r => r.id));
    res.json(rows.map(r => {
      const grupaIds = grupeMap.get(r.id) ?? (r.grupaId ? [r.grupaId] : []);
      return {
        ...r,
        grupaIds,
        grupaNazivi: grupaIds.map(gid => grupaMap[gid]).filter(Boolean),
        grupaNaziv: r.grupaId ? grupaMap[r.grupaId] || null : null,
      };
    }));
  } catch (err) {
    console.error("obavjestenja list error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

router.post("/obavjestenja", async (req, res) => {
  try {
    const { naslov, sadrzaj, slikaUrl } = req.body;
    if (!naslov?.trim() || !sadrzaj?.trim()) {
      res.status(400).json({ error: "Naslov i sadržaj su obavezni" });
      return;
    }
    const ciljane = await razrijesiCiljaneGrupe(req.body, req.user!.userId);
    if (!ciljane.ok) { res.status(400).json({ error: ciljane.error }); return; }
    const grupaIds = ciljane.grupaIds;
    const [row] = await db.insert(obavjestenjaTable).values({
      muallimId: req.user!.userId,
      // Legacy kolona: puni se samo kad je tačno jedna grupa, da stari klijenti
      // i dalje vide ispravan cilj. Puni skup živi u obavjestenja_grupe.
      grupaId: grupaIds.length === 1 ? grupaIds[0] : null,
      naslov: naslov.trim(),
      sadrzaj: sadrzaj.trim(),
      slikaUrl: slikaUrl || null,
    }).returning();
    await upisiGrupeObavjestenja(row.id, grupaIds);

    const profili = await db.select().from(ucenikProfiliTable)
      .where(eq(ucenikProfiliTable.muallimId, req.user!.userId));
    const targetUcenikIds = grupaIds.length > 0
      ? profili.filter(p => p.grupaId != null && grupaIds.includes(p.grupaId)).map(p => p.userId)
      : profili.map(p => p.userId);
    if (targetUcenikIds.length > 0) {
      const links = await db.select().from(roditeljUcenikTable)
        .where(and(
          inArray(roditeljUcenikTable.ucenikId, targetUcenikIds),
          eq(roditeljUcenikTable.status, "approved"),
        ));
      const roditeljIds = [...new Set(links.map(l => l.roditeljId))];
      if (roditeljIds.length > 0) {
        const poruke = roditeljIds.map(rid => ({
          posiljateljId: req.user!.userId,
          primateljId: rid,
          naslov: "Novo obavještenje",
          sadrzaj: `📢 ${naslov.trim()}`,
        }));
        await db.insert(porukeTable).values(poruke).catch(e =>
          console.warn("[obavjestenja] poruka insert failed:", e)
        );
        try {
          await sendPushNotification({
            userIds: roditeljIds,
            title: "Novo obavještenje",
            body: naslov.trim(),
            url: "/roditelj?tab=obavjestenja",
          });
        } catch {}
      }
    }

    res.json(row);
  } catch (err) {
    console.error("obavjestenja create error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

router.put("/obavjestenja/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { naslov, sadrzaj, slikaUrl } = req.body;
    const [existing] = await db.select().from(obavjestenjaTable)
      .where(and(eq(obavjestenjaTable.id, id), eq(obavjestenjaTable.muallimId, req.user!.userId)));
    if (!existing) { res.status(404).json({ error: "Nije pronađeno" }); return; }
    // Skup grupa se dira samo ako ga klijent pošalje; inače ostaje kakav jest.
    const mijenjaGrupe = req.body.grupaIds !== undefined || req.body.grupaId !== undefined;
    let noveGrupe: number[] = [];
    if (mijenjaGrupe) {
      const ciljane = await razrijesiCiljaneGrupe(req.body, req.user!.userId);
      if (!ciljane.ok) { res.status(400).json({ error: ciljane.error }); return; }
      noveGrupe = ciljane.grupaIds;
    }
    const [updated] = await db.update(obavjestenjaTable)
      .set({
        naslov: naslov?.trim() || existing.naslov,
        sadrzaj: sadrzaj?.trim() || existing.sadrzaj,
        grupaId: mijenjaGrupe ? (noveGrupe.length === 1 ? noveGrupe[0] : null) : existing.grupaId,
        slikaUrl: slikaUrl !== undefined ? (slikaUrl || null) : existing.slikaUrl,
        updatedAt: new Date(),
      })
      .where(eq(obavjestenjaTable.id, id))
      .returning();
    if (mijenjaGrupe) await upisiGrupeObavjestenja(id, noveGrupe);
    const grupeMap = await ucitajGrupeObavjestenja([id]);
    res.json({ ...updated, grupaIds: grupeMap.get(id) ?? [] });
  } catch (err) {
    console.error("obavjestenja update error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

router.delete("/obavjestenja/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(obavjestenjaTable)
      .where(and(eq(obavjestenjaTable.id, id), eq(obavjestenjaTable.muallimId, req.user!.userId)));
    if (!existing) { res.status(404).json({ error: "Nije pronađeno" }); return; }
    // Join tabela nema FK cascade (kreirana kroz residual SQL) — čisti ručno.
    await db.execute(sql`DELETE FROM obavjestenja_grupe WHERE obavjestenje_id = ${id}`);
    await db.delete(obavjestenjaTable).where(eq(obavjestenjaTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error("obavjestenja delete error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

router.get("/roditelji-lista", async (req, res) => {
  try {
    const userId = await resolveViewMuallimId(req);
    if (!userId) { res.status(403).json({ error: "Pregled muallima nije dozvoljen" }); return; }
    const ctx = await getMektebCtx(userId);
    const scopedView = Boolean(req.query.muallimId);

    let profili: any[];
    let grupeAll: any[];
    let muallimUserMap: Record<number, string> = {};

    if (ctx?.isGlavni && ctx.mektebId && !scopedView) {
      // Glavni muallim — svi učenici džemata
      const rows = await db.execute(sql`
        SELECT up.*, mu.display_name AS muallim_display_name
        FROM ucenik_profili up
        JOIN muallim_profili mp ON mp.user_id = up.muallim_id
        JOIN users mu ON mu.id = up.muallim_id
        WHERE mp.mekteb_id = ${ctx.mektebId}
      `);
      profili = rows.rows as any[];
      for (const r of profili as any[]) {
        if (r.muallim_id) muallimUserMap[r.muallim_id] = r.muallim_display_name || "";
      }
      // Sve grupe džemata
      const grupeRows = await db.execute(sql`
        SELECT g.* FROM grupe g
        JOIN muallim_profili mp ON mp.user_id = g.muallim_id
        WHERE mp.mekteb_id = ${ctx.mektebId}
      `);
      grupeAll = grupeRows.rows as any[];
    } else {
      // Obični muallim — samo vlastiti učenici i grupe
      profili = await db.select().from(ucenikProfiliTable)
        .where(eq(ucenikProfiliTable.muallimId, userId));
      grupeAll = await db.select().from(grupeTable)
        .where(eq(grupeTable.muallimId, userId));
    }

    if (profili.length === 0) { res.json([]); return; }
    const ucenikIds = profili.map((p: any) => p.user_id ?? p.userId);

    const links = await db.select().from(roditeljUcenikTable)
      .where(and(
        inArray(roditeljUcenikTable.ucenikId, ucenikIds),
        eq(roditeljUcenikTable.status, "approved"),
      ));
    if (links.length === 0) { res.json([]); return; }

    const allUserIds = [...new Set([...links.map(l => l.roditeljId), ...ucenikIds])];
    const users = await db.select().from(usersTable)
      .where(inArray(usersTable.id, allUserIds));
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    // grupaMap: id → { naziv, daniNastave, vrijemeNastave, muallimId }
    const grupaMap: Record<number, { naziv: string; daniNastave: any; vrijemeNastave: string | null; muallimId: number | null }> = {};
    for (const g of grupeAll as any[]) {
      const gId = g.id;
      grupaMap[gId] = {
        naziv: g.naziv,
        daniNastave: g.dani_nastave ?? g.daniNastave ?? null,
        vrijemeNastave: g.vrijeme_nastave ?? g.vrijemeNastave ?? null,
        muallimId: g.muallim_id ?? g.muallimId ?? null,
      };
    }
    const profilMap: Record<number, any> = {};
    for (const p of profili as any[]) {
      const uid = p.user_id ?? p.userId;
      profilMap[uid] = p;
    }

    const roditeljMap = new Map<number, { roditelj: any; djeca: any[] }>();
    for (const link of links) {
      const roditelj = userMap[link.roditeljId];
      if (!roditelj) continue;
      if (!roditeljMap.has(link.roditeljId)) {
        roditeljMap.set(link.roditeljId, {
          roditelj: {
            id: roditelj.id,
            displayName: roditelj.displayName,
            username: roditelj.username,
            email: roditelj.email,
          },
          djeca: [],
        });
      }
      const ucenik = userMap[link.ucenikId];
      const profil = profilMap[link.ucenikId];
      const grupaId = profil?.grupa_id ?? profil?.grupaId;
      const grupaInfo = grupaId ? grupaMap[grupaId] : null;
      roditeljMap.get(link.roditeljId)!.djeca.push({
        id: link.ucenikId,
        displayName: ucenik?.displayName || `#${link.ucenikId}`,
        grupaId: grupaId ?? null,
        grupaNaziv: grupaInfo?.naziv ?? null,
        daniNastave: grupaInfo?.daniNastave ?? null,
        vrijemeNastave: grupaInfo?.vrijemeNastave ?? null,
        muallimDisplayName: grupaInfo?.muallimId ? (muallimUserMap[grupaInfo.muallimId] ?? null) : null,
      });
    }

    res.json(Array.from(roditeljMap.values()));
  } catch (err) {
    console.error("roditelji-lista error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// ── HARD DELETE UČENIKA ────────────────────────────────────────────────────────
// DELETE /api/muallim/ucenik/:id/hard
// Trajno briše učenika i sve njegove podatke (napredak, ocjene, prisustvo,
// veze sa roditeljima, certifikati, kvizovi, h5p pokušaji, zadaće-targeting).
// Provjera: učenik mora pripadati ovom muallimu (ili admin).
router.delete("/ucenik/:id/hard", async (req, res) => {
  try {
    const ucenikId = parseInt(req.params.id);
    if (!ucenikId) { res.status(400).json({ error: "id obavezan" }); return; }

    const [profil] = await db.select().from(ucenikProfiliTable)
      .where(eq(ucenikProfiliTable.userId, ucenikId));
    if (!profil) { res.status(404).json({ error: "Učenik nije pronađen" }); return; }

    if (req.user!.role !== "admin" && profil.muallimId !== req.user!.userId) {
      res.status(403).json({ error: "Nije vaš učenik" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, ucenikId));
    if (!user || user.role !== "ucenik") { res.status(404).json({ error: "Učenik ne postoji" }); return; }

    // Atomski: brisanje svih povezanih zapisa + dekrement licence u jednoj transakciji.
    await db.transaction(async (tx) => {
      await tx.delete(korisnikNapredakTable).where(eq(korisnikNapredakTable.userId, ucenikId));
      await tx.delete(ocjeneTable).where(eq(ocjeneTable.ucenikId, ucenikId));
      await tx.delete(priustvoTable).where(eq(priustvoTable.ucenikId, ucenikId));
      await tx.delete(zadaceUceniciTable).where(eq(zadaceUceniciTable.ucenikId, ucenikId));
      await tx.delete(roditeljUcenikTable).where(eq(roditeljUcenikTable.ucenikId, ucenikId));
      await tx.delete(kvizRezultatiTable).where(eq(kvizRezultatiTable.userId, ucenikId));
      await tx.delete(h5pPokusajiTable).where(eq(h5pPokusajiTable.userId, ucenikId));
      await tx.delete(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, ucenikId));
      await tx.delete(usersTable).where(eq(usersTable.id, ucenikId));

      // Ako učenik nije bio arhiviran, oslobodi licencni slot muallima koji ga je imao.
      if (!profil.isArchived && profil.muallimId !== null) {
        const muallimId = profil.muallimId;
        const [muallimProfil] = await tx.select().from(muallimProfiliTable)
          .where(eq(muallimProfiliTable.userId, muallimId));
        if (muallimProfil && muallimProfil.licencesUsed > 0) {
          await tx.update(muallimProfiliTable)
            .set({ licencesUsed: muallimProfil.licencesUsed - 1 })
            .where(eq(muallimProfiliTable.userId, muallimId));
        }
      }
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Hard delete učenika greška:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// ── RESET ŠIFRE RODITELJA ──────────────────────────────────────────────────────
// POST /api/muallim/roditelj/:id/reset-password
// Resetuje šifru roditelju koji je povezan sa nekim učenikom u muallimovoj grupi.
// UVIJEK vraća na standardnu lozinku Mekteb<broj> (izvedenu iz korisničkog imena).
router.post("/roditelj/:id/reset-password", async (req, res) => {
  try {
    const roditeljId = parseInt(req.params.id);
    if (!roditeljId) { res.status(400).json({ error: "id obavezan" }); return; }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, roditeljId));
    if (!user || user.role !== "roditelj") { res.status(404).json({ error: "Roditelj ne postoji" }); return; }
    if (user.username.toLowerCase().startsWith("demo.")) {
      res.status(403).json({ error: "Demo nalozima nije dozvoljena promjena šifre." });
      return;
    }

    // Provjera vlasništva: roditelj mora biti povezan sa BAREM JEDNIM
    // učenikom čiji je muallim ovaj korisnik (osim za admina).
    // Glavni muallim može resetirati šifru roditelja bilo kojeg učenika u mektebu.
    if (req.user!.role !== "admin") {
      const ctx = await getMektebCtx(req.user!.userId);
      const veze = await db.select({ ucenikId: roditeljUcenikTable.ucenikId })
        .from(roditeljUcenikTable)
        .where(eq(roditeljUcenikTable.roditeljId, roditeljId));
      if (veze.length === 0) { res.status(403).json({ error: "Roditelj nije povezan ni s jednim vašim učenikom" }); return; }
      const ucenikIds = veze.map(v => v.ucenikId);
      const ucenikFilter = ctx?.isGlavni && ctx.mektebId
        ? and(inArray(ucenikProfiliTable.userId, ucenikIds), eq(ucenikProfiliTable.mektebId, ctx.mektebId))
        : and(inArray(ucenikProfiliTable.userId, ucenikIds), eq(ucenikProfiliTable.muallimId, req.user!.userId));
      const profili = await db.select({ userId: ucenikProfiliTable.userId })
        .from(ucenikProfiliTable)
        .where(ucenikFilter);
      if (profili.length === 0) { res.status(403).json({ error: "Roditelj nije povezan ni s jednim vašim učenikom" }); return; }
    }

    // "Resetiraj šifru" UVIJEK vraća na standardnu/izvornu lozinku izvedenu iz
    // korisničkog imena (Mekteb<broj>) — ista koju dijeli par učenik/roditelj i
    // koja se printa na kartici. Nema nasumičnih ni custom lozinki.
    const newPassword = passwordFromUsername(user.username, user.id);
    const hash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.id, roditeljId));

    res.json({ ok: true, newPassword, displayName: user.displayName, username: user.username });
  } catch (err) {
    console.error("Reset roditelj password error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// ── STATUS LEKCIJA PO GRUPI ────────────────────────────────────────────────────
// GET /api/muallim/grupa/:id/lekcije-status
// Vraća za svakog učenika u grupi: zadnja završena lekcija (slug, naslov, nivo)
// i ukupan broj završenih ilmihal lekcija.
router.get("/grupa/:id/lekcije-status", async (req, res) => {
  try {
    const grupaId = parseInt(req.params.id);
    const grupa = await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role);
    if (!grupa) { res.status(403).json({ error: "Nije vaša grupa" }); return; }

    const ucenici = await db.select({ userId: ucenikProfiliTable.userId })
      .from(ucenikProfiliTable)
      .where(eq(ucenikProfiliTable.grupaId, grupaId));
    if (ucenici.length === 0) { res.json([]); return; }
    const ucenikIds = ucenici.map(u => u.userId);

    const napredak = await db.select().from(korisnikNapredakTable)
      .where(and(
        inArray(korisnikNapredakTable.userId, ucenikIds),
        eq(korisnikNapredakTable.contentType, "ilmihal"),
        eq(korisnikNapredakTable.zavrsen, true),
      ));

    const lekcijeIds = Array.from(new Set(napredak.map(n => n.contentId)));
    const lekcije = lekcijeIds.length > 0 ? await db.select({
      id: ilmihalLekcijeTable.id,
      naslov: ilmihalLekcijeTable.naslov,
      slug: ilmihalLekcijeTable.slug,
      nivo: ilmihalLekcijeTable.nivo,
    }).from(ilmihalLekcijeTable).where(inArray(ilmihalLekcijeTable.id, lekcijeIds)) : [];
    const lekcijaMap = new Map(lekcije.map(l => [l.id, l]));

    const result = ucenikIds.map(uid => {
      const moj = napredak
        .filter(n => n.userId === uid)
        .sort((a, b) => {
          const ta = a.completedAt ? new Date(a.completedAt).getTime() : 0;
          const tb = b.completedAt ? new Date(b.completedAt).getTime() : 0;
          return tb - ta;
        });
      const zavrseno = moj.length;
      const last = moj[0];
      const lekcija = last ? lekcijaMap.get(last.contentId) || null : null;
      return {
        ucenikId: uid,
        zavrsenoLekcija: zavrseno,
        zadnjaLekcija: lekcija,
        zavrsenoAt: last?.completedAt || null,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("Lekcije status error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// ─── Zvjezdice (classroom management) ───────────────────────────────────────
// Dvije vrste: 'pozitivna' (žuta) i 'negativna' (crna).
// Svaki zapis = jedna dodijeljena zvjezdica s opcionalnim razlogom.

// GET /api/muallim/zvjezdice-kategorije — lista kategorija za dropdown u muallim UI
router.get("/zvjezdice-kategorije", async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT id, tip, naziv FROM zvjezdice_kategorije ORDER BY tip, redoslijed, naziv
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("zvjezdice kategorije error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/ucenik/:id/zvjezdice — dodaj zvjezdicu
router.post("/ucenik/:id/zvjezdice", async (req, res) => {
  try {
    const ucenikId = parseInt(req.params.id);
    const { tip, razlog, kategorija_id } = req.body;
    if (!["pozitivna", "negativna"].includes(tip)) {
      res.status(400).json({ error: "tip mora biti 'pozitivna' ili 'negativna'" });
      return;
    }
    // Pokušaj sa kategorija_id; ako kolona ne postoji (stara produkcija), padne na INSERT bez nje
    let row: any;
    try {
      const result = await db.execute(sql`
        INSERT INTO zvjezdice_log (ucenik_id, muallim_id, tip, razlog, kategorija_id)
        VALUES (${ucenikId}, ${req.user!.userId}, ${tip}, ${razlog || null}, ${kategorija_id ?? null})
        RETURNING id, ucenik_id, muallim_id, tip, razlog, kategorija_id, created_at
      `);
      row = result.rows[0];
    } catch {
      // Fallback — bez kategorija_id (za slučaj da kolona još ne postoji)
      const result = await db.execute(sql`
        INSERT INTO zvjezdice_log (ucenik_id, muallim_id, tip, razlog)
        VALUES (${ucenikId}, ${req.user!.userId}, ${tip}, ${razlog || null})
        RETURNING id, ucenik_id, muallim_id, tip, razlog, created_at
      `);
      row = result.rows[0];
    }
    res.status(201).json(row);
  } catch (err) {
    console.error("zvjezdice add error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/ucenik/:id/zvjezdice — log + totali za jednog učenika
router.get("/ucenik/:id/zvjezdice", async (req, res) => {
  try {
    const ucenikId = parseInt(req.params.id);

    // Tri nivoa fallback-a — svaki bez JOIN-a koji bi mogao ne postojati u produkciji
    let entries: any[] = [];
    try {
      const r = await db.execute(sql`
        SELECT zl.id, zl.tip, zl.razlog, zl.created_at,
                u.display_name AS muallim_ime,
               k.naziv AS kategorija_naziv
        FROM zvjezdice_log zl
        JOIN users u ON u.id = zl.muallim_id
        LEFT JOIN zvjezdice_kategorije k ON k.id = zl.kategorija_id
         WHERE zl.ucenik_id = ${ucenikId}
           AND zl.created_at >= ${currentSchoolYearResetDate()}
        ORDER BY zl.created_at DESC
        LIMIT 100
      `);
      entries = r.rows;
    } catch {
      try {
        // Fallback 1: bez zvjezdice_kategorije JOIN-a
        const r = await db.execute(sql`
          SELECT zl.id, zl.tip, zl.razlog, zl.created_at,
                 u.display_name AS muallim_ime,
                 null AS kategorija_naziv
           FROM zvjezdice_log zl
           JOIN users u ON u.id = zl.muallim_id
           WHERE zl.ucenik_id = ${ucenikId}
             AND zl.created_at >= ${currentSchoolYearResetDate()}
          ORDER BY zl.created_at DESC
          LIMIT 100
        `);
        entries = r.rows;
      } catch {
        // Fallback 2: apsolutni minimum — nula JOIN-ova
        const r = await db.execute(sql`
          SELECT id, tip, razlog, created_at,
                 null AS muallim_ime, null AS kategorija_naziv
          FROM zvjezdice_log
           WHERE ucenik_id = ${ucenikId}
             AND created_at >= ${currentSchoolYearResetDate()}
          ORDER BY created_at DESC
          LIMIT 100
        `);
        entries = r.rows;
      }
    }

    const totalsResult = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE tip = 'pozitivna') AS pozitivne,
        COUNT(*) FILTER (WHERE tip = 'negativna') AS negativne
      FROM zvjezdice_log
      WHERE ucenik_id = ${ucenikId}
        AND created_at >= ${currentSchoolYearResetDate()}
    `);
    const t = (totalsResult.rows[0] as any) || { pozitivne: "0", negativne: "0" };
    res.json({
      entries,
      pozitivne: parseInt(t.pozitivne) || 0,
      negativne: parseInt(t.negativne) || 0,
    });
  } catch (err) {
    console.error("zvjezdice get error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

type InteraktivniPitanjePregled = {
  lekcijaId: number;
  lekcijaNaslov: string;
  blokId: string;
  pitanjeIndex: number;
  pitanjeTekst: string;
  brojPokusaja: number;
  netacniPokusaji: number;
  procenatTacnih: number;
  pomocBroj: number;
  tacnoNakonPonovnogCitanja: number;
  prosjekVrijemeSekundi: number;
};

function aggregateInteraktivnePokusaje(rows: Array<typeof interaktivniBlokPokusajiTable.$inferSelect>) {
  const pitanja = new Map<string, InteraktivniPitanjePregled & { ukupnoVrijemeSekundi: number }>();
  for (const row of rows) {
    const key = `${row.lekcijaId}:${row.blokId}:${row.pitanjeIndex}`;
    const current = pitanja.get(key) ?? {
      lekcijaId: row.lekcijaId,
      lekcijaNaslov: "",
      blokId: row.blokId,
      pitanjeIndex: row.pitanjeIndex,
      pitanjeTekst: row.pitanjeTekst,
      brojPokusaja: 0,
      netacniPokusaji: 0,
      procenatTacnih: 0,
      pomocBroj: 0,
      tacnoNakonPonovnogCitanja: 0,
      prosjekVrijemeSekundi: 0,
      ukupnoVrijemeSekundi: 0,
    };
    current.brojPokusaja += 1;
    if (!row.tacno) current.netacniPokusaji += 1;
    if (row.pomocKoristena) current.pomocBroj += 1;
    if (row.tacno && row.ponovoProcitao) current.tacnoNakonPonovnogCitanja += 1;
    current.ukupnoVrijemeSekundi += row.vrijemeSekundi;
    pitanja.set(key, current);
  }
  return [...pitanja.values()].map(({ ukupnoVrijemeSekundi, ...p }) => ({
    ...p,
    procenatTacnih: Math.round(((p.brojPokusaja - p.netacniPokusaji) / p.brojPokusaja) * 100),
    prosjekVrijemeSekundi: Math.round(ukupnoVrijemeSekundi / p.brojPokusaja),
  }));
}

// GET /api/muallim/grupa/:id/interaktivni-blokovi
// Privatni pedagoški pregled: pitanja koja zaslužuju dodatno objašnjenje i
// zbir po svakom učeniku. Ne vraća bodove, zvjezdice ni javnu rang-listu.
router.get("/grupa/:id/interaktivni-blokovi", async (req, res) => {
  try {
    const grupaId = parseInt(req.params.id);
    const grupa = await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role);
    if (!grupa) { res.status(403).json({ error: "Nije vaša grupa" }); return; }

    const profili = await db.select({ userId: ucenikProfiliTable.userId })
      .from(ucenikProfiliTable)
      .where(and(eq(ucenikProfiliTable.grupaId, grupaId), eq(ucenikProfiliTable.isArchived, false)));
    const ucenikIds = profili.map(p => p.userId);
    if (ucenikIds.length === 0) {
      res.json({ ukupnoUcenika: 0, ukupnoPokusaja: 0, prosjekTacnosti: null, pitanja: [], ucenici: [] }); return;
    }

    const [pokusaji, ucenici] = await Promise.all([
      db.select().from(interaktivniBlokPokusajiTable)
        .where(inArray(interaktivniBlokPokusajiTable.userId, ucenikIds)),
      db.select({ id: usersTable.id, displayName: usersTable.displayName })
        .from(usersTable).where(inArray(usersTable.id, ucenikIds)),
    ]);
    const lekcijaIds = [...new Set(pokusaji.map(p => p.lekcijaId))];
    const lekcije = lekcijaIds.length ? await db.select({ id: ilmihalLekcijeTable.id, naslov: ilmihalLekcijeTable.naslov })
      .from(ilmihalLekcijeTable).where(inArray(ilmihalLekcijeTable.id, lekcijaIds)) : [];
    const naslovMap = new Map(lekcije.map(l => [l.id, l.naslov]));
    const pitanja = aggregateInteraktivnePokusaje(pokusaji).map(p => ({
      ...p,
      lekcijaNaslov: naslovMap.get(p.lekcijaId) || "Lekcija",
    })).sort((a, b) => b.netacniPokusaji - a.netacniPokusaji || b.brojPokusaja - a.brojPokusaja);

    const uceniciPregled = ucenici.map(u => {
      const njegovi = pokusaji.filter(p => p.userId === u.id);
      const tacni = njegovi.filter(p => p.tacno).length;
      return {
        id: u.id,
        displayName: u.displayName,
        brojPokusaja: njegovi.length,
        procenatTacnih: njegovi.length ? Math.round((tacni / njegovi.length) * 100) : null,
        pomocBroj: njegovi.filter(p => p.pomocKoristena).length,
        tacnoNakonPonovnogCitanja: njegovi.filter(p => p.tacno && p.ponovoProcitao).length,
      };
    }).sort((a, b) => a.displayName.localeCompare(b.displayName, "bs"));

    res.json({
      ukupnoUcenika: ucenikIds.length,
      ukupnoPokusaja: pokusaji.length,
      prosjekTacnosti: pokusaji.length ? Math.round((pokusaji.filter(p => p.tacno).length / pokusaji.length) * 100) : null,
      pitanja,
      ucenici: uceniciPregled,
    });
  } catch (err) {
    req.log.error({ err }, "GET /muallim/grupa/:id/interaktivni-blokovi failed");
    res.status(500).json({ error: "Greška pri učitavanju pregleda učenja" });
  }
});

// GET /api/muallim/ucenik/:id/interaktivni-blokovi
// Detalj jednog učenika za privatni razgovor i planiranje dodatnog objašnjenja.
router.get("/ucenik/:id/interaktivni-blokovi", async (req, res) => {
  try {
    const ucenikId = parseInt(req.params.id);
    const [profil] = await db.select({ grupaId: ucenikProfiliTable.grupaId })
      .from(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, ucenikId));
    if (!profil?.grupaId || !await verifyGrupaAccess(profil.grupaId, req.user!.userId, req.user!.role)) {
      res.status(403).json({ error: "Nije vaš učenik" }); return;
    }
    const pokusaji = await db.select().from(interaktivniBlokPokusajiTable)
      .where(eq(interaktivniBlokPokusajiTable.userId, ucenikId));
    const lekcijaIds = [...new Set(pokusaji.map(p => p.lekcijaId))];
    const lekcije = lekcijaIds.length ? await db.select({ id: ilmihalLekcijeTable.id, naslov: ilmihalLekcijeTable.naslov })
      .from(ilmihalLekcijeTable).where(inArray(ilmihalLekcijeTable.id, lekcijaIds)) : [];
    const naslovMap = new Map(lekcije.map(l => [l.id, l.naslov]));
    const pitanja = aggregateInteraktivnePokusaje(pokusaji).map(p => ({
      ...p,
      lekcijaNaslov: naslovMap.get(p.lekcijaId) || "Lekcija",
    })).sort((a, b) => b.netacniPokusaji - a.netacniPokusaji || b.brojPokusaja - a.brojPokusaja);
    res.json({ ukupnoPokusaja: pokusaji.length, pitanja });
  } catch (err) {
    req.log.error({ err }, "GET /muallim/ucenik/:id/interaktivni-blokovi failed");
    res.status(500).json({ error: "Greška pri učitavanju učenikovog pregleda" });
  }
});

// GET /api/muallim/grupa/:id/zvjezdice-summary — totali za sve učenike u grupi
router.get("/grupa/:id/zvjezdice-summary", async (req, res) => {
  try {
    const grupaId = parseInt(req.params.id);
    const ucenici = await db.execute(sql`
       SELECT user_id FROM ucenik_profili
       WHERE grupa_id = ${grupaId}
         AND COALESCE(is_archived, false) = false
    `);
    const ids = (ucenici.rows as any[]).map(u => Number(u.user_id));
    if (ids.length === 0) { res.json([]); return; }
    // Vraćamo red za SVAKOG aktivnog učenika grupe (nule uključene), da
    // statistika i izvještaji nikad ne izostave učenika bez zvjezdica.
    const map = await getZvjezdiceZaUcenike(ids);
    res.json(ids.map(id => ({
      ucenik_id: id,
      pozitivne: map.get(id)?.pozitivne ?? 0,
      negativne: map.get(id)?.negativne ?? 0,
    })));
  } catch (err) {
    console.error("zvjezdice summary error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// DELETE /api/muallim/ucenik/:id/zvjezdice — reset svih zvjezdica za učenika
router.delete("/ucenik/:id/zvjezdice", async (req, res) => {
  try {
    const ucenikId = parseInt(req.params.id);
    await db.execute(sql`DELETE FROM zvjezdice_log WHERE ucenik_id = ${ucenikId}`);
    res.json({ ok: true });
  } catch (err) {
    console.error("zvjezdice reset error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

export default router;
