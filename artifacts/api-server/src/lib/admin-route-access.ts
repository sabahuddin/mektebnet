type AdminRouteAccessInput = {
  role?: string;
  method: string;
  path: string;
  body?: unknown;
};

/**
 * Centralna dozvola za /api/admin rute koje su dostupne i muallimu.
 * Sve što nije eksplicitno navedeno ostaje admin-only.
 */
export function canAccessAdminRoute({
  role,
  method,
  path,
  body,
}: AdminRouteAccessInput): boolean {
  if (role === "admin") return true;
  if (role !== "muallim") return false;

  const isPriloziRoute = path === "/prilozi" || path.startsWith("/prilozi/");
  if (isPriloziRoute || path === "/upload") return true;

  // Muallim može uređivati samo sadržaj postojeće Ilmihal lekcije. Namjerno
  // ne dopuštamo naslov, predmet, redoslijed, kviz, preduvjete ni forceUnlock.
  if (method.toUpperCase() !== "PUT" || !/^\/ilmihal\/\d+$/.test(path)) {
    return false;
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;

  const record = body as Record<string, unknown>;
  const keys = Object.keys(record);
  return keys.length === 1
    && keys[0] === "contentHtml"
    && typeof record.contentHtml === "string";
}