import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { listSveVjezbe } from "../lib/nase-vjezbe.js";

const router: IRouter = Router();

// GET /api/nase-vjezbe — vrste naših vježbi (osmosmjerka, popuni prazninu) i
// sve vježbe u svakoj, za admin formu „Dodaj našu vježbu". Spisak se čita iz
// foldera s JSON datotekama, pa nova vježba znači samo novu datoteku.
router.get("/", requireAuth, requireRole("admin", "muallim"), async (req: Request, res: Response) => {
  try {
    res.json({ tipovi: await listSveVjezbe() });
  } catch (error) {
    req.log.error({ error }, "Čitanje spiska naših vježbi nije uspjelo");
    res.status(500).json({ error: "Greška pri učitavanju vježbi" });
  }
});

export default router;
