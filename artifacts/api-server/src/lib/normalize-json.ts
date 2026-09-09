export function normalizeBosnianDashes<T>(value: T): T {
  if (typeof value === "string") return value.replaceAll("—", "–") as T;
  if (Array.isArray(value)) return value.map(normalizeBosnianDashes) as T;

  if (value && typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);

    // Date i druge posebne objekte Express mora sam serijalizovati. Pretvaranje
    // Date objekta preko Object.entries() daje {}, pa frontend dobije Invalid Date.
    if (prototype !== Object.prototype && prototype !== null) return value;

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeBosnianDashes(item)]),
    ) as T;
  }

  return value;
}