// Gdje stoji snimak za jedan zapis.
//
// Ime datoteke je cijeli zapis u heksadekadnom obliku — ne skraćeno. Dok se
// skraćivalo na osam bajtova, „أَمَلْ" i „أَمَامْ" su dobijali isto ime i
// dijelili bi jedan snimak. Vidjeti CLAUDE.md.
import { normalizirajZapis } from "@/lib/sufara-zapis";

const kodirac = new TextEncoder();

export function putanjaZvuka(zapis: string): string {
  const bajtovi = kodirac.encode(normalizirajZapis(zapis));
  const hex = Array.from(bajtovi, (b) => b.toString(16).padStart(2, "0")).join("");
  return `/audio/citanje/rijec-${hex}.mp3`;
}

/**
 * Pušta jedan zapis i javlja kad je gotovo. Prethodni snimak se prekida —
 * dijete koje brzo klika ne smije dobiti dva glasa preko drugog.
 */
let tekuci: HTMLAudioElement | null = null;

export function pustiZapis(zapis: string): Promise<void> {
  if (tekuci) { tekuci.pause(); tekuci = null; }
  const zvuk = new Audio(putanjaZvuka(zapis));
  tekuci = zvuk;
  return new Promise((rijesi) => {
    zvuk.addEventListener("ended", () => rijesi());
    zvuk.addEventListener("error", () => rijesi());
    zvuk.play().catch(() => rijesi());
  });
}

export function zaustaviZvuk(): void {
  if (tekuci) { tekuci.pause(); tekuci = null; }
}
