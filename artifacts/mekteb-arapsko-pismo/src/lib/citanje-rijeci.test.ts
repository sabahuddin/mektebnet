// Nijedna riječ ne smije tražiti gradivo koje dijete još nije učilo.
//
// Ovo je jedina zaštita od onoga što se desilo postojećim lekcijama: neko je
// ručno pisao spiskove riječi, pa je petnaesta lekcija imala petnaest riječi
// od kojih su dvije koristile kesru. Takvo pitanje se ne rješava gledanjem
// nego mjerenjem — svaka riječ ovdje prolazi kroz program.
//
// Traži se tačno poklapanje, ne samo „nije prerano": ako se riječ da
// pročitati već u trećoj lekciji, nema razloga da čeka petu. Fond koji sam
// sebe drži zategnutim ne može tiho oslabiti.
import assert from "node:assert/strict";
import test from "node:test";
import { RIJECI_CITANJA } from "../data/citanje-rijeci";
import { SLOGOVI_CITANJA } from "../data/citanje-slogovi";
import { PROGRAM_CITANJA, znanjeDoLekcije } from "../data/citanje-program";
import { zahtjevZapisa, zavrsetakOznacen } from "./sufara-zapis";

const ZADNJA = PROGRAM_CITANJA[PROGRAM_CITANJA.length - 1].broj;

/** Prva lekcija u kojoj su sva slova i svi znakovi riječi već obrađeni. */
function najranijaLekcija(zapis: string): number | null {
  const { harfovi, znakovi } = zahtjevZapisa(zapis);
  for (let l = 1; l <= ZADNJA; l += 1) {
    const znanje = znanjeDoLekcije(l);
    if (harfovi.every((h) => znanje.harfovi.has(h)) && znakovi.every((z) => znanje.znakovi.has(z))) return l;
  }
  return null;
}

test("program uvodi svako slovo tačno jednom", () => {
  const vidjeno = new Map<string, number>();
  const dvaput: string[] = [];
  for (const l of PROGRAM_CITANJA) {
    for (const h of l.harfovi) {
      if (vidjeno.has(h)) dvaput.push(`${h} — lekcije ${vidjeno.get(h)} i ${l.broj}`);
      vidjeno.set(h, l.broj);
    }
  }
  assert.deepEqual(dvaput, [], `slovo se uvodi više puta:\n${dvaput.join("\n")}`);
});

test("svaka riječ stoji u lekciji u kojoj se prvi put da pročitati", () => {
  const krivo: string[] = [];
  for (const r of RIJECI_CITANJA) {
    const treba = najranijaLekcija(r.zapis);
    if (treba === null) {
      const { harfovi, znakovi } = zahtjevZapisa(r.zapis);
      krivo.push(`${r.zapis} (${r.citanje}) — nijedna lekcija je ne pokriva; traži ${harfovi.join("")} i ${znakovi.join(", ")}`);
    } else if (treba !== r.lekcija) {
      krivo.push(`${r.zapis} (${r.citanje}) — stoji u ${r.lekcija}, a čitljiva je od ${treba}`);
    }
  }
  assert.deepEqual(krivo, [], `riječi u pogrešnoj lekciji:\n${krivo.join("\n")}`);
});

test("svaki slog stoji u lekciji u kojoj se prvi put da pročitati", () => {
  const krivo: string[] = [];
  for (const s of SLOGOVI_CITANJA) {
    const treba = najranijaLekcija(s.zapis);
    if (treba === null) {
      const { harfovi, znakovi } = zahtjevZapisa(s.zapis);
      krivo.push(`${s.zapis} (${s.citanje}) — nijedna lekcija je ne pokriva; traži ${harfovi.join("")} i ${znakovi.join(", ")}`);
    } else if (treba !== s.lekcija) {
      krivo.push(`${s.zapis} (${s.citanje}) — stoji u ${s.lekcija}, a čitljiv je od ${treba}`);
    }
  }
  assert.deepEqual(krivo, [], `slogovi u pogrešnoj lekciji:\n${krivo.join("\n")}`);
});

test("slog stoji na harfu koji sam navodi", () => {
  const krivo = SLOGOVI_CITANJA
    .filter((s) => !zahtjevZapisa(s.zapis).harfovi.includes(s.harf))
    .map((s) => `${s.zapis} — piše da je na ${s.harf}, a nema ga`);
  assert.deepEqual(krivo, [], krivo.join("\n"));
});

test("dugi slogovi su označeni, kratki nisu", () => {
  const krivo: string[] = [];
  for (const s of SLOGOVI_CITANJA) {
    const imaMedd = zahtjevZapisa(s.zapis).znakovi.includes("medd");
    if (imaMedd && !s.dug) krivo.push(`${s.zapis} ima dužinu, a nije označen`);
    if (!imaMedd && s.dug) krivo.push(`${s.zapis} je označen kao dug, a nema dužinu`);
  }
  assert.deepEqual(krivo, [], krivo.join("\n"));
});

test("svaka riječ ima označen završetak", () => {
  const lose = RIJECI_CITANJA.filter((r) => !zavrsetakOznacen(r.zapis)).map((r) => `${r.zapis} (${r.citanje})`);
  assert.deepEqual(lose, [], `zadnji harf bez znaka:\n${lose.join("\n")}`);
});


test("svaka lekcija do sedme donosi bar tri nove riječi", () => {
  const prazne: string[] = [];
  for (let l = 1; l <= 7; l += 1) {
    const koliko = RIJECI_CITANJA.filter((r) => r.lekcija === l).length;
    if (koliko < 3) prazne.push(`lekcija ${l} ima samo ${koliko}`);
  }
  assert.deepEqual(prazne, [], `lekcija bez dovoljno riječi:\n${prazne.join("\n")}`);
});
