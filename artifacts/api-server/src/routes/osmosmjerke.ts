import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { listOsmosmjerke } from "../lib/osmosmjerke.js";

const router: IRouter = Router();

// GET /api/osmosmjerke — spisak dostupnih osmosmjerki za admin/muallim formu
// „Dodaj našu vježbu". Spisak se čita iz foldera s JSON datotekama, pa nova
// osmosmjerka znači samo novu JSON datoteku (bez izmjene koda).
router.get("/", requireAuth, requireRole("admin", "muallim"), async (req: Request, res: Response) => {
  try {
    res.json({ osmosmjerke: await listOsmosmjerke() });
  } catch (error) {
    req.log.error({ error }, "Čitanje spiska osmosmjerki nije uspjelo");
    res.status(500).json({ error: "Greška pri učitavanju osmosmjerki" });
  }
});

export default router;
