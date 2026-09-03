// Provjera baze tema: svaki odgovor mora se pojaviti u tekstu barem jedne od
// lekcija koje su navedene uz temu. Tako se sprječava da u ukrštenicu uđe pojam
// kojeg u gradivu nema.
//
//   node scripts/ukrstenice/provjeri.mjs
//
// Izlazni kod 1 ako neki odgovor nije potvrđen ili je slug lekcije nepoznat.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ucitajLekcije, poSlugu, normalizuj } from "./lekcije.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const teme = JSON.parse(readFileSync(path.join(HERE, "teme.json"), "utf8")).teme;

const lekcije = ucitajLekcije();
const mapa = poSlugu(lekcije);

/** Tekst lekcije u niz normalizovanih riječi. */
function uRijeci(tekst) {
  return tekst
    .split(/[^0-9A-Za-zČčĆćŽžŠšĐđĀāĪīŪūĒēŌō]+/)
    .map(normalizuj)
    .filter(Boolean);
}

/**
 * Pojavljuje li se odgovor među riječima teksta? Poređenje ide po korijenu, da
 * bi se prepoznali i padeži (DŽAMIJA ~ džamiji, MEKKA ~ Mekke), a višečlani
 * odgovori (SUDNJIDAN, EBUBEKR) traže se i kao spoj do tri uzastopne riječi.
 */
function nadjen(odgovor, rijeci) {
  const cilj = normalizuj(odgovor);
  const korijen = cilj.slice(0, Math.max(4, cilj.length - 2));
  for (let i = 0; i < rijeci.length; i++) {
    let spoj = "";
    for (let k = 0; k < 3 && i + k < rijeci.length; k++) {
      spoj += rijeci[i + k];
      if (spoj.length < korijen.length) continue;
      if (spoj.startsWith(korijen) && spoj.length <= cilj.length + 3) return true;
      if (spoj.length > cilj.length + 3) break;
    }
  }
  return false;
}

const korpus = lekcije.map((l) => ({ slug: l.slug, rijeci: uRijeci(l.tekst) }));

let greske = 0;
let nepotvrdjeni = 0;
let ukupno = 0;

for (const tema of teme) {
  const nepoznati = tema.lekcije.filter((s) => !mapa.has(s));
  if (nepoznati.length) {
    console.log(`\n✗ ${tema.id}: nepoznati slugovi lekcija: ${nepoznati.join(", ")}`);
    greske += nepoznati.length;
  }

  const rijeciTeme = tema.lekcije
    .filter((s) => mapa.has(s))
    .flatMap((s) => uRijeci(mapa.get(s).tekst));

  const problemi = [];
  const duplikati = new Set();
  const vidjeni = new Set();

  for (const u of tema.unosi) {
    ukupno++;
    const odg = normalizuj(u.o);
    if (vidjeni.has(odg)) duplikati.add(u.o);
    vidjeni.add(odg);

    if (!nadjen(u.o, rijeciTeme)) {
      const drugdje = korpus.filter((k) => nadjen(u.o, k.rijeci)).map((k) => k.slug);
      problemi.push({ o: u.o, drugdje: drugdje.slice(0, 5) });
      nepotvrdjeni++;
    }
  }

  const status = problemi.length === 0 && duplikati.size === 0 ? "✓" : "!";
  console.log(`\n${status} ${tema.id} — ${tema.naslov} (${tema.unosi.length} pojmova)`);
  for (const p of problemi) {
    console.log(
      `    nije nađen u lekcijama teme: ${p.o}` +
        (p.drugdje.length ? `  → ali postoji u: ${p.drugdje.join(", ")}` : "  → NEMA GA NIGDJE U GRADIVU")
    );
  }
  for (const d of duplikati) console.log(`    duplikat odgovora: ${d}`);
}

console.log(`\n─────────────────────────────────────`);
console.log(`Tema: ${teme.length}, pojmova: ${ukupno}, nepotvrđenih: ${nepotvrdjeni}, grešaka: ${greske}`);
process.exit(nepotvrdjeni > 0 || greske > 0 ? 1 : 0);
