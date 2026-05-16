import { Router } from "express";
import { db } from "@workspace/db";
import {
  krunisanjaTable,
  krunisanjeLekcijeTable,
  studentKrunisanjaTable,
  pitanjaBankaTable,
  ilmihalLekcijeTable,
  medaljoniTable,
  studentMedaljoniTable,
  studentProgressTable,
  etapaPolaganjaTable,
} from "@workspace/db/schema";
import { eq, and, inArray, asc } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

// GET /api/krunisanja/nivo/:n
// Vraća krunisanje + krunske lekcije + status polaganja za prijavljenog učenika.
router.get("/nivo/:n", async (req, res) => {
  try {
    const nivo = Number(req.params.n);
    if (!Number.isInteger(nivo) || nivo < 1 || nivo > 3) {
      return res.status(400).json({ error: "Nivo mora biti 1, 2 ili 3" });
    }
    const [krunisanje] = await db
      .select()
      .from(krunisanjaTable)
      .where(eq(krunisanjaTable.nivo, nivo))
      .limit(1);
    if (!krunisanje) return res.status(404).json({ error: "Krunisanje za ovaj nivo ne postoji" });

    const lekcije = await db
      .select()
      .from(krunisanjeLekcijeTable)
      .where(
        and(
          eq(krunisanjeLekcijeTable.krunisanjeId, krunisanje.id),
          eq(krunisanjeLekcijeTable.isPublished, true),
        ),
      )
      .orderBy(asc(krunisanjeLekcijeTable.redoslijed));

    let polozeno: { polozenoAt: Date; procenat: number; brojTacnih: number; brojPitanja: number } | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const jwt = await import("jsonwebtoken");
        const JWT_SECRET = process.env.JWT_SECRET || "mekteb-secret-change-in-production";
        const payload = jwt.default.verify(authHeader.slice(7), JWT_SECRET) as { userId: number };
        const userIdStr = String(payload.userId);
        const [row] = await db
          .select()
          .from(studentKrunisanjaTable)
          .where(
            and(
              eq(studentKrunisanjaTable.studentId, userIdStr),
              eq(studentKrunisanjaTable.krunisanjeId, krunisanje.id),
            ),
          )
          .limit(1);
        if (row) {
          polozeno = {
            polozenoAt: row.polozenoAt,
            procenat: row.procenat,
            brojTacnih: row.brojTacnih,
            brojPitanja: row.brojPitanja,
          };
        }
      } catch {
        /* neulogovan ili nevažeći token */
      }
    }

    const ids = Array.isArray(krunisanje.kvizPitanjaIds) ? krunisanje.kvizPitanjaIds : [];
    res.json({
      krunisanje: {
        id: krunisanje.id,
        nivo: krunisanje.nivo,
        naslov: krunisanje.naslov,
        opisHtml: krunisanje.opisHtml,
        ikona: krunisanje.ikona,
        boja: krunisanje.boja,
        pragProlazaPercent: krunisanje.pragProlazaPercent,
        isGating: krunisanje.isGating,
        brojPitanja: ids.length,
        imaKviz: ids.length > 0,
      },
      lekcije,
      polozeno,
    });
  } catch (err) {
    console.error("[krunisanja/nivo] error", err);
    res.status(500).json({ error: "Greška pri učitavanju krunisanja" });
  }
});

// POST /api/krunisanja/:id/start
router.post("/:id/start", requireAuth, requireRole("ucenik"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const userId = String(req.user?.userId ?? "");
    const [krunisanje] = await db
      .select()
      .from(krunisanjaTable)
      .where(eq(krunisanjaTable.id, id))
      .limit(1);
    if (!krunisanje) return res.status(404).json({ error: "Krunisanje ne postoji" });
    const ids = Array.isArray(krunisanje.kvizPitanjaIds) ? krunisanje.kvizPitanjaIds : [];
    if (ids.length === 0) {
      return res.status(400).json({ error: "Krunisanje nema pitanja. Obavijesti muallima." });
    }
    const gateErr = await proveriGatingKrunisanja(userId, krunisanje);
    if (gateErr) return res.status(403).json({ error: gateErr });
    const pitanja = await db
      .select({
        id: pitanjaBankaTable.id,
        pitanje: pitanjaBankaTable.pitanje,
        opcije: pitanjaBankaTable.opcije,
        slika: pitanjaBankaTable.slika,
        vrsta: pitanjaBankaTable.vrsta,
      })
      .from(pitanjaBankaTable)
      .where(inArray(pitanjaBankaTable.id, ids));
    const order = new Map(ids.map((id, i) => [id, i]));
    pitanja.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    res.json({
      krunisanjeId: krunisanje.id,
      naslov: krunisanje.naslov,
      pragProlazaPercent: krunisanje.pragProlazaPercent,
      pitanja: pitanja.map((p) => ({
        id: p.id,
        pitanje: p.pitanje,
        opcije: p.opcije,
        slika: p.slika,
        vrsta: p.vrsta,
      })),
    });
  } catch (err) {
    console.error("[krunisanja/start] error", err);
    res.status(500).json({ error: "Greška pri pokretanju" });
  }
});

// POST /api/krunisanja/:id/predaj
// Body: { odgovori: [{ pitanjeId, optionIndex }] }
router.post("/:id/predaj", requireAuth, requireRole("ucenik"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const userId = String(req.user?.userId ?? "");
    const odgovori: { pitanjeId: number; optionIndex: number }[] = Array.isArray(req.body?.odgovori)
      ? req.body.odgovori
      : [];

    const [krunisanje] = await db
      .select()
      .from(krunisanjaTable)
      .where(eq(krunisanjaTable.id, id))
      .limit(1);
    if (!krunisanje) return res.status(404).json({ error: "Krunisanje ne postoji" });

    const ids = Array.isArray(krunisanje.kvizPitanjaIds) ? krunisanje.kvizPitanjaIds : [];
    if (ids.length === 0) return res.status(400).json({ error: "Krunisanje nema pitanja" });

    const gateErr = await proveriGatingKrunisanja(userId, krunisanje);
    if (gateErr) return res.status(403).json({ error: gateErr });

    const pitanja = await db
      .select({
        id: pitanjaBankaTable.id,
        correctIndex: pitanjaBankaTable.correctIndex,
      })
      .from(pitanjaBankaTable)
      .where(inArray(pitanjaBankaTable.id, ids));
    const byId = new Map(pitanja.map((p) => [p.id, p]));

    let tacni = 0;
    for (const pid of ids) {
      const p = byId.get(pid);
      if (!p) continue;
      const odgovor = odgovori.find((o) => o.pitanjeId === pid);
      if (!odgovor) continue;
      if (Number(odgovor.optionIndex) === Number(p.correctIndex)) tacni++;
    }
    const ukupno = ids.length;
    const procenat = ukupno > 0 ? Math.round((tacni / ukupno) * 100) : 0;
    const polozeno = procenat >= (krunisanje.pragProlazaPercent ?? 70);

    let prvoPolaganje = false;
    if (polozeno) {
      const inserted = await db
        .insert(studentKrunisanjaTable)
        .values({
          studentId: userId,
          krunisanjeId: krunisanje.id,
          brojTacnih: tacni,
          brojPitanja: ukupno,
          procenat,
        })
        .onConflictDoNothing()
        .returning();
      prvoPolaganje = inserted.length > 0;
    }

    res.json({
      polozeno,
      procenat,
      brojTacnih: tacni,
      brojPitanja: ukupno,
      pragProlazaPercent: krunisanje.pragProlazaPercent,
      prvoPolaganje,
    });
  } catch (err) {
    console.error("[krunisanja/predaj] error", err);
    res.status(500).json({ error: "Greška pri predaji" });
  }
});

// GET /api/krunisanja/lekcija/:slug — pojedinačna krunska lekcija
// Vraća i `nivo` parent krunisanja kako bi FE mogao back-link da bude tačan
// (nivo 1/2/3), umjesto hard-coded /krunisanje/1.
router.get("/lekcija/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;
    const [row] = await db
      .select({
        id: krunisanjeLekcijeTable.id,
        krunisanjeId: krunisanjeLekcijeTable.krunisanjeId,
        slug: krunisanjeLekcijeTable.slug,
        naslov: krunisanjeLekcijeTable.naslov,
        contentHtml: krunisanjeLekcijeTable.contentHtml,
        redoslijed: krunisanjeLekcijeTable.redoslijed,
        isPublished: krunisanjeLekcijeTable.isPublished,
        nivo: krunisanjaTable.nivo,
      })
      .from(krunisanjeLekcijeTable)
      .innerJoin(krunisanjaTable, eq(krunisanjeLekcijeTable.krunisanjeId, krunisanjaTable.id))
      .where(
        and(
          eq(krunisanjeLekcijeTable.slug, slug),
          eq(krunisanjeLekcijeTable.isPublished, true),
        ),
      )
      .limit(1);
    if (!row) return res.status(404).json({ error: "Lekcija ne postoji" });
    res.json(row);
  } catch (err) {
    console.error("[krunisanja/lekcija] error", err);
    res.status(500).json({ error: "Greška" });
  }
});

// Server-side gating za krunisanje:
//   - sve lekcije ovog nivoa moraju biti završene,
//   - svi medaljoni (etape) ovog nivoa moraju biti osvojeni,
//   - prethodno krunisanje (nivo-1) položeno ako je `isGating` i ima ispit.
async function proveriGatingKrunisanja(
  userId: string,
  krunisanje: { id: number; nivo: number; naslov: string | null },
): Promise<string | null> {
  if (!userId) return "Niste prijavljeni";

  // 1) Sve lekcije ovog nivoa završene
  const sveLekcije = await db
    .select({ id: ilmihalLekcijeTable.id })
    .from(ilmihalLekcijeTable)
    .where(eq(ilmihalLekcijeTable.nivo, krunisanje.nivo));
  const [progressRow] = await db
    .select({ completedLessons: studentProgressTable.completedLessons })
    .from(studentProgressTable)
    .where(eq(studentProgressTable.studentId, userId))
    .limit(1);
  const zavrsene = new Set((progressRow?.completedLessons as number[] | undefined) ?? []);
  const nedostajeLekcija = sveLekcije.filter((l) => !zavrsene.has(l.id)).length;
  if (nedostajeLekcija > 0) {
    return `Završi sve lekcije nivoa ${krunisanje.nivo} (nedostaje ${nedostajeLekcija}/${sveLekcije.length}).`;
  }

  // 2) Svi medaljoni (etape) ovog nivoa osvojeni. Za medaljone s
  // konfigurisanim kvizom dodatno zahtijevamo dokaz o položenom ispitu
  // (`etapa_polaganja.polozeno=true`) — ne samo `student_medaljoni` zapis —
  // čime se zatvara potencijalni bypass kroz legacy claim endpoint.
  const sviMedaljoni = await db
    .select({ id: medaljoniTable.id, kvizPitanjaIds: medaljoniTable.kvizPitanjaIds })
    .from(medaljoniTable)
    .where(eq(medaljoniTable.nivo, krunisanje.nivo));
  if (sviMedaljoni.length > 0) {
    const osvojeniRows = await db
      .select({ medaljonId: studentMedaljoniTable.medaljonId })
      .from(studentMedaljoniTable)
      .where(
        and(
          eq(studentMedaljoniTable.studentId, userId),
          inArray(studentMedaljoniTable.medaljonId, sviMedaljoni.map((m) => m.id)),
        ),
      );
    const osvojeni = new Set(osvojeniRows.map((r) => r.medaljonId));
    const nedostajeMed = sviMedaljoni.filter((m) => !osvojeni.has(m.id)).length;
    if (nedostajeMed > 0) {
      return `Osvoji sve medaljone nivoa ${krunisanje.nivo} (nedostaje ${nedostajeMed}/${sviMedaljoni.length}).`;
    }
    // Etape sa kvizom — provjeri da postoji prolaz u etapa_polaganja.
    const kvizMedaljoni = sviMedaljoni.filter(
      (m) => Array.isArray(m.kvizPitanjaIds) && (m.kvizPitanjaIds as unknown[]).length > 0,
    );
    if (kvizMedaljoni.length > 0) {
      const polozenoRows = await db
        .select({ medaljonId: etapaPolaganjaTable.medaljonId })
        .from(etapaPolaganjaTable)
        .where(
          and(
            eq(etapaPolaganjaTable.studentId, userId),
            eq(etapaPolaganjaTable.polozeno, true),
            inArray(etapaPolaganjaTable.medaljonId, kvizMedaljoni.map((m) => m.id)),
          ),
        );
      const polozenoSet = new Set(polozenoRows.map((r) => r.medaljonId));
      const bezIspita = kvizMedaljoni.filter((m) => !polozenoSet.has(m.id)).length;
      if (bezIspita > 0) {
        return `Položi završne ispite svih etapa nivoa ${krunisanje.nivo} (nedostaje ${bezIspita}/${kvizMedaljoni.length}).`;
      }
    }
  }

  // 3) Prethodno krunisanje (ako postoji i ako je gating + ima ispit)
  if (krunisanje.nivo > 1) {
    const [prev] = await db
      .select()
      .from(krunisanjaTable)
      .where(eq(krunisanjaTable.nivo, krunisanje.nivo - 1))
      .limit(1);
    const prevIds = prev ? (Array.isArray(prev.kvizPitanjaIds) ? prev.kvizPitanjaIds : []) : [];
    if (prev && prev.isGating && prevIds.length > 0) {
      const [pass] = await db
        .select({ id: studentKrunisanjaTable.id })
        .from(studentKrunisanjaTable)
        .where(
          and(
            eq(studentKrunisanjaTable.studentId, userId),
            eq(studentKrunisanjaTable.krunisanjeId, prev.id),
          ),
        )
        .limit(1);
      if (!pass) {
        return `Prvo položi krunisanje nivoa ${krunisanje.nivo - 1}.`;
      }
    }
  }

  return null;
}

// Helper: vrati Set ID-jeva krunisanja koja je student položio
export async function polozenaKrunisanja(studentId: string): Promise<Set<number>> {
  const rows = await db
    .select({ krunisanjeId: studentKrunisanjaTable.krunisanjeId })
    .from(studentKrunisanjaTable)
    .where(eq(studentKrunisanjaTable.studentId, studentId));
  return new Set(rows.map((r) => r.krunisanjeId));
}

export default router;
