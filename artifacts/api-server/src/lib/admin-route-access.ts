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
  if (isPriloziRoute) {
    // Muallim može i dalje dodavati nastavne materijale (fajl ili URL), ali
    // vježbe koje se prikazuju poslije lekcije dodaje samo admin.
    const isExerciseCreateRoute = method.toUpperCase() === "POST"
      && /^\/prilozi\/\d+\/(?:h5p|osmosmjerka|nasa-vjezba)$/.test(path);
    return !isExerciseCreateRoute;
  }
  if (path === "/upload") return true;

  // Muallim može napraviti privatnu lekciju. Server sam postavlja slug, autora,
  // privatnu vidljivost i redoslijed; admin je naknadno može objaviti svima.
  if (method.toUpperCase() === "POST" && path === "/ilmihal") {
    if (!body || typeof body !== "object" || Array.isArray(body)) return false;
    const record = body as Record<string, unknown>;
    const keys = Object.keys(record);
    const allowedKeys = new Set(["naslov", "nivo", "predmet", "contentHtml", "podnesenoZaJavnuObjavu"]);
    return keys.length >= 2
      && keys.every((key) => allowedKeys.has(key))
      && typeof record.naslov === "string"
      && typeof record.contentHtml === "string"
      && (record.podnesenoZaJavnuObjavu === undefined || typeof record.podnesenoZaJavnuObjavu === "boolean");
  }

  // Muallim može uređivati samo sadržaj postojeće Ilmihal lekcije. Namjerno
  // ne dopuštamo naslov, predmet, redoslijed, kviz, preduvjete ni forceUnlock.
  if (method.toUpperCase() !== "PUT" || !/^\/ilmihal\/\d+$/.test(path)) {
    return false;
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;

  const record = body as Record<string, unknown>;
  const keys = Object.keys(record);
  const allowedKeys = new Set(["contentHtml", "language"]);
  return keys.length >= 1
    && keys.every((key) => allowedKeys.has(key))
    && typeof record.contentHtml === "string"
    && (record.language === undefined
      || ["bs", "sq", "de", "en", "tr", "ar"].includes(String(record.language)));
}
