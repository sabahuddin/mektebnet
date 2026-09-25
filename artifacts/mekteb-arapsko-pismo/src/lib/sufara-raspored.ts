// Raspoređivanje zapisa po lekcijama — izvedeno, ne pisano rukom.
//
// Zapis pripada prvoj lekciji u kojoj dijete zna sve njegove harfove i sve
// njegove znakove. Time je nemoguće da se riječ pojavi prije nego je dijete
// naučilo šta joj treba, i nemoguće je da kasnija lekcija bude lakša od
// ranije: fond svake lekcije nosi i sve prethodno.
//
// Zapis koji traži nešto što program ne uči nigdje se ne smješta i prijavi se
// s razlogom. Bolje je da takav zapis ispadne i vidi se, nego da tiho dođe
// pred dijete.
import { zahtjevZapisa, type Znak } from "@/lib/sufara-zapis";
import { PROGRAM_SUFARE, type KorakPrograma } from "@/data/sufara-program";

export interface SmjestenZapis {
  zapis: string;
  lekcija: number;
  znakovi: Znak[];
  duzina: number;
}

export interface NesmjestenZapis {
  zapis: string;
  razlog: string;
  nedostajuHarfovi: string[];
  nedostajuZnakovi: Znak[];
}

export interface Raspored {
  smjesteni: SmjestenZapis[];
  nesmjesteni: NesmjestenZapis[];
}

export function rasporediZapise(
  zapisi: readonly string[],
  program: readonly KorakPrograma[] = PROGRAM_SUFARE,
): Raspored {
  const koraci = [...program].sort((a, b) => a.lekcija - b.lekcija);
  const smjesteni: SmjestenZapis[] = [];
  const nesmjesteni: NesmjestenZapis[] = [];

  const sviHarfovi = new Set(koraci.flatMap((k) => k.harfovi));
  const sviZnakovi = new Set(koraci.flatMap((k) => k.znakovi));

  for (const sirovi of new Set(zapisi)) {
    // Stari program: vidjeti OpcijeZnakova u sufara-zapis.ts.
    const { zapis, harfovi, znakovi, duzina } = zahtjevZapisa(sirovi, { zanemariZavrsniSukun: true });
    if (!duzina) continue;

    const nemaHarfove = harfovi.filter((h) => !sviHarfovi.has(h));
    const nemaZnakove = znakovi.filter((z) => !sviZnakovi.has(z));
    if (nemaHarfove.length || nemaZnakove.length) {
      nesmjesteni.push({
        zapis,
        razlog: [
          nemaHarfove.length ? `harf se nigdje ne uvodi: ${nemaHarfove.join(" ")}` : "",
          nemaZnakove.length ? `znak se nigdje ne uči: ${nemaZnakove.join(", ")}` : "",
        ].filter(Boolean).join("; "),
        nedostajuHarfovi: nemaHarfove,
        nedostajuZnakovi: nemaZnakove,
      });
      continue;
    }

    const naucen = new Set<string>();
    const znani = new Set<Znak>();
    let smjesten = false;
    for (const korak of koraci) {
      for (const h of korak.harfovi) naucen.add(h);
      for (const z of korak.znakovi) znani.add(z);
      if (harfovi.every((h) => naucen.has(h)) && znakovi.every((z) => znani.has(z))) {
        smjesteni.push({ zapis, lekcija: korak.lekcija, znakovi, duzina });
        smjesten = true;
        break;
      }
    }
    if (!smjesten) nesmjesteni.push({ zapis, razlog: "nijedna lekcija ga ne pokriva", nedostajuHarfovi: [], nedostajuZnakovi: [] });
  }

  smjesteni.sort((a, b) => a.lekcija - b.lekcija || a.duzina - b.duzina || a.zapis.localeCompare(b.zapis));
  return { smjesteni, nesmjesteni };
}

/**
 * Fond za jednu lekciju: prvo ono što je u njoj tek postalo čitljivo, pa
 * dopuna iz ranijih lekcija odabrana tako da se pokrije što više različitih
 * znakova. Lekcija ponavljanja nema ničeg novog, pa uzima samo iz ranijeg —
 * ali istim pravilom raznolikosti.
 */
export function sastaviFond(raspored: Raspored, lekcija: number, velicina: number): string[] {
  const dostupni = raspored.smjesteni.filter((z) => z.lekcija <= lekcija);
  const novi = dostupni.filter((z) => z.lekcija === lekcija);
  const raniji = dostupni.filter((z) => z.lekcija < lekcija);

  const odabrani: SmjestenZapis[] = [];
  const uzmi = (iz: SmjestenZapis[], koliko: number) => {
    // Kruži kroz znakove da nijedan ne prevlada; duži zapisi imaju prednost
    // jer nose više toga odjednom.
    const preostali = [...iz].sort((a, b) => b.duzina - a.duzina || b.znakovi.length - a.znakovi.length);
    const brojac = new Map<string, number>();
    while (odabrani.length < koliko && preostali.length) {
      let najbolji = 0;
      let najmanje = Infinity;
      for (let i = 0; i < preostali.length; i += 1) {
        const tezina = preostali[i].znakovi.reduce((s, z) => s + (brojac.get(z) ?? 0), 0) / (preostali[i].znakovi.length || 1);
        if (tezina < najmanje) { najmanje = tezina; najbolji = i; }
      }
      const [uzet] = preostali.splice(najbolji, 1);
      for (const z of uzet.znakovi) brojac.set(z, (brojac.get(z) ?? 0) + 1);
      odabrani.push(uzet);
    }
  };

  // Najmanje dvije trećine novog gradiva dok ga ima — lekcija prvo vježba ono
  // što je upravo naučila.
  uzmi(novi, Math.min(velicina, Math.max(Math.ceil(velicina * 0.67), novi.length ? 1 : 0)));
  uzmi(raniji, velicina);
  if (odabrani.length < velicina) uzmi(novi, velicina);

  return odabrani.slice(0, velicina).map((z) => z.zapis);
}
