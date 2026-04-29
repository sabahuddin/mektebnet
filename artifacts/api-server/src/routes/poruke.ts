import { Router } from "express";
import { db } from "@workspace/db";
import { porukeTable, usersTable, ucenikProfiliTable, grupeTable, roditeljUcenikTable } from "@workspace/db/schema";
import { eq, or, and, desc, inArray, isNull, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

// GET /api/poruke/unread-count — lagani endpoint koji vraća samo broj nepročitanih poruka
router.get("/unread-count", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(porukeTable)
      .where(and(eq(porukeTable.primateljId, userId), isNull(porukeTable.procitanoAt)));
    res.json({ count: row?.count ?? 0 });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

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

    const userId = req.user!.userId;
    const role = req.user!.role;
    const targetId = parseInt(primateljId);

    const [target] = await db.select({ id: usersTable.id, role: usersTable.role })
      .from(usersTable).where(eq(usersTable.id, targetId));
    if (!target) { res.status(404).json({ error: "Primatelj ne postoji" }); return; }

    let allowed = false;
    if (role === "admin") {
      allowed = true;
    } else if (role === "muallim") {
      allowed = ["roditelj", "admin", "ucenik"].includes(target.role);
    } else if (role === "roditelj") {
      if (target.role === "admin") {
        allowed = true;
      } else if (target.role === "muallim") {
        // Roditelj smije pisati samo muallimima čije dijete ima dodano
        const veze = await db.select({ ucenikId: roditeljUcenikTable.ucenikId })
          .from(roditeljUcenikTable).where(eq(roditeljUcenikTable.roditeljId, userId));
        if (veze.length > 0) {
          const ucenikIds = veze.map(v => v.ucenikId);
          const profili = await db.select({ muallimId: ucenikProfiliTable.muallimId })
            .from(ucenikProfiliTable)
            .where(and(inArray(ucenikProfiliTable.userId, ucenikIds), eq(ucenikProfiliTable.muallimId, targetId)));
          allowed = profili.length > 0;
        }
      }
    } else if (role === "ucenik") {
      const [profil] = await db.select({ muallimId: ucenikProfiliTable.muallimId })
        .from(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, userId));
      allowed = profil?.muallimId === targetId;
    }
    if (!allowed) { res.status(403).json({ error: "Nemate dozvolu za slanje poruke ovom korisniku" }); return; }

    const [nova] = await db.insert(porukeTable).values({
      posiljateljId: userId,
      primateljId: targetId,
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

    type Contact = {
      id: number; displayName: string; role: string;
      grupaId?: number; grupaNaziv?: string;
      grupeNazivi?: string[]; // sve grupe — za roditelje = grupe njihove djece
    };
    let contacts: Contact[] = [];

    if (role === "admin") {
      const muallimi = await db.select({ id: usersTable.id, displayName: usersTable.displayName, role: usersTable.role })
        .from(usersTable).where(eq(usersTable.role, "muallim"));
      contacts = muallimi;
    } else if (role === "muallim") {
      const admini = await db.select({ id: usersTable.id, displayName: usersTable.displayName, role: usersTable.role })
        .from(usersTable).where(eq(usersTable.role, "admin"));

      const mojiUcenici = await db.select({
        userId: ucenikProfiliTable.userId,
        grupaId: ucenikProfiliTable.grupaId,
      }).from(ucenikProfiliTable).where(eq(ucenikProfiliTable.muallimId, userId));

      let ucenikContacts: Contact[] = [];
      let roditeljContacts: Contact[] = [];

      if (mojiUcenici.length > 0) {
        const uIds = mojiUcenici.map(u => u.userId);
        const ucenikUsers = await db.select({ id: usersTable.id, displayName: usersTable.displayName, role: usersTable.role })
          .from(usersTable).where(inArray(usersTable.id, uIds));

        const grupaIds = [...new Set(mojiUcenici.filter(u => u.grupaId).map(u => u.grupaId!))];
        let grupeMap: Record<number, string> = {};
        if (grupaIds.length > 0) {
          const grupe = await db.select({ id: grupeTable.id, naziv: grupeTable.naziv }).from(grupeTable).where(inArray(grupeTable.id, grupaIds));
          grupeMap = Object.fromEntries(grupe.map(g => [g.id, g.naziv]));
        }

        ucenikContacts = ucenikUsers.map(u => {
          const profil = mojiUcenici.find(p => p.userId === u.id);
          const naziv = profil?.grupaId ? grupeMap[profil.grupaId] : undefined;
          return {
            ...u,
            grupaId: profil?.grupaId || undefined,
            grupaNaziv: naziv,
            grupeNazivi: naziv ? [naziv] : [],
          };
        });

        // Roditelji svojih učenika (samo oni povezani sa muallimovim učenicima)
        const veze = await db.select({
          roditeljId: roditeljUcenikTable.roditeljId,
          ucenikId: roditeljUcenikTable.ucenikId,
        }).from(roditeljUcenikTable).where(inArray(roditeljUcenikTable.ucenikId, uIds));

        if (veze.length > 0) {
          const roditeljIds = [...new Set(veze.map(v => v.roditeljId))];
          const roditeljUsers = await db.select({ id: usersTable.id, displayName: usersTable.displayName, role: usersTable.role })
            .from(usersTable).where(inArray(usersTable.id, roditeljIds));

          // Map: roditeljId → set grupe naziva
          const ucenikGrupaMap: Record<number, number | null> = {};
          for (const u of mojiUcenici) ucenikGrupaMap[u.userId] = u.grupaId ?? null;

          const roditeljGrupeMap: Record<number, Set<string>> = {};
          for (const v of veze) {
            const grId = ucenikGrupaMap[v.ucenikId];
            const naziv = grId ? grupeMap[grId] : undefined;
            if (!naziv) continue;
            if (!roditeljGrupeMap[v.roditeljId]) roditeljGrupeMap[v.roditeljId] = new Set();
            roditeljGrupeMap[v.roditeljId].add(naziv);
          }

          roditeljContacts = roditeljUsers.map(r => ({
            ...r,
            grupeNazivi: Array.from(roditeljGrupeMap[r.id] || []),
          }));
        }
      }

      contacts = [...admini, ...ucenikContacts, ...roditeljContacts];
    } else if (role === "roditelj") {
      // Admini uvijek
      const admini = await db.select({ id: usersTable.id, displayName: usersTable.displayName, role: usersTable.role })
        .from(usersTable).where(eq(usersTable.role, "admin"));

      // Samo muallimi povezani sa svojom djecom
      const veze = await db.select({ ucenikId: roditeljUcenikTable.ucenikId })
        .from(roditeljUcenikTable).where(eq(roditeljUcenikTable.roditeljId, userId));

      let muallimContacts: Contact[] = [];
      if (veze.length > 0) {
        const ucenikIds = veze.map(v => v.ucenikId);
        const profili = await db.select({ muallimId: ucenikProfiliTable.muallimId })
          .from(ucenikProfiliTable).where(inArray(ucenikProfiliTable.userId, ucenikIds));
        const muallimIds = [...new Set(profili.map(p => p.muallimId).filter((x): x is number => x != null))];
        if (muallimIds.length > 0) {
          muallimContacts = await db.select({ id: usersTable.id, displayName: usersTable.displayName, role: usersTable.role })
            .from(usersTable).where(inArray(usersTable.id, muallimIds));
        }
      }
      contacts = [...muallimContacts, ...admini];
    } else if (role === "ucenik") {
      const [profil] = await db.select({ muallimId: ucenikProfiliTable.muallimId })
        .from(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, userId));
      if (profil?.muallimId) {
        const [muallim] = await db.select({ id: usersTable.id, displayName: usersTable.displayName, role: usersTable.role })
          .from(usersTable).where(eq(usersTable.id, profil.muallimId));
        if (muallim) contacts = [muallim];
      }
    }

    res.json(contacts.filter(u => u.id !== userId));
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/poruke/bulk — send message to multiple recipients (admin/muallim only)
router.post("/bulk", async (req, res) => {
  try {
    const { primateljIds, naslov, sadrzaj } = req.body;
    if (!primateljIds?.length || !sadrzaj) {
      res.status(400).json({ error: "primateljIds i sadrzaj su obavezni" });
      return;
    }

    const userId = req.user!.userId;
    const role = req.user!.role;

    if (!["admin", "muallim"].includes(role)) {
      res.status(403).json({ error: "Samo admin i muallim mogu slati grupne poruke" });
      return;
    }

    const validRecipients = await db.select({ id: usersTable.id })
      .from(usersTable)
      .where(and(
        inArray(usersTable.id, primateljIds.map((id: any) => parseInt(id))),
        eq(usersTable.isActive, true)
      ));
    const validIds = validRecipients.map(r => r.id).filter(id => id !== userId);

    if (validIds.length === 0) {
      res.status(400).json({ error: "Nema validnih primatelja" });
      return;
    }

    const values = validIds.map(pid => ({
      posiljateljId: userId,
      primateljId: pid,
      naslov: naslov || "Bez naslova",
      sadrzaj: sadrzaj.trim(),
    }));

    await db.insert(porukeTable).values(values);

    res.status(201).json({ sent: validIds.length });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

export default router;
