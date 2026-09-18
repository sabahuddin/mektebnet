/**
 * Vraćanje sigurnosne kopije sadržaja u bazu.
 *
 * Kopiju pravi admin panel („Sigurnosna kopija" → Preuzmi sadržaj) ili
 * `GET /api/admin/sigurnosna-kopija`. Ovo je suprotan smjer i BRIŠE zatečeni
 * sadržaj tabela koje su u kopiji, pa traži izričitu potvrdu.
 *
 *   pnpm --filter @workspace/scripts vrati-sadrzaj -- --fajl=kopija.ndjson.gz
 *   pnpm --filter @workspace/scripts vrati-sadrzaj -- --fajl=kopija.ndjson.gz --potvrdi
 *
 * Bez `--potvrdi` samo pročita kopiju i ispiše šta bi uradio.
 */
import fs from "node:fs";
import readline from "node:readline";
import { createGunzip } from "node:zlib";
import pg from "pg";

const KOPIJA_FORMAT = "mekteb-sadrzaj";
const KOMAD = 500;

function argument(ime: string): string | undefined {
  const prefiks = `--${ime}=`;
  return process.argv.find(a => a.startsWith(prefiks))?.slice(prefiks.length);
}

const fajl = argument("fajl");
const potvrdi = process.argv.includes("--potvrdi");
const samo = argument("samo")?.split(",").map(s => s.trim()).filter(Boolean);

if (!fajl) {
  console.error("Nedostaje --fajl=<putanja do kopije .ndjson ili .ndjson.gz>");
  process.exit(1);
}
if (!process.env["DATABASE_URL"]) {
  console.error("Nedostaje DATABASE_URL — baza u koju se vraća kopija.");
  process.exit(1);
}

const klijent = new pg.Client({ connectionString: process.env["DATABASE_URL"] });

function citaj(putanja: string): NodeJS.ReadableStream {
  const tok = fs.createReadStream(putanja);
  return putanja.endsWith(".gz") ? tok.pipe(createGunzip()) : tok;
}

/** Tabele koje stvarno postoje u bazi, sa kolonama i njihovim tipovima. */
async function kolonePoTabeli(): Promise<Map<string, Map<string, string>>> {
  const { rows } = await klijent.query<{ tabela: string; kolona: string; tip: string }>(
    `SELECT table_name AS tabela, column_name AS kolona, data_type AS tip
       FROM information_schema.columns
      WHERE table_schema = 'public'`,
  );
  const mapa = new Map<string, Map<string, string>>();
  for (const red of rows) {
    const kolone = mapa.get(red.tabela) ?? new Map<string, string>();
    kolone.set(red.kolona, red.tip);
    mapa.set(red.tabela, kolone);
  }
  return mapa;
}

/** Brojači se nakon uvoza moraju pomjeriti iznad najvećeg vraćenog ID-a. */
async function popraviBrojace(tabela: string): Promise<void> {
  const { rows } = await klijent.query<{ kolona: string }>(
    `SELECT column_name AS kolona
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
        AND column_default LIKE 'nextval%'`,
    [tabela],
  );
  for (const { kolona } of rows) {
    await klijent.query(
      `SELECT setval(
                pg_get_serial_sequence($1, $2),
                COALESCE((SELECT MAX("${kolona}") FROM "${tabela}"), 0) + 1,
                false)`,
      [tabela, kolona],
    );
  }
}

async function main(): Promise<void> {
  await klijent.connect();
  const uBazi = await kolonePoTabeli();

  type Zaglavlje = { format?: string; verzija?: number; vrijeme?: string; tabele?: string[] };
  let zaglavlje: Zaglavlje | null = null;
  let tabela: string | null = null;
  let kolone: Map<string, string> | null = null;
  let red: Record<string, unknown>[] = [];
  const upisano = new Map<string, number>();
  const preskoceno: string[] = [];
  const dirnute: string[] = [];

  async function isprazni(): Promise<void> {
    if (!tabela || !kolone || red.length === 0) {
      red = [];
      return;
    }
    const imena = [...kolone.keys()].filter(k => k in red[0]!);
    if (potvrdi) {
      const vrijednosti: unknown[] = [];
      const grupe = red.map(r => {
        const mjesta = imena.map(k => {
          vrijednosti.push(normalizuj(r[k], kolone!.get(k)));
          return `$${vrijednosti.length}`;
        });
        return `(${mjesta.join(",")})`;
      });
      await klijent.query(
        `INSERT INTO "${tabela}" (${imena.map(k => `"${k}"`).join(",")}) VALUES ${grupe.join(",")}`,
        vrijednosti,
      );
    }
    upisano.set(tabela, (upisano.get(tabela) ?? 0) + red.length);
    red = [];
  }

  /**
   * row_to_json vrati JSON kolone kao JS vrijednosti, a pg ih šalje kao tekst.
   * Zato json i jsonb uvijek pretvaramo nazad u JSON tekst — i onda kad je u
   * njima obična riječ ili broj, jer bi ih baza inače odbila.
   */
  function normalizuj(vrijednost: unknown, tip?: string): unknown {
    if (vrijednost === null || vrijednost === undefined) return null;
    if (tip === "json" || tip === "jsonb") return JSON.stringify(vrijednost);
    if (typeof vrijednost === "object") return JSON.stringify(vrijednost);
    return vrijednost;
  }

  if (potvrdi) await klijent.query("BEGIN");
  // Bez ovoga bi strani ključevi tražili savršen redoslijed tabela.
  if (potvrdi) await klijent.query("SET session_replication_role = replica");

  const linije = readline.createInterface({ input: citaj(fajl!), crlfDelay: Infinity });
  for await (const linija of linije) {
    if (!linija.trim()) continue;
    const stavka = JSON.parse(linija) as Record<string, unknown>;

    if (!zaglavlje) {
      zaglavlje = stavka as Zaglavlje;
      if (zaglavlje.format !== KOPIJA_FORMAT) {
        throw new Error(`Ovo nije kopija sadržaja (format: ${String(zaglavlje.format)})`);
      }
      console.log(`Kopija od ${zaglavlje.vrijeme}, tabela: ${zaglavlje.tabele?.length ?? 0}`);
      continue;
    }

    if (typeof stavka["tabela"] === "string") {
      await isprazni();
      tabela = stavka["tabela"];
      kolone = uBazi.get(tabela) ?? null;
      if (!kolone || (samo && !samo.includes(tabela))) {
        if (!kolone) preskoceno.push(tabela);
        tabela = null;
        kolone = null;
        continue;
      }
      dirnute.push(tabela);
      if (potvrdi) await klijent.query(`TRUNCATE "${tabela}" CASCADE`);
      continue;
    }

    if (stavka["red"] && tabela) {
      red.push(stavka["red"] as Record<string, unknown>);
      if (red.length >= KOMAD) await isprazni();
      continue;
    }

    if (typeof stavka["kraj"] === "string") {
      await isprazni();
      tabela = null;
      kolone = null;
    }
  }
  await isprazni();

  if (potvrdi) {
    for (const ime of dirnute) await popraviBrojace(ime);
    await klijent.query("SET session_replication_role = origin");
    await klijent.query("COMMIT");
  }

  for (const [ime, broj] of [...upisano].sort((a, b) => a[0].localeCompare(b[0], "bs"))) {
    console.log(`  ${ime}: ${broj}`);
  }
  if (preskoceno.length > 0) {
    console.log(`Preskočeno (tabela nema u ovoj bazi): ${preskoceno.join(", ")}`);
  }
  console.log(
    potvrdi
      ? "Sadržaj je vraćen."
      : "Proba — ništa nije upisano. Dodaj --potvrdi da se kopija stvarno vrati.",
  );
}

main()
  .catch(async err => {
    if (potvrdi) {
      try {
        await klijent.query("ROLLBACK");
      } catch {
        /* veza je možda već pala */
      }
    }
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await klijent.end().catch(() => {});
  });
