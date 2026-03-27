import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { posjeteTable } from "@workspace/db/schema";

let geoCache: Map<string, { country: string; city: string }> = new Map();

async function resolveGeo(ip: string): Promise<{ country: string; city: string }> {
  if (geoCache.has(ip)) return geoCache.get(ip)!;
  try {
    const cleanIp = ip.replace(/^::ffff:/, "");
    if (cleanIp === "127.0.0.1" || cleanIp === "::1" || cleanIp.startsWith("192.168.") || cleanIp.startsWith("10.") || cleanIp.startsWith("172.")) {
      return { country: "Local", city: "Local" };
    }
    const res = await fetch(`http://ip-api.com/json/${cleanIp}?fields=country,city`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      const result = { country: data.country || "Unknown", city: data.city || "Unknown" };
      geoCache.set(ip, result);
      if (geoCache.size > 10000) geoCache = new Map();
      return result;
    }
  } catch {}
  return { country: "Unknown", city: "Unknown" };
}

export function trackVisit(req: Request, _res: Response, next: NextFunction) {
  const path = req.path;
  if (path.startsWith("/api/") || path.includes(".")) {
    next();
    return;
  }

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "";
  const userAgent = req.headers["user-agent"] || "";
  const userId = req.user?.userId || null;

  resolveGeo(ip).then(geo => {
    db.insert(posjeteTable).values({
      userId,
      path,
      ip: ip.substring(0, 100),
      country: geo.country,
      city: geo.city,
      userAgent: userAgent.substring(0, 500),
    }).catch(() => {});
  });

  next();
}

export function trackApiVisit(req: Request, _res: Response, next: NextFunction) {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "";
  const userAgent = req.headers["user-agent"] || "";

  resolveGeo(ip).then(geo => {
    db.insert(posjeteTable).values({
      userId: req.user?.userId || null,
      path: req.originalUrl || req.path,
      ip: ip.substring(0, 100),
      country: geo.country,
      city: geo.city,
      userAgent: userAgent.substring(0, 500),
    }).catch(() => {});
  });

  next();
}
