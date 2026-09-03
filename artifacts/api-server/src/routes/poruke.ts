import { Router } from "express";
import { db } from "@workspace/db";
import { porukeTable, usersTable, ucenikProfiliTable, grupeTable, roditeljUcenikTable, muallimProfiliTable } from "@workspace/db/schema";
import { eq, or, and, desc, inArray, isNull, sql, ne } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { sendPushNotification } from "../lib/push.js";

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
      if (["roditelj", "ucenik"].includes(target.role)) {
        allowed = true;
      } else if (target.role === "admin" || target.role === "muallim") {
        // Samo glavni muallim smije pisati adminima i drugim muallimima.
        const [mp] = await db.select({ isGlavni: muallimProfiliTable.isGlavni })
          .from(muallimProfiliTable).where(eq(muallimProfiliTable.userId, userId));
        allowed = !!mp?.isGlavni;
      }
    } else if (role === "roditelj") {
      if (target.role === "muallim") {
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

    // Best-effort push notifikacija — ne čekamo, ne propagiramo grešku
    const senderName = req.user!.displayName || "Mekteb";
    const previewBody = sadrzaj.trim().length > 80
      ? sadrzaj.trim().slice(0, 80) + "…"
      : sadrzaj.trim();
    sendPushNotification({
      userIds: [targetId],
      title: `Nova poruka od ${senderName}`,
      body: previewBody,
      url: "/poruke",
      data: { type: "poruka", porukaId: nova.id, posiljateljId: userId },
    }).catch((err) => console.error("[Poruke push]", err));

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

type Contact = {
  id: number; displayName: string; role: string;
  grupaId?: number; grupaNaziv?: string;
  grupeNazivi?: string[]; // sve grupe — za roditelje = grupe njihove djece
};

// Jedini izvor istine o tome s kim korisnik smije komunicirati. Koristi ga i
// GET /kontakti (UI) i POST /bulk (server-side provjera opsega) — bez toga bi
// bulk mogao gađati proizvoljne korisnike po ID-u.
async function izracunajKontakte(userId: number, role: string): Promise<Contact[]> {
    let contacts: Contact[] = [];

    if (role === "admin") {
      const muallimi = await db.select({ id: usersTable.id, displayName: usersTable.displayName, role: usersTable.role })
        .from(usersTable).where(eq(usersTable.role, "muallim"));
      contacts = muallimi;
    } else if (role === "muallim") {
      // Samo glavni muallim vidi admine i ostale muallime istog mekteba.
      const [mprofil] = await db.select({ isGlavni: muallimProfiliTable.isGlavni, mektebId: muallimProfiliTable.mektebId })
        .from(muallimProfiliTable).where(eq(muallimProfiliTable.userId, userId));

      let adminContacts: Contact[] = [];
      let muallimiContacts: Contact[] = [];
      if (mprofil?.isGlavni) {
        adminContacts = await db.select({ id: usersTable.id, displayName: usersTable.displayName, role: usersTable.role })
          .from(usersTable).where(eq(usersTable.role, "admin"));

        if (mprofil.mektebId) {
          const ostali = await db
            .select({ id: usersTable.id, displayName: usersTable.displayName, role: usersTable.role })
            .from(usersTable)
            .innerJoin(muallimProfiliTable, eq(muallimProfiliTable.userId, usersTable.id))
            .where(and(eq(muallimProfiliTable.mektebId, mprofil.mektebId), ne(usersTable.id, userId)));
          muallimiContacts = ostali;
        }
      }

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

      contacts = [...adminContacts, ...muallimiContacts, ...ucenikContacts, ...roditeljContacts];
    } else if (role === "roditelj") {
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
      contacts = muallimContacts;
    } else if (role === "ucenik") {
      const [profil] = await db.select({ muallimId: ucenikProfiliTable.muallimId })
        .from(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, userId));
      if (profil?.muallimId) {
        const [muallim] = await db.select({ id: usersTable.id, displayName: usersTable.displayName, role: usersTable.role })
          .from(usersTable).where(eq(usersTable.id, profil.muallimId));
        if (muallim) contacts = [muallim];
      }
    }

    return contacts.filter(u => u.id !== userId);
}

// GET /api/poruke/kontakti — lista korisnika s kojima možemo komunicirati
router.get("/kontakti", async (req, res) => {
  try {
    res.json(await izracunajKontakte(req.user!.userId, req.user!.role));
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/poruke/bulk — grupno slanje (admin/muallim).
// Primatelji se mogu zadati kao eksplicitni primateljIds, kao skup grupa
// (grupeNazivi) i/ili sviRoditelji=true. Sve se svodi na presjek sa
// izracunajKontakte() — pošiljalac nikad ne može gađati korisnika van svog
// opsega, čak ni slanjem tuđeg ID-a. Duplikati (roditelj s više djece ili u
// više odabranih grupa) se uklanjaju.
router.post("/bulk", async (req, res) => {
  try {
    const { primateljIds, naslov, sadrzaj, grupeNazivi, sviRoditelji } = req.body;
    const ciljaGrupe = Array.isArray(grupeNazivi) && grupeNazivi.length > 0;
    if ((!primateljIds?.length && !ciljaGrupe && !sviRoditelji) || !sadrzaj) {
      res.status(400).json({ error: "Primatelji i sadrzaj su obavezni" });
      return;
    }

    const userId = req.user!.userId;
    const role = req.user!.role;

    if (!["admin", "muallim"].includes(role)) {
      res.status(403).json({ error: "Samo admin i muallim mogu slati grupne poruke" });
      return;
    }

    const dozvoljeni = await izracunajKontakte(userId, role);
    const dozvoljeniMap = new Map(dozvoljeni.map(k => [k.id, k]));

    const trazeni = new Set<number>();
    for (const raw of (primateljIds ?? [])) {
      const id = parseInt(String(raw));
      if (Number.isInteger(id)) trazeni.add(id);
    }
    if (sviRoditelji) {
      for (const k of dozvoljeni) if (k.role === "roditelj") trazeni.add(k.id);
    }
    if (ciljaGrupe) {
      const trazeneGrupe = new Set(grupeNazivi.map((g: unknown) => String(g)));
      for (const k of dozvoljeni) {
        const grupe = k.grupeNazivi?.length ? k.grupeNazivi : (k.grupaNaziv ? [k.grupaNaziv] : []);
        if (grupe.some(g => trazeneGrupe.has(g))) trazeni.add(k.id);
      }
    }

    // Presjek sa dozvoljenim opsegom — tiho odbacuje sve van opsega.
    const uOpsegu = [...trazeni].filter(id => dozvoljeniMap.has(id) && id !== userId);
    if (uOpsegu.length === 0) {
      res.status(400).json({ error: "Nema validnih primatelja" });
      return;
    }

    const validRecipients = await db.select({ id: usersTable.id })
      .from(usersTable)
      .where(and(
        inArray(usersTable.id, uOpsegu),
        eq(usersTable.isActive, true)
      ));
    const validIds = [...new Set(validRecipients.map(r => r.id))].filter(id => id !== userId);

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

    // Best-effort push svim primateljima — ne čekamo, ne propagiramo grešku.
    const senderName = req.user!.displayName || "Mekteb";
    const previewBody = sadrzaj.trim().length > 80
      ? sadrzaj.trim().slice(0, 80) + "…"
      : sadrzaj.trim();
    sendPushNotification({
      userIds: validIds,
      title: `Nova poruka od ${senderName}`,
      body: previewBody,
      url: "/poruke",
      data: { type: "poruka", posiljateljId: userId },
    }).catch((err) => console.error("[Poruke bulk push]", err));

    res.status(201).json({ sent: validIds.length });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

export default router;
