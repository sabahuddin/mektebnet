import assert from "node:assert/strict";
import test from "node:test";
import { jeNasaVjezbaUrl, vjezbaSaJezikom } from "./nase-vjezbe";

test("jezik se dopisuje samo na naše vježbe", () => {
  assert.equal(
    vjezbaSaJezikom("/vjezbe/spoji/spoji.html?podaci=/api/nase-vjezbe/podaci/spoji/pojmovi.json", "de"),
    "/vjezbe/spoji/spoji.html?podaci=/api/nase-vjezbe/podaci/spoji/pojmovi.json&lang=de",
  );
  assert.equal(vjezbaSaJezikom("/vjezbe/poredak/poredak.html", "en"), "/vjezbe/poredak/poredak.html?lang=en");
  // Bosanski je izvornik — URL ostaje kakav je spremljen u prilogu.
  assert.equal(vjezbaSaJezikom("/vjezbe/poredak/poredak.html", "bs"), "/vjezbe/poredak/poredak.html");
  // Tuđe adrese ne diramo.
  assert.equal(
    vjezbaSaJezikom("https://learningapps.org/watch?app=123", "de"),
    "https://learningapps.org/watch?app=123",
  );
  assert.equal(vjezbaSaJezikom("", "de"), "");
  assert.equal(vjezbaSaJezikom(null, "de"), "");
});

test("dvaput dopisan jezik ne pravi dva parametra", () => {
  const jednom = vjezbaSaJezikom("/vjezbe/upisi/upisi.html", "de");
  assert.equal(vjezbaSaJezikom(jednom, "en"), jednom);
});

test("prepoznajemo svih šest vrsta naših vježbi", () => {
  for (const tip of ["osmosmjerka", "popuni", "poredak", "razvrstaj", "spoji", "upisi"]) {
    assert.equal(jeNasaVjezbaUrl(`/vjezbe/${tip}/${tip}.html`), true, tip);
  }
  assert.equal(jeNasaVjezbaUrl("/vjezbe/etapa-lekcije-1-10.html"), false);
  assert.equal(jeNasaVjezbaUrl("https://h5p.org/x"), false);
});
