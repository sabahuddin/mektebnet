const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export async function apiRequest<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Greška servera" }));
    const error = new Error(err.error || "Greška servera") as any;
    error.status = res.status;
    throw error;
  }

  return res.json() as Promise<T>;
}

export function getApiBase() {
  return API_BASE;
}
