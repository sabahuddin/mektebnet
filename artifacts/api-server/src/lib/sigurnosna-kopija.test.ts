import assert from "node:assert/strict";
import { test } from "node:test";
import {
  KOPIJA_FORMAT,
  KOPIJA_VERZIJA,
  imeKopije,
  kopijaSadrzaja,
  popisTabela,
  prebrojRedove,
  stanjeFajlova,
} from "./sigurnosna-kopija.js";

test("popis tabela nosi stvarne tabele, bez evidencije migracija", async () => {
  const tabele = await popisTabela();
  assert.ok(tabele.includes("users"), "users mora biti u kopiji");
  assert.ok(tabele.includes("nase_vjezbe"), "nase_vjezbe mora biti u kopiji");
  assert.ok(!tabele.includes("__drizzle_migrations"));
  assert.deepEqual(tabele, [...tabele].sort());
});

test("kopija je ispravan NDJSON sa zaglavljem, tabelama i završetkom", async () => {
  let tekst = "";
  for await (const komad of kopijaSadrzaja()) tekst += komad;

  const linije = tekst.split("\n").filter(l => l.length > 0);
  const zaglavlje = JSON.parse(linije[0]!) as {
    format: string; verzija: number; vrijeme: string; tabele: string[];
  };
  assert.equal(zaglavlje.format, KOPIJA_FORMAT);
  assert.equal(zaglavlje.verzija, KOPIJA_VERZIJA);
  assert.ok(!Number.isNaN(Date.parse(zaglavlje.vrijeme)));

  // Svaka tabela iz zaglavlja mora imati svoj početak i svoj završetak.
  const pocetak = new Set<string>();
  const kraj = new Map<string, number>();
  let redova = 0;
  for (const linija of linije.slice(1)) {
    const stavka = JSON.parse(linija) as Record<string, unknown>;
    if (typeof stavka["tabela"] === "string") pocetak.add(stavka["tabela"]);
    else if (typeof stavka["kraj"] === "string") kraj.set(stavka["kraj"], Number(stavka["redova"]));
    else {
      assert.ok(stavka["red"], "red mora nositi podatke");
      redova += 1;
    }
  }
  for (const tabela of zaglavlje.tabele) {
    assert.ok(pocetak.has(tabela), `nedostaje početak: ${tabela}`);
    assert.ok(kraj.has(tabela), `nedostaje završetak: ${tabela}`);
  }
  assert.equal(redova, [...kraj.values()].reduce((zbir, broj) => zbir + broj, 0));
});

test("broj redova u kopiji odgovara broju redova u bazi", async () => {
  const brojevi = await prebrojRedove();
  const users = brojevi.find(red => red.tabela === "users");
  assert.ok(users && users.redova > 0, "baza za test mora imati korisnike");

  let tekst = "";
  for await (const komad of kopijaSadrzaja()) tekst += komad;
  const izKopije = new Map<string, number>();
  for (const linija of tekst.split("\n").filter(Boolean)) {
    const stavka = JSON.parse(linija) as Record<string, unknown>;
    if (typeof stavka["kraj"] === "string") izKopije.set(stavka["kraj"], Number(stavka["redova"]));
  }
  for (const { tabela, redova } of brojevi) {
    assert.equal(izKopije.get(tabela), redova, `${tabela}: broj redova`);
  }
});

test("naziv datoteke nosi datum i sat", () => {
  assert.equal(imeKopije(new Date(2026, 8, 18, 18, 30)), "mekteb-sadrzaj-2026-09-18-1830.ndjson.gz");
});

test("stanje fajlova vraća folder i brojeve", async () => {
  const stanje = await stanjeFajlova();
  assert.ok(stanje.folder.length > 0);
  assert.ok(stanje.fajlova >= 0);
  assert.ok(stanje.bajtova >= 0);
});

test("kopija fajlova je ispravan tar koji sistemski tar vrati nepromijenjen", async () => {
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const pokreni = promisify(execFile);

  const radni = await fs.mkdtemp(path.join(os.tmpdir(), "kopija-"));
  const izvor = path.join(radni, "izvor");
  const cilj = path.join(radni, "vraceno");
  await fs.mkdir(path.join(izvor, "slike", "lekcije"), { recursive: true });
  await fs.mkdir(path.join(izvor, "prazan-folder"), { recursive: true });

  const dugoIme = `${"a-vrlo-dugacak-naziv-priloga".repeat(5)}-čćđšž.pdf`;
  const fajlovi: Record<string, string> = {
    "obican.txt": "Prvi red\nDrugi red\n",
    "naši slogovi č ć đ š ž.txt": "Bosanska slova u nazivu",
    "prazan.bin": "",
    [path.join("slike", "lekcije", dugoIme)]: "x".repeat(5000),
    [path.join("slike", "veliki.bin")]: "y".repeat(600 * 1024),
  };
  for (const [ime, sadrzaj] of Object.entries(fajlovi)) {
    await fs.writeFile(path.join(izvor, ime), sadrzaj);
  }

  const { kopijaFajlova } = await import("./sigurnosna-kopija.js");
  const arhiva = path.join(radni, "kopija.tar");
  const komadi: Buffer[] = [];
  for await (const komad of kopijaFajlova(izvor)) komadi.push(komad);
  await fs.writeFile(arhiva, Buffer.concat(komadi));
  assert.equal(Buffer.concat(komadi).length % 512, 0, "tar mora biti u blokovima od 512");

  await fs.mkdir(cilj, { recursive: true });
  await pokreni("tar", ["-xf", arhiva, "-C", cilj]);

  for (const [ime, sadrzaj] of Object.entries(fajlovi)) {
    const vraceno = await fs.readFile(path.join(cilj, ime), "utf8");
    assert.equal(vraceno, sadrzaj, `${ime}: sadržaj`);
  }
  const prazan = await fs.stat(path.join(cilj, "prazan-folder"));
  assert.equal(prazan.isDirectory(), true, "prazan folder mora ostati");

  await fs.rm(radni, { recursive: true, force: true });
});

test("kopija fajlova ne pukne kad folder ne postoji", async () => {
  const { kopijaFajlova } = await import("./sigurnosna-kopija.js");
  let bajtova = 0;
  for await (const komad of kopijaFajlova("/nema-ovog-foldera-nigdje")) bajtova += komad.length;
  assert.equal(bajtova, 1024, "prazna arhiva su dva prazna bloka");
});

test("naziv kopije fajlova nosi datum i sat", async () => {
  const { imeKopijeFajlova } = await import("./sigurnosna-kopija.js");
  assert.equal(imeKopijeFajlova(new Date(2026, 8, 18, 18, 30)), "mekteb-fajlovi-2026-09-18-1830.tar.gz");
});
