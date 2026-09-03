import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { posjeteTable } from "@workspace/db/schema";

const SKIP_EXACT = new Set([
  "/healthz", "/health", "/healthcheck", "/ping", "/status",
  "/metrics", "/ready", "/readyz", "/livez", "/up", "/n",
]);

export function trackVisit(req: Request, _res: Response, next: NextFunction) {
  const path = req.path;
  const normalized = path !== "/" && path.endsWith("/") ? path.slice(0, -1) : path;
  if (path.startsWith("/api/") || path.includes(".") || SKIP_EXACT.has(normalized)) {
    next();
    return;
  }

  const userAgent = req.headers["user-agent"] || "";
  const userId = req.user?.userId || null;

  db.insert(posjeteTable).values({
    userId,
    path,
    userAgent: userAgent.substring(0, 500),
  }).catch(() => {});

  next();
}

export function trackApiVisit(req: Request, _res: Response, next: NextFunction) {
  const userAgent = req.headers["user-agent"] || "";

  db.insert(posjeteTable).values({
    userId: req.user?.userId || null,
    path: req.originalUrl || req.path,
    userAgent: userAgent.substring(0, 500),
  }).catch(() => {});

  next();
}
