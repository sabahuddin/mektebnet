/**
 * Bosanski padežni oblici riječi "Aferim" (turcizam: "bravo!").
 *
 * Paradigma (muški rod, jednina/množina):
 *   N: Aferim   / Aferimi
 *   G: Aferima  / Aferima
 *   D: Aferimu  / Aferimima
 *   A: Aferim   / Aferime
 *   V: Aferime  / Aferimi
 *   I: Aferimom / Aferimima
 *   L: Aferimu  / Aferimima
 *
 * Pravilo zadano od strane korisnika za UI brojeve:
 *   - tačno 1 → "Aferim"
 *   - sve ostalo (0, 2+) → "Aferima"
 *
 * Za samostalne labele bez broja (naslov "Aferimi", "tvoji Aferimi") koristi
 * nominativ množine "Aferimi" direktno u tekstu.
 *
 * Za glagolske dopune u akuzativu množine ("zarađuj Aferime", "sakupljaj
 * Aferime", "donose Aferime") koristi "Aferime" direktno u tekstu.
 */
export function aferimForm(n: number): "Aferim" | "Aferima" {
  return n === 1 ? "Aferim" : "Aferima";
}

/** Sklopljen oblik "5 Aferima" / "1 Aferim" — preferirani UI format. */
export function aferimWithCount(n: number): string {
  return `${n} ${aferimForm(n)}`;
}
