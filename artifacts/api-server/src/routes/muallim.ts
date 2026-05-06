import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  usersTable,
  muallimProfiliTable,
  ucenikProfiliTable,
  roditeljProfiliTable,
  grupeTable,
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
  porukeTable,
  mektebiTable,
  h5pPokusajiTable,
  prilozi,
} from "@workspace/db/schema";
import { eq, and, inArray, desc, asc, sql, count, gte } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { sendPushNotification } from "../lib/push.js";

const router = Router();
router.use(requireAuth, requireRole("muallim", "admin"));

// ── KORISNIK HELPERI ────────────────────────────────────────────────────────
// Kreiranje korisnika (učenik/roditelj) sa retry-em na koliziju username-a.
// Koriste se u POST /ucenici (single), POST /ucenici/bulk (više) i POST
// /ucenici/:id/roditelj (postojeći učenik).

type NewUserRow = typeof usersTable.$inferSelect;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function generateUsername(name: string) {
  const firstName = name.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, "") || "korisnik";
  const rand = Math.floor(1000 + Math.random() * 9000);
  return { username: `${firstName}.${rand}`, rand };
}

function generateMektebPassword() {
  return `Mekteb${Math.floor(1000 + Math.random() * 9000)}`;
}

async function insertWithUniqueUsername(
  tx: Tx,
  baseName: string,
  passwordHash: string,
  displayNameVal: string,
  role: "ucenik" | "roditelj",
): Promise<NewUserRow> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { username } = generateUsername(baseName);
    try {
      const [row] = await tx.insert(usersTable).values({
        username,
        passwordHash,
        displayName: displayNameVal,
        role,
      }).returning();
      return row;
    } catch (e: any) {
      const isUniqueViolation = e?.code === "23505" || /unique|duplicate/i.test(e?.message || "");
      if (attempt === 4 || !isUniqueViolation) throw e;
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
}) {
  const { ucenikId, posiljateljId, naslov, sadrzaj, logTag } = opts;

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
  } catch (err) {
    console.error(`[${logTag}] notifyApprovedRoditelji failed`, { ucenikId, posiljateljId }, err);
  }
}

// GET /api/muallim/info
router.get("/info", async (req, res) => {
  try {
    const [profil] = await db.select().from(muallimProfiliTable).where(eq(muallimProfiliTable.userId, req.user!.userId));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
    res.json({ ...user, profil: profil || null });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/grupe
router.get("/grupe", async (req, res) => {
  try {
    const grupe = await db.select().from(grupeTable).where(eq(grupeTable.muallimId, req.user!.userId));
    res.json(grupe);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/grupe
router.post("/grupe", async (req, res) => {
  try {
    const { naziv, skolskaGodina, daniNastave, vrijemeNastave } = req.body;
    const [nova] = await db.insert(grupeTable).values({
      muallimId: req.user!.userId,
      naziv,
      skolskaGodina,
      daniNastave: daniNastave || [],
      vrijemeNastave,
    }).returning();
    res.status(201).json(nova);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/muallim/grupe/:id
router.put("/grupe/:id", async (req, res) => {
  try {
    const { naziv, skolskaGodina, daniNastave, vrijemeNastave, isActive } = req.body;
    const [updated] = await db.update(grupeTable)
      .set({ naziv, skolskaGodina, daniNastave, vrijemeNastave, isActive })
      .where(and(eq(grupeTable.id, parseInt(req.params.id)), eq(grupeTable.muallimId, req.user!.userId)))
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
    const isAdmin = req.user!.role === "admin";

    const grupaWhere = isAdmin
      ? eq(grupeTable.id, grupaId)
      : and(eq(grupeTable.id, grupaId), eq(grupeTable.muallimId, userId));
    const [grupa] = await db.select().from(grupeTable).where(grupaWhere);
    if (!grupa) { res.status(404).json({ error: "Grupa nije pronađena" }); return; }

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
      await tx.delete(grupeTable).where(eq(grupeTable.id, grupaId));
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Delete grupa error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/ucenici
router.get("/ucenici", async (req, res) => {
  try {
    const profili = await db.select().from(ucenikProfiliTable).where(eq(ucenikProfiliTable.muallimId, req.user!.userId));
    if (profili.length === 0) { res.json([]); return; }

    const userIds = profili.map(p => p.userId);
    const korisnici = await db.select().from(usersTable).where(inArray(usersTable.id, userIds));
    const grupe = await db.select().from(grupeTable).where(eq(grupeTable.muallimId, req.user!.userId));
    const grupaMap = Object.fromEntries(grupe.map(g => [g.id, g.naziv]));

    const result = korisnici.map(u => {
      const profil = profili.find(p => p.userId === u.id);
      return {
        ...u,
        passwordHash: undefined,
        profil,
        grupaId: profil?.grupaId || null,
        grupaIme: profil?.grupaId ? grupaMap[profil.grupaId] || null : null,
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

    const ucenikPass = password || generateMektebPassword();
    const ucenikPasswordHash = await bcrypt.hash(ucenikPass, 10);

    let roditeljPass: string | null = null;
    let roditeljPasswordHash: string | null = null;
    if (roditeljZahtjev) {
      roditeljPass = generateMektebPassword();
      roditeljPasswordHash = await bcrypt.hash(roditeljPass, 10);
    }

    const result = await db.transaction(async (tx) => {
      const newUcenik = await insertWithUniqueUsername(tx, displayName, ucenikPasswordHash, displayName.trim(), "ucenik");

      await tx.insert(ucenikProfiliTable).values({
        userId: newUcenik.id,
        muallimId,
        grupaId: grupaId || null,
      });

      let newRoditelj: NewUserRow | null = null;
      if (roditeljZahtjev && roditeljPasswordHash) {
        newRoditelj = await insertWithUniqueUsername(tx, roditeljZahtjev, roditeljPasswordHash, roditeljZahtjev, "roditelj");

        await tx.insert(roditeljProfiliTable).values({ userId: newRoditelj.id });

        await tx.insert(roditeljUcenikTable).values({
          roditeljId: newRoditelj.id,
          ucenikId: newUcenik.id,
          status: "approved",
          approvedAt: new Date(),
          approvedBy: muallimId,
        });
      }

      // Increment licences used (samo učenik, roditelj je freebie)
      if (profil) {
        await tx.update(muallimProfiliTable)
          .set({ licencesUsed: profil.licencesUsed + 1 })
          .where(eq(muallimProfiliTable.userId, muallimId));
      }

      return { newUcenik, newRoditelj };
    });

    res.status(201).json({
      ...result.newUcenik,
      passwordHash: undefined,
      generatedPassword: ucenikPass,
      roditelj: result.newRoditelj
        ? {
            id: result.newRoditelj.id,
            displayName: result.newRoditelj.displayName,
            username: result.newRoditelj.username,
            generatedPassword: roditeljPass,
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

    const muallimId = req.user!.userId;
    const [profil] = await db.select().from(muallimProfiliTable).where(eq(muallimProfiliTable.userId, muallimId));
    const remaining = profil ? profil.licenceCount - profil.licencesUsed : 999;
    if (normalized.length > remaining) {
      res.status(403).json({ error: `Možete dodati još ${remaining} učenika (limit licenci)` });
      return;
    }

    const grupaId = body.grupaId;

    // Pre-hash sve lozinke izvan transakcije (bcrypt je sporo) — onda jedna
    // transakcija po učeniku-paru da koliziju username-a hendlamo lokalno.
    const prepared = await Promise.all(normalized.map(async (e) => {
      const ucenikPass = generateMektebPassword();
      const ucenikHash = await bcrypt.hash(ucenikPass, 10);
      let roditeljPass: string | null = null;
      let roditeljHash: string | null = null;
      if (e.roditelj) {
        roditeljPass = generateMektebPassword();
        roditeljHash = await bcrypt.hash(roditeljPass, 10);
      }
      return { ...e, ucenikPass, ucenikHash, roditeljPass, roditeljHash };
    }));

    const results: Array<{
      id: number; displayName: string; username: string; generatedPassword: string;
      roditelj: { id: number; displayName: string; username: string; generatedPassword: string } | null;
    }> = [];

    let kreiranoUcenika = 0;
    for (const p of prepared) {
      const created = await db.transaction(async (tx) => {
        const newUcenik = await insertWithUniqueUsername(tx, p.ucenik, p.ucenikHash, p.ucenik, "ucenik");
        await tx.insert(ucenikProfiliTable).values({
          userId: newUcenik.id, muallimId, grupaId: grupaId || null,
        });

        let newRoditelj: NewUserRow | null = null;
        if (p.roditelj && p.roditeljHash) {
          newRoditelj = await insertWithUniqueUsername(tx, p.roditelj, p.roditeljHash, p.roditelj, "roditelj");
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

      kreiranoUcenika++;
      results.push({
        id: created.newUcenik.id,
        displayName: created.newUcenik.displayName,
        username: created.newUcenik.username,
        generatedPassword: p.ucenikPass,
        roditelj: created.newRoditelj && p.roditeljPass
          ? {
              id: created.newRoditelj.id,
              displayName: created.newRoditelj.displayName,
              username: created.newRoditelj.username,
              generatedPassword: p.roditeljPass,
            }
          : null,
      });
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

    // Provjera vlasništva — učenik mora pripadati ovom muallimu.
    const [profil] = await db.select().from(ucenikProfiliTable)
      .where(and(eq(ucenikProfiliTable.userId, ucenikId), eq(ucenikProfiliTable.muallimId, muallimId)));
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

    // Provjera vlasništva
    const [profil] = await db.select().from(ucenikProfiliTable)
      .where(and(eq(ucenikProfiliTable.userId, ucenikId), eq(ucenikProfiliTable.muallimId, muallimId)));
    if (!profil) { res.status(404).json({ error: "Učenik nije pronađen" }); return; }

    const roditeljPass = generateMektebPassword();
    const roditeljHash = await bcrypt.hash(roditeljPass, 10);

    const result = await db.transaction(async (tx) => {
      const newRoditelj = await insertWithUniqueUsername(tx, displayName, roditeljHash, displayName, "roditelj");
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

    res.status(201).json({
      id: result.id,
      displayName: result.displayName,
      username: result.username,
      generatedPassword: roditeljPass,
    });
  } catch (err: any) {
    console.error("[POST /muallim/ucenici/:id/roditelj]", err);
    if (err?.message === "USERNAME_COLLISION") {
      res.status(409).json({ error: "Nije moguće generisati jedinstveno korisničko ime — pokušajte ponovo" });
      return;
    }
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/muallim/ucenici/:id/grupa - move student to different group
router.put("/ucenici/:id/grupa", async (req, res) => {
  try {
    const ucenikId = parseInt(req.params.id);
    const { grupaId } = req.body;
    const [updated] = await db.update(ucenikProfiliTable)
      .set({ grupaId: grupaId || null })
      .where(and(eq(ucenikProfiliTable.userId, ucenikId), eq(ucenikProfiliTable.muallimId, req.user!.userId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Učenik nije pronađen" }); return; }
    res.json(updated);
  } catch (err) {
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

    // Pratimo koji su zapisi prešli u "odsutan"/"zakasnio" da bismo poslije
    // poslali notifikaciju roditeljima (samo na promjenu, ne na ponovni save).
    const NOTIFY_STATUSES = new Set(["odsutan", "zakasnio"]);
    const toNotify: { ucenikId: number; status: string }[] = [];

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
        if (NOTIFY_STATUSES.has(newStatus) && prev.status !== newStatus) {
          toNotify.push({ ucenikId: p.ucenikId, status: newStatus });
        }
      } else {
        await db.insert(priustvoTable).values({
          ucenikId: p.ucenikId,
          grupaId,
          muallimId: req.user!.userId,
          datum,
          status: newStatus,
          napomena: p.napomena || null,
        });
        if (NOTIFY_STATUSES.has(newStatus)) {
          toNotify.push({ ucenikId: p.ucenikId, status: newStatus });
        }
      }
    }

    res.json({ success: true });

    // Notifikacije roditelja — pokrećemo nakon odgovora kako ne bismo blokirali UI
    if (toNotify.length > 0) {
      (async () => {
        const ucenikIds = [...new Set(toNotify.map(t => t.ucenikId))];
        const ucenici = await db
          .select({ id: usersTable.id, displayName: usersTable.displayName })
          .from(usersTable)
          .where(inArray(usersTable.id, ucenikIds));
        const imeMap = Object.fromEntries(ucenici.map(u => [u.id, u.displayName]));
        const statusText: Record<string, string> = {
          odsutan: "odsutno",
          zakasnio: "zakasnilo",
        };
        for (const t of toNotify) {
          const ime = imeMap[t.ucenikId] || "vaše dijete";
          const stText = statusText[t.status] || t.status;
          const naslov = `Izostanak: ${ime} (${datum})`;
          const sadrzaj = `Vaše dijete ${ime} je dana ${datum} evidentirano kao ${stText}.`;
          await notifyApprovedRoditelji({
            ucenikId: t.ucenikId,
            posiljateljId: req.user!.userId,
            naslov,
            sadrzaj,
            logTag: "prisustvo-notify",
          });
        }
      })().catch(err => console.error("[prisustvo-notify] background notify failed", err));
    }
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
    const { ucenikId, grupaId, kategorija, ocjena, lekcijaNaziv, napomena, datum } = req.body;
    const [nova] = await db.insert(ocjeneTable).values({
      ucenikId,
      muallimId: req.user!.userId,
      grupaId,
      kategorija,
      ocjena,
      lekcijaNaziv: lekcijaNaziv || null,
      napomena,
      datum,
    }).returning();
    res.status(201).json(nova);

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
      });
    })().catch(err => console.error("[ocjene-notify] background notify failed", err));
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
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

// Helper: verify group ownership (muallim owns the group, or user is admin)
async function verifyGrupaAccess(grupaId: number, userId: number, userRole: string) {
  if (userRole === "admin") {
    const [grupa] = await db.select().from(grupeTable).where(eq(grupeTable.id, grupaId));
    return grupa || null;
  }
  const [grupa] = await db.select().from(grupeTable).where(and(eq(grupeTable.id, grupaId), eq(grupeTable.muallimId, userId)));
  return grupa || null;
}

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
    if (!["mekteb", "ferije", "vazan_datum"].includes(tip)) { res.status(400).json({ error: "tip mora biti: mekteb, ferije, vazan_datum" }); return; }

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
    if (!["mekteb", "ferije", "vazan_datum"].includes(tip)) {
      res.status(400).json({ error: "tip mora biti: mekteb, ferije, vazan_datum" }); return;
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

// POST /api/muallim/print-kartice — reset passwords for students and return plaintext for printing
router.post("/print-kartice", async (req, res) => {
  try {
    const { ucenikIds } = req.body as { ucenikIds: number[] };
    if (!ucenikIds || !Array.isArray(ucenikIds) || ucenikIds.length === 0) {
      res.status(400).json({ error: "ucenikIds je obavezan" });
      return;
    }

    const profili = await db.select().from(ucenikProfiliTable)
      .where(and(
        inArray(ucenikProfiliTable.userId, ucenikIds),
        eq(ucenikProfiliTable.muallimId, req.user!.userId)
      ));

    if (profili.length === 0) {
      res.status(403).json({ error: "Nemate pristup ovim učenicima" });
      return;
    }
    const allowedIds = profili.map(p => p.userId);

    const users = await db.select({ id: usersTable.id, displayName: usersTable.displayName, username: usersTable.username })
      .from(usersTable).where(inArray(usersTable.id, allowedIds));

    const results = [];
    for (const u of users) {
      const rand = Math.floor(1000 + Math.random() * 9000);
      const newPass = `Mekteb${rand}`;
      const hash = await bcrypt.hash(newPass, 10);
      await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.id, u.id));
      results.push({ id: u.id, displayName: u.displayName, username: u.username, generatedPassword: newPass });
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

// ── STATISTIKA GRUPE ─────────────────────────────────────────────────────────

async function getGrupaFullStats(grupaId: number) {
  const profili = await db.select().from(ucenikProfiliTable)
    .where(and(eq(ucenikProfiliTable.grupaId, grupaId), eq(ucenikProfiliTable.isArchived, false)));
  if (profili.length === 0) return { ucenici: [], ukupnoCasova: 0, svaDatumi: [], mjesecniPregled: [], grupaPrisustvoPct: null, grupaProsjekOcjena: null, aktivnihProslejSedmice: 0, ukupnoKvizova: 0, ukupnoBodovaGrupa: 0, prosjekBodovaGrupa: 0, prisustvoPoDatumu: [] as any[] };

  const ucenikIds = profili.map(p => p.userId);
  const users = await db.select({ id: usersTable.id, displayName: usersTable.displayName })
    .from(usersTable).where(inArray(usersTable.id, ucenikIds));
  const userMap = Object.fromEntries(users.map(u => [u.id, u.displayName]));

  const svoPrisustvoRaw = await db.select().from(priustvoTable)
    .where(eq(priustvoTable.grupaId, grupaId));
  const svoPrisustvo = svoPrisustvoRaw.filter(p => ucenikIds.includes(p.ucenikId));
  const sveOcjeneRaw = await db.select().from(ocjeneTable)
    .where(eq(ocjeneTable.grupaId, grupaId));
  const sveOcjene = sveOcjeneRaw.filter(o => ucenikIds.includes(o.ucenikId));
  const kvizRezultati = ucenikIds.length > 0
    ? await db.select().from(kvizRezultatiTable)
        .where(inArray(kvizRezultatiTable.userId, ucenikIds))
    : [];

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

  return { ucenici, ukupnoCasova, svaDatumi, mjesecniPregled, grupaPrisustvoPct, grupaProsjekOcjena, aktivnihProslejSedmice, ukupnoKvizova, ukupnoBodovaGrupa, prosjekBodovaGrupa, prisustvoPoDatumu };
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
      const tp = stats.ucenici.reduce((a, u) => a + u.prisutanCount, 0);
      const to = stats.ucenici.reduce((a, u) => a + u.odsutanCount, 0);
      const tz = stats.ucenici.reduce((a, u) => a + u.zakasnioCount, 0);
      const top = stats.ucenici.reduce((a, u) => a + u.opravdanCount, 0);
      const tt = stats.ucenici.reduce((a, u) => a + u.ukupnoPrisustvo, 0);
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
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error("Excel export error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// ── ZADAĆE ───────────────────────────────────────────────────────────────────

router.get("/zadace", async (req, res) => {
  try {
    const grupaId = req.query.grupaId ? parseInt(req.query.grupaId as string) : undefined;
    const where = grupaId
      ? and(eq(zadaceTable.muallimId, req.user!.userId), eq(zadaceTable.grupaId, grupaId))
      : eq(zadaceTable.muallimId, req.user!.userId);
    const zadace = await db.select().from(zadaceTable).where(where).orderBy(desc(zadaceTable.createdAt));

    if (zadace.length === 0) { res.json([]); return; }

    const targets = await db.select().from(zadaceUceniciTable)
      .where(inArray(zadaceUceniciTable.zadacaId, zadace.map(z => z.id)));
    const targetMap = new Map<number, number[]>();
    for (const t of targets) {
      const arr = targetMap.get(t.zadacaId) || [];
      arr.push(t.ucenikId);
      targetMap.set(t.zadacaId, arr);
    }

    res.json(zadace.map(z => ({ ...z, ucenikIds: targetMap.get(z.id) || [] })));
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

router.post("/zadace", async (req, res) => {
  try {
    const { grupaId, naslov, opis, rokDo, lekcijaNaslov, lekcijaTip, ucenikIds } = req.body;
    if (!grupaId || !naslov) { res.status(400).json({ error: "grupaId i naslov su obavezni" }); return; }

    const grupa = await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role);
    if (!grupa) { res.status(403).json({ error: "Nije vaša grupa" }); return; }

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
      naslov,
      opis: opis || null,
      rokDo: rokDo || null,
      lekcijaNaslov: lekcijaNaslov || null,
      lekcijaTip: lekcijaTip || null,
    }).returning();

    if (validUcenikIds.length > 0) {
      await db.insert(zadaceUceniciTable).values(
        validUcenikIds.map(uid => ({ zadacaId: nova.id, ucenikId: uid }))
      );

      // Best-effort push notifikacija učenicima — ne čekamo, ne propagiramo grešku
      const opisPreview = opis && typeof opis === "string" && opis.trim()
        ? (opis.trim().length > 80 ? opis.trim().slice(0, 80) + "…" : opis.trim())
        : "Otvori da vidiš detalje.";
      sendPushNotification({
        userIds: validUcenikIds,
        title: `Nova zadaća: ${naslov}`,
        body: opisPreview,
        url: "/ucenik/zadace",
        data: { type: "zadaca", zadacaId: nova.id },
      }).catch((err) => console.error("[Zadace push]", err));
    }

    res.status(201).json({ ...nova, ucenikIds: validUcenikIds });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

router.put("/zadace/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { naslov, opis, rokDo, lekcijaNaslov, lekcijaTip, isActive, ucenikIds } = req.body;

    const [existing] = await db.select().from(zadaceTable)
      .where(and(eq(zadaceTable.id, id), eq(zadaceTable.muallimId, req.user!.userId)));
    if (!existing) { res.status(404).json({ error: "Zadaća nije pronađena" }); return; }

    const [updated] = await db.update(zadaceTable)
      .set({ naslov, opis, rokDo, lekcijaNaslov, lekcijaTip, isActive })
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

    const customRaw = (req.body?.password as string | undefined)?.trim();
    let newPassword: string;
    if (customRaw && customRaw.length > 0) {
      if (customRaw.length < 4) { res.status(400).json({ error: "Šifra mora imati najmanje 4 karaktera" }); return; }
      newPassword = customRaw;
    } else {
      const rand = Math.floor(1000 + Math.random() * 9000);
      newPassword = `Mekteb${rand}`;
    }

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

  const [profil] = await db.select().from(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, ucenikId));
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

  const [prisustvo, ocjene, kvizRezultati, napredak] = await Promise.all([
    db.select().from(priustvoTable).where(prisustvoWhere).orderBy(asc(priustvoTable.datum)),
    db.select().from(ocjeneTable).where(ocjeneWhere).orderBy(desc(ocjeneTable.datum)),
    db.select().from(kvizRezultatiTable).where(eq(kvizRezultatiTable.userId, ucenikId)).orderBy(desc(kvizRezultatiTable.completedAt)),
    db.select({ id: korisnikNapredakTable.id }).from(korisnikNapredakTable)
      .where(and(eq(korisnikNapredakTable.userId, ucenikId), eq(korisnikNapredakTable.zavrsen, true))),
  ]);

  return {
    ucenik: { id: user.id, displayName: user.displayName, username: user.username },
    grupaNaziv: grupa?.naziv || null,
    grupaId: grupa?.id || null,
    prisustvo,
    ocjene,
    kvizRezultati,
    zavrseneLekcijeBroj: napredak.length,
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
    const profili = await db.select().from(ucenikProfiliTable)
      .where(eq(ucenikProfiliTable.muallimId, req.user!.userId));
    // Filtriraj ocjene/prisustvo samo na ovog muallima.
    const izvjestaji = (await Promise.all(profili.map(p => buildUcenikIzvjestaj(p.userId, req.user!.userId))))
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const header = await buildMektebHeader(req.user!.userId);
    res.json({
      ...header,
      tip: "svi" as const,
      naslov: "Svi učenici",
      podnaslov: header.skolskaGodina,
      ucenici: izvjestaji,
    });
  } catch (err) {
    console.error("Izvjestaj svi error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// OBAVJEŠTENJA (Story za roditelje)
// ══════════════════════════════════════════════════════════════════════════════

router.get("/obavjestenja", async (req, res) => {
  try {
    const rows = await db.select().from(obavjestenjaTable)
      .where(eq(obavjestenjaTable.muallimId, req.user!.userId))
      .orderBy(desc(obavjestenjaTable.createdAt));
    const grupeAll = await db.select().from(grupeTable)
      .where(eq(grupeTable.muallimId, req.user!.userId));
    const grupaMap = Object.fromEntries(grupeAll.map(g => [g.id, g.naziv]));
    res.json(rows.map(r => ({
      ...r,
      grupaNaziv: r.grupaId ? grupaMap[r.grupaId] || null : null,
    })));
  } catch (err) {
    console.error("obavjestenja list error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

router.post("/obavjestenja", async (req, res) => {
  try {
    const { naslov, sadrzaj, grupaId, slikaUrl } = req.body;
    if (!naslov?.trim() || !sadrzaj?.trim()) {
      res.status(400).json({ error: "Naslov i sadržaj su obavezni" });
      return;
    }
    if (grupaId) {
      const [g] = await db.select().from(grupeTable)
        .where(and(eq(grupeTable.id, grupaId), eq(grupeTable.muallimId, req.user!.userId)));
      if (!g) { res.status(400).json({ error: "Grupa nije pronađena" }); return; }
    }
    const [row] = await db.insert(obavjestenjaTable).values({
      muallimId: req.user!.userId,
      grupaId: grupaId || null,
      naslov: naslov.trim(),
      sadrzaj: sadrzaj.trim(),
      slikaUrl: slikaUrl || null,
    }).returning();

    const profili = await db.select().from(ucenikProfiliTable)
      .where(eq(ucenikProfiliTable.muallimId, req.user!.userId));
    let targetUcenikIds: number[];
    if (grupaId) {
      targetUcenikIds = profili.filter(p => p.grupaId === grupaId).map(p => p.userId);
    } else {
      targetUcenikIds = profili.map(p => p.userId);
    }
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
            message: naslov.trim(),
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
    const { naslov, sadrzaj, grupaId, slikaUrl } = req.body;
    const [existing] = await db.select().from(obavjestenjaTable)
      .where(and(eq(obavjestenjaTable.id, id), eq(obavjestenjaTable.muallimId, req.user!.userId)));
    if (!existing) { res.status(404).json({ error: "Nije pronađeno" }); return; }
    if (grupaId) {
      const [g] = await db.select().from(grupeTable)
        .where(and(eq(grupeTable.id, grupaId), eq(grupeTable.muallimId, req.user!.userId)));
      if (!g) { res.status(400).json({ error: "Grupa nije pronađena" }); return; }
    }
    const [updated] = await db.update(obavjestenjaTable)
      .set({
        naslov: naslov?.trim() || existing.naslov,
        sadrzaj: sadrzaj?.trim() || existing.sadrzaj,
        grupaId: grupaId !== undefined ? (grupaId || null) : existing.grupaId,
        slikaUrl: slikaUrl !== undefined ? (slikaUrl || null) : existing.slikaUrl,
        updatedAt: new Date(),
      })
      .where(eq(obavjestenjaTable.id, id))
      .returning();
    res.json(updated);
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
    await db.delete(obavjestenjaTable).where(eq(obavjestenjaTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error("obavjestenja delete error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

router.get("/roditelji-lista", async (req, res) => {
  try {
    const profili = await db.select().from(ucenikProfiliTable)
      .where(eq(ucenikProfiliTable.muallimId, req.user!.userId));
    if (profili.length === 0) { res.json([]); return; }
    const ucenikIds = profili.map(p => p.userId);
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

    const grupeAll = await db.select().from(grupeTable)
      .where(eq(grupeTable.muallimId, req.user!.userId));
    const grupaMap = Object.fromEntries(grupeAll.map(g => [g.id, g.naziv]));
    const profilMap = Object.fromEntries(profili.map(p => [p.userId, p]));

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
      roditeljMap.get(link.roditeljId)!.djeca.push({
        id: link.ucenikId,
        displayName: ucenik?.displayName || `#${link.ucenikId}`,
        grupaId: profil?.grupaId,
        grupaNaziv: profil?.grupaId ? grupaMap[profil.grupaId] || null : null,
      });
    }

    res.json(Array.from(roditeljMap.values()));
  } catch (err) {
    console.error("roditelji-lista error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

export default router;
