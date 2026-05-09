import { clsx, type ClassValue } from "clsx"

/**
 * Online ako je lastSeenAt unutar 2 minute.
 * Heartbeat ide svakih 60s, pa je 120s sigurna granica.
 */
export function isOnline(lastSeenAt: string | Date | null | undefined): boolean {
  if (!lastSeenAt) return false;
  const t = typeof lastSeenAt === "string" ? new Date(lastSeenAt).getTime() : lastSeenAt.getTime();
  if (isNaN(t)) return false;
  return Date.now() - t < 2 * 60 * 1000;
}

/**
 * Formatira sekunde u kratki ljudski string: "12h 34m", "45m", "30s".
 */
export function formatScreentime(sec: number | null | undefined): string {
  if (!sec || sec < 0) return "0m";
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
