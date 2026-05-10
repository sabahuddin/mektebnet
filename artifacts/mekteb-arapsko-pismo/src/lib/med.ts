/**
 * Bosanski padežni oblici za "Kap meda" (znanjska valuta — zarađuje se
 * lekcijama, kvizovima, misijama i ilmihal sadržajem).
 *
 *   - tačno 1 → "Kap meda"
 *   - sve ostalo (0, 2+) → "Kapi meda"
 *
 * Za samostalnu labelu bez broja koristi "Kapi meda" / "Med" direktno u
 * tekstu.
 */
export function medForm(n: number): "Kap meda" | "Kapi meda" {
  return n === 1 ? "Kap meda" : "Kapi meda";
}

/** Sklopljen oblik "5 kapi meda" / "1 kap meda" — preferirani UI format. */
export function medWithCount(n: number): string {
  return `${n} ${medForm(n).toLowerCase()}`;
}
