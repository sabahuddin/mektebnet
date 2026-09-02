import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { JWT_SECRET } from "../lib/jwt-secret.js";

export interface JwtPayload {
  userId: number;
  username: string;
  role: string;
  displayName: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// Mini cache za status korisnika (isActive + trialUntil) — izbjegava DB hit
// na svaki authenticated request, ali još uvijek garantuje da se promjena
// (admin deaktivacija, istek triala) primijeni u roku od ~30 sekundi.
interface UserStatusCacheEntry {
  isActive: boolean;
  trialUntilMs: number | null;
  cachedAt: number;
}
const USER_STATUS_TTL_MS = 30 * 1000;
const userStatusCache = new Map<number, UserStatusCacheEntry>();

async function fetchUserStatus(userId: number): Promise<UserStatusCacheEntry | null> {
  const now = Date.now();
  const cached = userStatusCache.get(userId);
  if (cached && now - cached.cachedAt < USER_STATUS_TTL_MS) return cached;

  const [u] = await db
    .select({ isActive: usersTable.isActive, trialUntil: usersTable.trialUntil })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (!u) return null;
  const entry: UserStatusCacheEntry = {
    isActive: u.isActive,
    trialUntilMs: u.trialUntil ? u.trialUntil.getTime() : null,
    cachedAt: now,
  };
  userStatusCache.set(userId, entry);
  return entry;
}

// Eksterno korisno za invalidaciju cache-a (npr. nakon admin promjene).
export function invalidateUserStatusCache(userId: number) {
  userStatusCache.delete(userId);
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Niste prijavljeni" });
    return;
  }

  const token = authHeader.slice(7);
  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    res.status(401).json({ error: "Nevažeći token" });
    return;
  }

  // Re-check user status iz DB (cached). Token je dugotrajan (30d), pa moramo
  // poštovati admin deaktivaciju i istek 7-dnevnog triala u realnom vremenu.
  try {
    const status = await fetchUserStatus(payload.userId);
    if (!status) {
      res.status(401).json({ error: "Korisnik više ne postoji" });
      return;
    }
    const trialActive = status.trialUntilMs ? status.trialUntilMs > Date.now() : false;
    if (!status.isActive && !trialActive) {
      res.status(403).json({
        error: status.trialUntilMs
          ? "Vaš 7-dnevni probni period je istekao. Kontaktirajte administratora."
          : "Vaš račun nije aktivan. Kontaktirajte administratora.",
      });
      return;
    }
  } catch (e) {
    // U slučaju DB greške, fail-closed (sigurnije). Korisnik će ponovo pokušati.
    res.status(503).json({ error: "Greška pri provjeri statusa naloga" });
    return;
  }

  req.user = payload;
  next();
}

// Javne read rute mogu prepoznati administratora bez zahtijevanja prijave od
// ostalih korisnika. Ako je Authorization header poslan, validira se jednako
// strogo kao na zaštićenim rutama.
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.headers.authorization?.startsWith("Bearer ")) {
    next();
    return;
  }
  await requireAuth(req, res, next);
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Niste prijavljeni" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Nemate ovlaštenje za ovu akciju" });
      return;
    }
    next();
  };
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}
