import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import {
  TIPOVI_VJEZBI,
  citajPodatke,
  isValidTip,
  isValidVjezbaId,
  listSveVjezbe,
  listVjezbe,
  obrisiVjezbu,
  slobodanId,
  spremiVjezbu,
  validirajPodatke,
} from "../lib/nase-vjezbe.js";

const router: IRouter = Router();

// GET /api/nase-vjezbe/podaci/:tip/:id.json — sadržaj vježbe koji učitava sama
// vježba u iframe-u. Namjerno bez prijave: iframe ne može poslati Authorization
// zaglavlje, a sadržaj vježbe nije tajan. ID je strogo provjeren, pa se ovim ne
// može čitati ništa osim registrovanih vježbi.
router.get("/podaci/:tip/:id", async (req: Request, res: Response) => {
  const tip = String(req.params.tip);
  const id = String(req.params.id).replace(/\.json$/i, "");
  if (!isValidTip(tip) || !isValidVjezbaId(id)) {
    res.status(404).json({ error: "Vježba nije pronađena" });
    return;
  }
  try {
    const nadjeno = await citajPodatke(tip, id);
    if (!nadjeno) {
      res.status(404).json({ error: "Vježba nije pronađena" });
      return;
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(JSON.stringify(nadjeno.podaci));
  } catch (error) {
    req.log.error({ error, tip, id }, "Čitanje sadržaja naše vježbe nije uspjelo");
    res.status(500).json({ error: "Greška pri učitavanju vježbe" });
  }
});

// GET /api/nase-vjezbe — vrste i sve vježbe u svakoj (spisak za admin formu u
// lekciji i za uređivač u admin panelu).
router.get("/", requireAuth, requireRole("admin", "muallim"), async (req: Request, res: Response) => {
  try {
    res.json({ tipovi: await listSveVjezbe() });
  } catch (error) {
    req.log.error({ error }, "Čitanje spiska naših vježbi nije uspjelo");
    res.status(500).json({ error: "Greška pri učitavanju vježbi" });
  }
});

// GET /api/nase-vjezbe/:tip/:id — puni sadržaj jedne vježbe, za uređivač.
router.get("/:tip/:id", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  const tip = String(req.params.tip);
  const id = String(req.params.id);
  try {
    const nadjeno = await citajPodatke(tip, id);
    if (!nadjeno) {
      res.status(404).json({ error: "Vježba nije pronađena" });
      return;
    }
    res.json({ tip, id, izvor: nadjeno.izvor, podaci: nadjeno.podaci });
  } catch (error) {
    req.log.error({ error, tip, id }, "Čitanje vježbe za uređivanje nije uspjelo");
    res.status(500).json({ error: "Greška pri učitavanju vježbe" });
  }
});

// POST /api/nase-vjezbe/:tip — nova vježba iz panela.
router.post("/:tip", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  const tip = String(req.params.tip);
  const { vjezbaId, podaci } = (req.body || {}) as { vjezbaId?: unknown; podaci?: unknown };
  if (!isValidTip(tip)) {
    res.status(400).json({ error: "Nepoznata vrsta vježbe" });
    return;
  }
  const id = String(vjezbaId ?? "").trim();
  if (!isValidVjezbaId(id)) {
    res.status(400).json({ error: "Oznaka vježbe smije imati samo mala slova, cifre i crticu (npr. bajram-01)." });
    return;
  }
  const greska = validirajPodatke(tip, podaci);
  if (greska) {
    res.status(400).json({ error: greska });
    return;
  }
  try {
    if (!(await slobodanId(tip, id))) {
      res.status(409).json({ error: `Vježba s oznakom "${id}" već postoji.` });
      return;
    }
    const spremljeno = await spremiVjezbu(tip, id, podaci as Record<string, unknown>, req.user?.userId ?? null);
    res.status(201).json(spremljeno);
  } catch (error) {
    req.log.error({ error, tip, id }, "Pravljenje naše vježbe nije uspjelo");
    res.status(500).json({ error: (error as Error).message || "Greška pri čuvanju vježbe" });
  }
});

// PUT /api/nase-vjezbe/:tip/:id — izmjena vježbe. Ugrađena vježba se ovim ne
// mijenja na disku: izmjena se upisuje u bazu i od tada prekriva ugrađenu.
router.put("/:tip/:id", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  const tip = String(req.params.tip);
  const id = String(req.params.id);
  const { podaci } = (req.body || {}) as { podaci?: unknown };
  if (!isValidTip(tip) || !isValidVjezbaId(id)) {
    res.status(400).json({ error: "Nevažeća vježba" });
    return;
  }
  const greska = validirajPodatke(tip, podaci);
  if (greska) {
    res.status(400).json({ error: greska });
    return;
  }
  try {
    const spremljeno = await spremiVjezbu(tip, id, podaci as Record<string, unknown>, req.user?.userId ?? null);
    res.json(spremljeno);
  } catch (error) {
    req.log.error({ error, tip, id }, "Čuvanje naše vježbe nije uspjelo");
    res.status(500).json({ error: (error as Error).message || "Greška pri čuvanju vježbe" });
  }
});

// DELETE /api/nase-vjezbe/:tip/:id — briše verziju iz panela. Ako vježba
// postoji i kao ugrađena datoteka, vraća se na nju; inače nestaje sa spiska.
// Prilozi koji je već koriste u lekcijama ostaju, pa odgovor kaže šta slijedi.
router.delete("/:tip/:id", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  const tip = String(req.params.tip);
  const id = String(req.params.id);
  if (!isValidTip(tip) || !isValidVjezbaId(id)) {
    res.status(400).json({ error: "Nevažeća vježba" });
    return;
  }
  try {
    await obrisiVjezbu(tip, id);
    const preostalo = await citajPodatke(tip, id);
    res.json({
      tip,
      id,
      vraceneNaUgradjenu: Boolean(preostalo),
      tipovi: await listSveVjezbe(),
    });
  } catch (error) {
    req.log.error({ error, tip, id }, "Brisanje naše vježbe nije uspjelo");
    res.status(500).json({ error: "Greška pri brisanju vježbe" });
  }
});

export { TIPOVI_VJEZBI, listVjezbe };
export default router;
