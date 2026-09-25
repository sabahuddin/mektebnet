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
  role: string;
  termsAcceptedAt: Date | null;
  privacyAcknowledgedAt: Date | null;
  administratorDeclarationAcceptedAt: Date | null;
  parentAcknowledgedAt: Date | null;
  cachedAt: number;
}
const USER_STATUS_TTL_MS = 30 * 1000;
const userStatusCache = new Map<number, UserStatusCacheEntry>();

async function fetchUserStatus(userId: number): Promise<UserStatusCacheEntry | null> {
  const now = Date.now();
  const cached = userStatusCache.get(userId);
  if (cached && now - cached.cachedAt < USER_STATUS_TTL_MS) return cached;

  const [u] = await db
    .select({
      isActive: usersTable.isActive,
      trialUntil: usersTable.trialUntil,
      role: usersTable.role,
      termsAcceptedAt: usersTable.termsAcceptedAt,
      privacyAcknowledgedAt: usersTable.privacyAcknowledgedAt,
      administratorDeclarationAcceptedAt: usersTable.administratorDeclarationAcceptedAt,
      parentAcknowledgedAt: usersTable.parentAcknowledgedAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (!u) return null;
  const entry: UserStatusCacheEntry = {
    isActive: u.isActive,
    trialUntilMs: u.trialUntil ? u.trialUntil.getTime() : null,
    role: u.role,
    termsAcceptedAt: u.termsAcceptedAt,
    privacyAcknowledgedAt: u.privacyAcknowledgedAt,
    administratorDeclarationAcceptedAt: u.administratorDeclarationAcceptedAt,
    parentAcknowledgedAt: u.parentAcknowledgedAt,
    cachedAt: now,
  };
  userStatusCache.set(userId, entry);
  return entry;
}

// Eksterno korisno za invalidaciju cache-a (npr. nakon admin promjene).
export function invalidateUserStatusCache(userId: number) {
  userStatusCache.delete(userId);
}

/** Validates a token for H5P static assets without exposing its payload. */
export async function isTokenAllowedForH5p(token: string): Promise<boolean> {
  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return false;
  }
  const status = await fetchUserStatus(payload.userId);
  if (!status) return false;
  const trialActive = status.trialUntilMs ? status.trialUntilMs > Date.now() : false;
  if (!status.isActive && !trialActive) return false;
  if (!status.termsAcceptedAt || !status.privacyAcknowledgedAt) return false;
  if (status.role === "muallim" && !status.administratorDeclarationAcceptedAt) return false;
  if (status.role === "roditelj" && !status.parentAcknowledgedAt) return false;
  return true;
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
  // poštovati admin deaktivaciju i istek 30-dnevnog triala u realnom vremenu.
  let status: UserStatusCacheEntry | null;
  try {
    status = await fetchUserStatus(payload.userId);
    if (!status) {
      res.status(401).json({ error: "Korisnik više ne postoji" });
      return;
    }
    const trialActive = status.trialUntilMs ? status.trialUntilMs > Date.now() : false;
    if (!status.isActive && !trialActive) {
      res.status(403).json({
        error: status.trialUntilMs
          ? "Vaš 30-dnevni probni period je istekao. Kontaktirajte administratora."
          : "Vaš račun nije aktivan. Kontaktirajte administratora.",
      });
      return;
    }
  } catch (e) {
    // U slučaju DB greške, fail-closed (sigurnije). Korisnik će ponovo pokušati.
    res.status(503).json({ error: "Greška pri provjeri statusa naloga" });
    return;
  }

  if (!status) {
    res.status(401).json({ error: "Korisnik više ne postoji" });
    return;
  }
  const pending = !status.termsAcceptedAt || !status.privacyAcknowledgedAt
    || (status.role === "muallim" && !status.administratorDeclarationAcceptedAt)
    || (status.role === "roditelj" && !status.parentAcknowledgedAt);
  if (pending && req.path !== "/me" && req.path !== "/acknowledgements") {
    res.status(403).json({
      code: "ACKNOWLEDGEMENTS_REQUIRED",
      error: "Potrebno je pročitati i potvrditi uslove korištenja prije nastavka.",
    });
    return;
  }

  // The token may outlive a role change. Authorize using the current DB role,
  // not the role signed at login (notably for revoked admin/muallim access).
  req.user = { ...payload, role: status.role };
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
