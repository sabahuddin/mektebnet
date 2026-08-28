export type GrupaModul = "ucenici" | "napamet" | "greske" | "plan";

const VALID_MODULES = new Set<GrupaModul>(["napamet", "greske", "plan"]);

export function getGrupaModul(search: string): GrupaModul {
  const modul = new URLSearchParams(search).get("modul");
  return modul && VALID_MODULES.has(modul as GrupaModul)
    ? modul as GrupaModul
    : "ucenici";
}