import { Router } from "express";
import { db } from "@workspace/db";
import { porukeTable, usersTable } from "@workspace/db/schema";
import { eq, or, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

// GET /api/poruke — inbox: sve poruke za ili od trenutnog korisnika, grupirane po razgovoru
router.get("/", async (req, res) => {
  try {
    const userId = req.user!.userId;

    const sve = await db
      .select({
        id: porukeTable.id,
        posiljateljId: porukeTable.posiljateljId,
        primateljId: porukeTable.primateljId,
        naslov: porukeTable.naslov,
        sadrzaj: porukeTable.sadrzaj,
        procitanoAt: porukeTable.procitanoAt,
        createdAt: porukeTable.createdAt,
      })
      .from(porukeTable)
      .where(or(eq(porukeTable.posiljateljId, userId), eq(porukeTable.primateljId, userId)))
      .orderBy(desc(porukeTable.createdAt));

    // Pokupi sve relevantne korisnike
    const userIds = [...new Set(sve.flatMap(p => [p.posiljateljId, p.primateljId]))];
    const korisnici = userIds.length
      ? await db.select({ id: usersTable.id, displayName: usersTable.displayName, role: usersTable.role })
          .from(usersTable)
          .where(or(...userIds.map(id => eq(usersTable.id, id))))
      : [];

    const userMap = Object.fromEntries(korisnici.map(u => [u.id, u]));

    // Grupiraj u razgovore (po drugoj strani razgovora)
    const razgovori: Record<number, any> = {};
    for (const p of sve) {
      const drugiId = p.posiljateljId === userId ? p.primateljId : p.posiljateljId;
      if (!razgovori[drugiId]) {
        razgovori[drugiId] = {
          saKorisnikom: userMap[drugiId] || { id: drugiId, displayName: "Nepoznat" },
          zadnjaPoruka: p,
          neprocitano: 0,
        };
      }
      if (p.primateljId === userId && !p.procitanoAt) {
        razgovori[drugiId].neprocitano++;
      }
    }

    res.json(Object.values(razgovori));
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/poruke/razgovor/:userId — sve poruke između dva korisnika
router.get("/razgovor/:userId", async (req, res) => {
  try {
    const mojId = req.user!.userId;
    const drugiId = parseInt(req.params.userId);

    const [drugiKorisnik] = await db.select({ id: usersTable.id, displayName: usersTable.displayName, role: usersTable.role })
      .from(usersTable).where(eq(usersTable.id, drugiId));

    const poruke = await db
      .select()
      .from(porukeTable)
      .where(
        or(
          and(eq(porukeTable.posiljateljId, mojId), eq(porukeTable.primateljId, drugiId)),
          and(eq(porukeTable.posiljateljId, drugiId), eq(porukeTable.primateljId, mojId))
        )
      )
      .orderBy(desc(porukeTable.createdAt));

    // Označi sve kao pročitano
    const neprocitane = poruke.filter(p => p.primateljId === mojId && !p.procitanoAt);
    if (neprocitane.length > 0) {
      for (const p of neprocitane) {
        await db.update(porukeTable).set({ procitanoAt: new Date() }).where(eq(porukeTable.id, p.id));
      }
    }

    res.json({ drugiKorisnik: drugiKorisnik || null, poruke: poruke.reverse() });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/poruke — pošalji poruku
router.post("/", async (req, res) => {
  try {
    const { primateljId, naslov, sadrzaj } = req.body;
    if (!primateljId || !sadrzaj) {
      res.status(400).json({ error: "primateljId i sadrzaj su obavezni" });
      return;
    }

    const [nova] = await db.insert(porukeTable).values({
      posiljateljId: req.user!.userId,
      primateljId: parseInt(primateljId),
      naslov: naslov || "Bez naslova",
      sadrzaj: sadrzaj.trim(),
    }).returning();

    res.status(201).json(nova);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/poruke/:id/procitano
router.put("/:id/procitano", async (req, res) => {
  try {
    const [updated] = await db.update(porukeTable)
      .set({ procitanoAt: new Date() })
      .where(and(eq(porukeTable.id, parseInt(req.params.id)), eq(porukeTable.primateljId, req.user!.userId)))
      .returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/poruke/kontakti — lista korisnika s kojima možemo komunicirati
router.get("/kontakti", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;

    let query;
    if (role === "muallim" || role === "admin") {
      // Muallim može pisati roditeljima i adminima
      query = await db.select({ id: usersTable.id, displayName: usersTable.displayName, role: usersTable.role })
        .from(usersTable)
        .where(or(eq(usersTable.role, "roditelj"), eq(usersTable.role, "admin")));
    } else if (role === "roditelj") {
      // Roditelj može pisati muallimima
      query = await db.select({ id: usersTable.id, displayName: usersTable.displayName, role: usersTable.role })
        .from(usersTable)
        .where(or(eq(usersTable.role, "muallim"), eq(usersTable.role, "admin")));
    } else {
      query = [];
    }

    res.json(query.filter(u => u.id !== userId));
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

export default router;
