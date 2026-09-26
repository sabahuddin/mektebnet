import { Router } from "express";
import { db } from "@workspace/db";
import { biltenMuallimiCitanjaTable, biltenMuallimiTable, usersTable } from "@workspace/db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { sendPushNotification } from "../lib/push.js";
import { logger } from "../lib/logger.js";

const router = Router();
router.use(requireAuth);
router.use((req, res, next) => {
  if (req.user?.role !== "admin" && req.user?.role !== "muallim") {
    res.status(403).json({ error: "Samo administratori i muallimi imaju pristup biltenu" });
    return;
  }
  next();
});

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function content(body: unknown): { naslov: string; sadrzaj: string } | null {
  if (!body || typeof body !== "object") return null;
  const values = body as Record<string, unknown>;
  if (typeof values.naslov !== "string" || typeof values.sadrzaj !== "string") return null;
  const naslov = values.naslov.trim();
  const sadrzaj = values.sadrzaj.trim();
  if (!naslov || naslov.length > 180 || !sadrzaj || sadrzaj.length > 12000) return null;
  return { naslov, sadrzaj };
}

function onlyAdmin(role: string, res: import("express").Response): boolean {
  if (role === "admin") return true;
  res.status(403).json({ error: "Samo administrator može uređivati i objavljivati obavijesti" });
  return false;
}

const selection = {
  id: biltenMuallimiTable.id,
  naslov: biltenMuallimiTable.naslov,
  sadrzaj: biltenMuallimiTable.sadrzaj,
  status: biltenMuallimiTable.status,
  createdAt: biltenMuallimiTable.createdAt,
  updatedAt: biltenMuallimiTable.updatedAt,
  publishedAt: biltenMuallimiTable.publishedAt,
  autorName: usersTable.displayName,
  procitanoAt: biltenMuallimiCitanjaTable.procitanoAt,
};

const allWithReadState = (userId: number) =>
  db.select(selection).from(biltenMuallimiTable)
    .leftJoin(usersTable, eq(biltenMuallimiTable.autorId, usersTable.id))
    .leftJoin(biltenMuallimiCitanjaTable, and(
      eq(biltenMuallimiCitanjaTable.biltenId, biltenMuallimiTable.id),
      eq(biltenMuallimiCitanjaTable.muallimId, userId),
    ));

router.get("/neprocitano", async (req, res) => {
  if (req.user!.role === "admin") { res.json({ count: 0 }); return; }
  try {
    const [row] = await db.select({ count: sql<number>`count(*)::int` })
      .from(biltenMuallimiTable)
      .leftJoin(biltenMuallimiCitanjaTable, and(
        eq(biltenMuallimiCitanjaTable.biltenId, biltenMuallimiTable.id),
        eq(biltenMuallimiCitanjaTable.muallimId, req.user!.userId),
      ))
      .where(and(
        eq(biltenMuallimiTable.status, "objavljeno"),
        isNull(biltenMuallimiCitanjaTable.biltenId),
      ));
    res.json({ count: row?.count ?? 0 });
  } catch (err) {
    req.log.error({ err }, "Bilten: nepročitano");
    res.status(500).json({ error: "Nije moguće učitati broj nepročitanih obavijesti" });
  }
});

router.get("/", async (req, res) => {
  try {
    const rows = await allWithReadState(req.user!.userId)
      .where(req.user!.role === "admin" ? undefined : eq(biltenMuallimiTable.status, "objavljeno"))
      .orderBy(desc(biltenMuallimiTable.publishedAt), desc(biltenMuallimiTable.createdAt));
    res.json(rows.map(row => ({ ...row, autorName: row.autorName ?? "Administrator" })));
  } catch (err) {
    req.log.error({ err }, "Bilten: lista");
    res.status(500).json({ error: "Nije moguće učitati obavijesti" });
  }
});

router.get("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Neispravan ID" }); return; }
  try {
    const [row] = await allWithReadState(req.user!.userId)
      .where(and(
        eq(biltenMuallimiTable.id, id),
        req.user!.role === "admin" ? undefined : eq(biltenMuallimiTable.status, "objavljeno"),
      ));
    if (!row) { res.status(404).json({ error: "Obavijest nije pronađena" }); return; }
    res.json({ ...row, autorName: row.autorName ?? "Administrator" });
  } catch (err) {
    req.log.error({ err }, "Bilten: detalj");
    res.status(500).json({ error: "Nije moguće učitati obavijest" });
  }
});

router.post("/", async (req, res) => {
  if (!onlyAdmin(req.user!.role, res)) return;
  const values = content(req.body);
  if (!values) { res.status(400).json({ error: "Unesite naslov (do 180 znakova) i tekst (do 12000 znakova)" }); return; }
  try {
    const [row] = await db.insert(biltenMuallimiTable).values({
      ...values, autorId: req.user!.userId,
    }).returning();
    res.status(201).json({ ...row, autorName: req.user!.displayName, procitanoAt: null });
  } catch (err) {
    req.log.error({ err }, "Bilten: kreiranje nacrta");
    res.status(500).json({ error: "Nije moguće sačuvati nacrt" });
  }
});

router.put("/:id", async (req, res) => {
  if (!onlyAdmin(req.user!.role, res)) return;
  const id = parseId(req.params.id);
  const values = content(req.body);
  if (!id || !values) { res.status(400).json({ error: "Neispravan ID ili sadržaj obavijesti" }); return; }
  try {
    const [row] = await db.update(biltenMuallimiTable)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(biltenMuallimiTable.id, id), eq(biltenMuallimiTable.status, "nacrt")))
      .returning();
    if (!row) { res.status(409).json({ error: "Objavljena obavijest se ne može mijenjati" }); return; }
    res.json({ ...row, autorName: req.user!.displayName, procitanoAt: null });
  } catch (err) {
    req.log.error({ err }, "Bilten: uređivanje nacrta");
    res.status(500).json({ error: "Nije moguće sačuvati nacrt" });
  }
});

router.post("/:id/objavi", async (req, res) => {
  if (!onlyAdmin(req.user!.role, res)) return;
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Neispravan ID" }); return; }
  try {
    // Atomska promjena statusa: dvostruki klik ne smije poslati dvije obavijesti.
    const [row] = await db.update(biltenMuallimiTable)
      .set({ status: "objavljeno", publishedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(biltenMuallimiTable.id, id), eq(biltenMuallimiTable.status, "nacrt")))
      .returning();
    if (!row) { res.status(409).json({ error: "Nacrt ne postoji ili je već objavljen" }); return; }

    const recipients = await db.select({ id: usersTable.id }).from(usersTable)
      .where(and(eq(usersTable.role, "muallim"), eq(usersTable.isActive, true)));
    // Razvojna baza može imati ID-jeve koji se poklapaju sa stvarnim OneSignal
    // external_id vrijednostima. Push se šalje ISKLJUČIVO iz produkcije.
    if (recipients.length && process.env.NODE_ENV === "production") {
      sendPushNotification({
        userIds: recipients.map(u => u.id),
        title: row.naslov,
        body: row.sadrzaj.length > 100 ? `${row.sadrzaj.slice(0, 100)}…` : row.sadrzaj,
        url: "/muallim?tab=bilten",
        data: { type: "bilten_muallimi", biltenId: row.id },
      }).catch(err => logger.error({ err }, "Bilten: push slanje nije uspjelo"));
    }
    res.json({ ...row, autorName: req.user!.displayName, procitanoAt: null });
  } catch (err) {
    req.log.error({ err }, "Bilten: objava");
    res.status(500).json({ error: "Nije moguće objaviti obavijest" });
  }
});

router.post("/:id/procitano", async (req, res) => {
  if (req.user!.role !== "muallim") {
    res.status(403).json({ error: "Samo muallim može označiti obavijest pročitanom" });
    return;
  }
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Neispravan ID" }); return; }
  try {
    const [published] = await db.select({ id: biltenMuallimiTable.id })
      .from(biltenMuallimiTable)
      .where(and(eq(biltenMuallimiTable.id, id), eq(biltenMuallimiTable.status, "objavljeno")));
    if (!published) { res.status(404).json({ error: "Obavijest nije pronađena" }); return; }
    await db.insert(biltenMuallimiCitanjaTable)
      .values({ biltenId: id, muallimId: req.user!.userId })
      .onConflictDoNothing();
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Bilten: oznaka pročitanog");
    res.status(500).json({ error: "Nije moguće označiti obavijest pročitanom" });
  }
});

export default router;