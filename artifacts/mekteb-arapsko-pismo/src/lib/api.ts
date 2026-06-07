const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export async function apiRequest<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  token?: string | null,
  isFormData?: boolean,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (!isFormData) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Greška servera" }));
    const baseMsg = err.error || "Greška servera";
    const fullMsg = err.detail ? `${baseMsg}: ${err.detail}` : baseMsg;
    const error = new Error(fullMsg) as any;
    error.status = res.status;
    error.detail = err.detail;
    // Cijelo tijelo greške proslijedi pozivaocu — strukturirane greške
    // (npr. 422 sa `currentSeconds`/`minSeconds`) trebaju ovo da naprave
    // bolji UX umjesto generičke poruke.
    error.data = err;
    throw error;
  }

  return res.json() as Promise<T>;
}

export function getApiBase() {
  return API_BASE;
}

// Dohvati zaštićeni fajl (PDF dokument) uz Authorization i otvori ga u novom tabu.
// Mekteb dokumenti više nisu javni — serviraju se kroz autorizovane rute, pa se
// ne mogu otvoriti običnim <a href>. Vraćamo blob URL i otvaramo ga.
export async function openAuthorizedFile(path: string, token?: string | null): Promise<void> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Greška pri otvaranju dokumenta" }));
    throw new Error(err.error || "Greška pri otvaranju dokumenta");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
