/**
 * Vraća korisnika tačno jedan korak kroz istoriju preglednika.
 *
 * Direktno otvoreni linkovi nemaju prethodnu internu stranicu, pa tada
 * koristimo eksplicitni fallback koji pozivalac odredi za svoj ekran.
 */
export function goBackOr(fallback: () => void): void {
  if (typeof window !== "undefined" && window.history.length > 1) {
    window.history.back();
    return;
  }
  fallback();
}