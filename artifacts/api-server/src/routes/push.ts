import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { upsertPushToken, deletePushToken } from "../lib/push.js";

const router = Router();

// GET /push/config — javni endpoint, bez auth. Vraća OneSignal App ID koji
// je dostupan samo na backendu (Coolify runtime env var). Frontend ga koristi
// ako build-time VITE_ONESIGNAL_APP_ID nije bio dostupan pri kompajliranju.
router.get("/config", (_req, res) => {
  res.json({ appId: process.env.ONESIGNAL_APP_ID || "" });
});

router.use(requireAuth);

const ALLOWED_PLATFORMS = ["web", "ios", "android"] as const;
type Platform = typeof ALLOWED_PLATFORMS[number];

router.post("/register", async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const playerId = typeof body.playerId === "string" ? body.playerId.trim() : "";
    const platformRaw = typeof body.platform === "string" ? body.platform.trim() : "";
    const userAgent = typeof body.userAgent === "string" ? body.userAgent : "";

    if (playerId.length < 8 || playerId.length > 64) {
      res.status(400).json({ error: "Nevažeći playerId" });
      return;
    }
    if (!ALLOWED_PLATFORMS.includes(platformRaw as Platform)) {
      res.status(400).json({ error: "Nevažeća platforma" });
      return;
    }

    const userId = req.user!.userId;
    await upsertPushToken({
      userId,
      playerId,
      platform: platformRaw as Platform,
      userAgent: userAgent || (req.headers["user-agent"] as string) || "",
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("[Push register]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

router.post("/unregister", async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const playerId = typeof body.playerId === "string" ? body.playerId.trim() : "";
    if (playerId.length < 8 || playerId.length > 64) {
      res.status(400).json({ error: "Nevažeći playerId" });
      return;
    }
    await deletePushToken(playerId, req.user!.userId);
    res.json({ ok: true });
  } catch (err) {
    console.error("[Push unregister]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

export default router;
