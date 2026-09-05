import { Router } from "express";
import { db } from "@workspace/db";
import {
  medaljoniTable,
  studentMedaljoniTable,
  etapaPolaganjaTable,
  pitanjaBankaTable,
  ilmihalLekcijeTable,
  studentProgressTable,
  kvizPitanjaTable,
} from "@workspace/db/schema";
import { eq, and, inArray, desc, lte, asc } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { JWT_SECRET } from "../lib/jwt-secret.js";

const router = Router();

type EtapaQuestionConfig = {
  kvizIds?: number[] | null;
  kvizPitanjaIds?: number[] | null;
};

export async function resolveEtapaPitanjaIds(config: EtapaQuestionConfig): Promise<number[]> {
  const result: number[] = [];
  const seen = new Set<number>();
  const append = (id: number) => {
    if (Number.isInteger(id) && id > 0 && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  };
  for (const id of Array.isArray(config.kvizPitanjaIds) ? config.kvizPitanjaIds : []) append(Number(id));
  for (const kvizId of Array.isArray(config.kvizIds) ? config.kvizIds : []) {
    const rows = await db
      .select({ pitanjeId: kvizPitanjaTable.pitanjeId })
      .from(kvizPitanjaTable)
      .where(eq(kvizPitanjaTable.kvizId, Number(kvizId)))
      .orderBy(asc(kvizPitanjaTable.redoslijed), asc(kvizPitanjaTable.id));
    for (const row of rows) append(row.pitanjeId);
  }
  return result;
}

async function findMedaljon(slug: string) {
  const [exact] = await db.select().from(medaljoniTable).where(eq(medaljoniTable.slug, slug)).limit(1);
  if (exact) return exact;
  const match = slug.match(/^medaljon-nivo(\d+)-(\d+)$/);
  if (!match) return null;
  const nivo = Number(match[1]);
  const pos = Number(match[2]);
  const rows = await db
    .select()
    .from(medaljoniTable)
    .where(eq(medaljoniTable.nivo, nivo))
    .orderBy(asc(medaljoniTable.posAfterRedoslijed));
  return rows.find((row) => row.posAfterRedoslijed === pos) ?? null;
}

// GET /api/etape/medaljon/:slug
// Vraća meta etape, lekcije koje pokriva, ukupan broj pitanja, prag prolaza,
// status polaganja za prijavljenog učenika (poslednji pokušaj + da li je
// uopće položena).
router.get("/medaljon/:slug", async (req, res) => {
  try {
    const slug = String(req.params.slug);
    // Opcionalno parsiranje JWT-a (ova ruta nema requireAuth middleware,
    // a `req.user` se postavlja samo tamo gdje requireAuth radi). Bez ovoga
    // bi `polozeno`/`brojPokusaja` uvijek bili null/0 za normalne bearer
    // pozive, pa učenik ne bi vidio status polaganja na detail stranici.
    let userId = "";
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const jwt = await import("jsonwebtoken");
        const payload = jwt.default.verify(authHeader.slice(7), JWT_SECRET) as { userId: number };
        userId = String(payload.userId);
      } catch {
        /* neulogovan ili nevažeći token */
      }
    }

    const medaljon = await findMedaljon(slug);
    if (!medaljon) return res.status(404).json({ error: "Etapa ne postoji" });

    // Lekcije koje ova etapa pokriva = sve lekcije u istom nivou sa
    // redoslijed <= posAfterRedoslijed I redoslijed > prethodne etape u
    // istom nivou (ako postoji). To je "Ponavljanje" tab.
    const sveEtapeNivoa = await db
      .select({ id: medaljoniTable.id, pos: medaljoniTable.posAfterRedoslijed })
      .from(medaljoniTable)
      .where(eq(medaljoniTable.nivo, medaljon.nivo))
      .orderBy(asc(medaljoniTable.posAfterRedoslijed));
    const idx = sveEtapeNivoa.findIndex((e) => e.id === medaljon.id);
    const prethodnaPos = idx > 0 ? sveEtapeNivoa[idx - 1]!.pos : 0;
    const lekcije = await db
      .select({
        id: ilmihalLekcijeTable.id,
        slug: ilmihalLekcijeTable.slug,
        naslov: ilmihalLekcijeTable.naslov,
        redoslijed: ilmihalLekcijeTable.redoslijed,
      })
      .from(ilmihalLekcijeTable)
      .where(
        and(
          eq(ilmihalLekcijeTable.nivo, medaljon.nivo),
          lte(ilmihalLekcijeTable.redoslijed, medaljon.posAfterRedoslijed),
          eq(ilmihalLekcijeTable.dostupnost, "svi"),
        ),
      )
      .orderBy(asc(ilmihalLekcijeTable.redoslijed));
    const lekcijeEtape = lekcije.filter((l) => l.redoslijed > prethodnaPos);

    // Status polaganja (samo za prijavljene učenike)
    const pokusaji = userId
      ? await db
          .select()
          .from(etapaPolaganjaTable)
          .where(
            and(
              eq(etapaPolaganjaTable.studentId, userId),
              eq(etapaPolaganjaTable.medaljonId, medaljon.id),
            ),
          )
          .orderBy(desc(etapaPolaganjaTable.createdAt))
          .limit(20)
      : [];
    const polozeno = pokusaji.find((p) => p.polozeno) ?? null;

    const ids = await resolveEtapaPitanjaIds(medaljon);
    res.json({
      medaljon: {
        id: medaljon.id,
        slug: medaljon.slug,
        nivo: medaljon.nivo,
        naziv: medaljon.naziv,
        opis: medaljon.opis,
        ikona: medaljon.ikona,
        boja: medaljon.boja,
        contentHtml: medaljon.contentHtml,
        posAfterRedoslijed: medaljon.posAfterRedoslijed,
        pragProlazaPercent: medaljon.pragProlazaPercent,
        isGating: medaljon.isGating,
        brojPitanja: ids.length,
        imaKviz: ids.length > 0,
      },
      lekcije: lekcijeEtape,
      polozeno: polozeno
        ? {
            id: polozeno.id,
            procenat: polozeno.procenat,
            brojTacnih: polozeno.brojTacnih,
            brojPitanja: polozeno.brojPitanja,
            polozenoAt: polozeno.createdAt,
          }
        : null,
      brojPokusaja: pokusaji.length,
    });
  } catch (err) {
    console.error("[etape/medaljon] error", err);
    res.status(500).json({ error: "Greška pri učitavanju etape" });
  }
  return;
});

// POST /api/etape/medaljon/:slug/start
// Servira pitanja za polaganje. BEZ tačnih odgovora — server scoring na predaj.
router.post("/medaljon/:slug/start", requireAuth, requireRole("ucenik"), async (req, res) => {
  try {
    const slug = String(req.params.slug);
    const userId = String(req.user?.userId ?? "");
    const medaljon = await findMedaljon(slug);
    if (!medaljon) return res.status(404).json({ error: "Etapa ne postoji" });
    const ids = await resolveEtapaPitanjaIds(medaljon);
    if (ids.length === 0) {
      return res.status(400).json({ error: "Etapa nema konfigurisanih pitanja. Obavijesti muallima." });
    }
    // Server-side gating: učenik mora završiti sve lekcije etape (ili ranije) prije nego što pristupi ispitu.
    const gateErr = await proverigatingEtape(userId, medaljon);
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
    // Sortiraj prema redoslijedu iz `kvizPitanjaIds`
    const order = new Map(ids.map((id, i) => [id, i]));
    pitanja.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    res.json({
      medaljonId: medaljon.id,
      naziv: medaljon.naziv,
      pragProlazaPercent: medaljon.pragProlazaPercent,
      pitanja: pitanja.map((p) => ({
        id: p.id,
        pitanje: p.pitanje,
        opcije: p.opcije,
        slika: p.slika,
        vrsta: p.vrsta,
      })),
    });
  } catch (err) {
    console.error("[etape/start] error", err);
    res.status(500).json({ error: "Greška pri pokretanju polaganja" });
  }
  return;
});

// POST /api/etape/medaljon/:slug/predaj
// Body: { odgovori: [{ pitanjeId, optionIndex }] }
// Server-side scoring. Ako prošao i etapa gating → claim medaljon automatski.
router.post("/medaljon/:slug/predaj", requireAuth, requireRole("ucenik"), async (req, res) => {
  try {
    const slug = String(req.params.slug);
    const userId = String(req.user?.userId ?? "");
    const odgovori: { pitanjeId: number; optionIndex: number }[] = Array.isArray(req.body?.odgovori)
      ? req.body.odgovori
      : [];

    const medaljon = await findMedaljon(slug);
    if (!medaljon) return res.status(404).json({ error: "Etapa ne postoji" });

    const ids = await resolveEtapaPitanjaIds(medaljon);
    if (ids.length === 0) return res.status(400).json({ error: "Etapa nema pitanja" });

    // Server-side gating: isto pravilo kao na /start. Sprječava direktan POST /predaj.
    const gateErr = await proverigatingEtape(userId, medaljon);
    if (gateErr) return res.status(403).json({ error: gateErr });

    const pitanja = await db
      .select({
        id: pitanjaBankaTable.id,
        correctIndex: pitanjaBankaTable.correctIndex,
        vrsta: pitanjaBankaTable.vrsta,
      })
      .from(pitanjaBankaTable)
      .where(inArray(pitanjaBankaTable.id, ids));
    const byId = new Map(pitanja.map((p) => [p.id, p]));

    let tacni = 0;
    for (const id of ids) {
      const p = byId.get(id);
      if (!p) continue;
      const odgovor = odgovori.find((o) => o.pitanjeId === id);
      if (!odgovor) continue;
      if (Number(odgovor.optionIndex) === Number(p.correctIndex)) tacni++;
    }
    const ukupno = ids.length;
    const procenat = ukupno > 0 ? Math.round((tacni / ukupno) * 100) : 0;
    const polozeno = procenat >= (medaljon.pragProlazaPercent ?? 70);

    // Sljedeći broj pokušaja
    const [last] = await db
      .select({ pokusajBr: etapaPolaganjaTable.pokusajBr })
      .from(etapaPolaganjaTable)
      .where(
        and(
          eq(etapaPolaganjaTable.studentId, userId),
          eq(etapaPolaganjaTable.medaljonId, medaljon.id),
        ),
      )
      .orderBy(desc(etapaPolaganjaTable.pokusajBr))
      .limit(1);
    const pokusajBr = (last?.pokusajBr ?? 0) + 1;

    await db.insert(etapaPolaganjaTable).values({
      studentId: userId,
      medaljonId: medaljon.id,
      brojTacnih: tacni,
      brojPitanja: ukupno,
      procenat,
      polozeno,
      pokusajBr,
    });

    let medaljonClaimed = false;
    if (polozeno) {
      const inserted = await db
        .insert(studentMedaljoniTable)
        .values({ studentId: userId, medaljonId: medaljon.id })
        .onConflictDoNothing()
        .returning();
      medaljonClaimed = inserted.length > 0;
    }

    res.json({
      polozeno,
      procenat,
      brojTacnih: tacni,
      brojPitanja: ukupno,
      pragProlazaPercent: medaljon.pragProlazaPercent,
      pokusajBr,
      medaljonClaimed,
    });
  } catch (err) {
    console.error("[etape/predaj] error", err);
    res.status(500).json({ error: "Greška pri predaji ispita" });
  }
  return;
});

// Server-side provjera gating-a za pristup završnom ispitu etape.
// Vraća string sa razlogom ako učenik NE smije pristupiti, ili null ako smije.
async function proverigatingEtape(
  userId: string,
  medaljon: { nivo: number; posAfterRedoslijed: number; naziv: string },
): Promise<string | null> {
  if (!userId) return "Niste prijavljeni";
  const potrebne = await db
    .select({ id: ilmihalLekcijeTable.id })
    .from(ilmihalLekcijeTable)
    .where(
      and(
        eq(ilmihalLekcijeTable.nivo, medaljon.nivo),
        lte(ilmihalLekcijeTable.redoslijed, medaljon.posAfterRedoslijed),
        eq(ilmihalLekcijeTable.dostupnost, "svi"),
      ),
    );
  if (potrebne.length === 0) return null;
  const [progressRow] = await db
    .select({ completedLessons: studentProgressTable.completedLessons })
    .from(studentProgressTable)
    .where(eq(studentProgressTable.studentId, userId))
    .limit(1);
  const zavrsene = new Set((progressRow?.completedLessons as number[] | undefined) ?? []);
  const nedostaje = potrebne.filter((l) => !zavrsene.has(l.id));
  if (nedostaje.length > 0) {
    return `Završi sve lekcije etape "${medaljon.naziv}" prije završnog ispita (nedostaje ${nedostaje.length}/${potrebne.length}).`;
  }
  return null;
}

// Helper za /mapa: vrati ID-jeve etapa koje su student položio u datom nivou
export async function polozeneEtapeNivoa(studentId: string, nivo: number): Promise<Set<number>> {
  const rows = await db
    .select({
      medaljonId: etapaPolaganjaTable.medaljonId,
    })
    .from(etapaPolaganjaTable)
    .innerJoin(medaljoniTable, eq(etapaPolaganjaTable.medaljonId, medaljoniTable.id))
    .where(
      and(
        eq(etapaPolaganjaTable.studentId, studentId),
        eq(etapaPolaganjaTable.polozeno, true),
        eq(medaljoniTable.nivo, nivo),
      ),
    );
  return new Set(rows.map((r) => r.medaljonId));
}

export default router;
