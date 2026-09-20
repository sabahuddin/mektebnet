/**
 * Etapni ispit na stranom jeziku.
 *
 * Pitanja etapnog ispita dolaze iz `pitanja_banka`, a naziv etape iz
 * `medaljoni` — obje tabele prevodilac već puni. Rute u `etape.ts` te
 * prijevode dugo nisu preklapale, pa je dijete na njemačkom dobijalo bosanski
 * ispit iako prijevod postoji u bazi. Ovaj test to drži zatvorenim.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  ilmihalLekcijeTable,
  medaljoniTable,
  pitanjaBankaTable,
  studentProgressTable,
  usersTable,
} from "@workspace/db/schema";
import app from "../app.js";
import { bootstrapDrizzleMigrations, runDrizzleMigrate } from "../lib/drizzle-migrate.js";
import { signToken } from "../middlewares/auth.js";

const suffix = `etapa-prijevod-${Date.now()}`;
const medaljonSlug = `test-${suffix}`;
const lekcijaSlug = `test-lekcija-${suffix}`;
const NIVO = 7; // rezervisan nivo — produkcijski sadržaj ga ne koristi

let server: Server | undefined;
let baseUrl: string;
let studentId: number;
let studentToken: string;
let medaljonId: number;
let lekcijaId: number;
let pitanjeId: number;

async function prevedi(tabela: string, redId: number, polje: string, prijevod: string) {
  await db.execute(sql`
    INSERT INTO content_prijevodi (tabela, red_id, polje, jezik, prijevod, izvor_hash)
    VALUES (${tabela}, ${redId}, ${polje}, 'de', ${prijevod}, 'test')
  `);
}

before(async () => {
  await bootstrapDrizzleMigrations();
  await runDrizzleMigrate();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS content_prijevodi (
      id serial PRIMARY KEY,
      tabela varchar(60) NOT NULL,
      red_id integer NOT NULL,
      polje varchar(60) NOT NULL,
      jezik varchar(5) NOT NULL,
      prijevod text NOT NULL,
      izvor_hash varchar(64) NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )
  `);

  const [lekcija] = await db.insert(ilmihalLekcijeTable).values({
    slug: lekcijaSlug,
    naslov: "Abdest",
    nivo: NIVO,
    redoslijed: 1,
    dostupnost: "svi",
  }).returning({ id: ilmihalLekcijeTable.id });
  lekcijaId = lekcija!.id;

  const [pitanje] = await db.insert(pitanjaBankaTable).values({
    pitanje: "Koliko puta se pere lice pri abdestu?",
    opcije: ["Jednom", "Dva puta", "Tri puta"],
    correctIndex: 2,
  }).returning({ id: pitanjaBankaTable.id });
  pitanjeId = pitanje!.id;

  const [medaljon] = await db.insert(medaljoniTable).values({
    slug: medaljonSlug,
    naziv: "Etapa čistoće",
    opis: "Ponavljanje lekcija o čistoći.",
    nivo: NIVO,
    posAfterRedoslijed: 1,
    kvizPitanjaIds: [pitanjeId],
  }).returning({ id: medaljoniTable.id });
  medaljonId = medaljon!.id;

  await prevedi("medaljoni", medaljonId, "naziv", "Etappe der Reinheit");
  await prevedi("ilmihal_lekcije", lekcijaId, "naslov", "Die Gebetswaschung");
  await prevedi("pitanja_banka", pitanjeId, "pitanje", "Wie oft wäscht man das Gesicht?");
  await prevedi("pitanja_banka", pitanjeId, "opcije", JSON.stringify(["Einmal", "Zweimal", "Dreimal"]));

  const [student] = await db.insert(usersTable).values({
    username: `ucenik-${suffix}`,
    passwordHash: "x",
    displayName: "Test učenik",
    role: "ucenik",
  }).returning({ id: usersTable.id });
  studentId = student!.id;
  studentToken = signToken({
    userId: studentId,
    username: `ucenik-${suffix}`,
    role: "ucenik",
    displayName: "Test učenik",
  });
  // Ispit je otključan tek kad su sve lekcije etape završene.
  await db.insert(studentProgressTable).values({
    studentId: String(studentId),
    completedLessons: [lekcijaId],
  });

  server = app.listen(0);
  await new Promise<void>((r) => server!.once("listening", () => r()));
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}/api`;
});

after(async () => {
  if (server) await new Promise<void>((r) => server!.close(() => r()));
  await db.execute(sql`
    DELETE FROM content_prijevodi
    WHERE (tabela = 'medaljoni' AND red_id = ${medaljonId})
       OR (tabela = 'ilmihal_lekcije' AND red_id = ${lekcijaId})
       OR (tabela = 'pitanja_banka' AND red_id = ${pitanjeId})
  `);
  if (studentId) {
    await db.delete(studentProgressTable).where(eq(studentProgressTable.studentId, String(studentId)));
    await db.delete(usersTable).where(eq(usersTable.id, studentId));
  }
  if (medaljonId) await db.delete(medaljoniTable).where(eq(medaljoniTable.id, medaljonId));
  if (pitanjeId) await db.delete(pitanjaBankaTable).where(inArray(pitanjaBankaTable.id, [pitanjeId]));
  if (lekcijaId) await db.delete(ilmihalLekcijeTable).where(eq(ilmihalLekcijeTable.id, lekcijaId));
});

test("pregled etape na njemačkom vraća prevedenu etapu i naslove lekcija", async () => {
  const res = await fetch(`${baseUrl}/etape/medaljon/${medaljonSlug}`, {
    headers: { "X-Lang": "de", Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(res.status, 200);
  const body = await res.json() as {
    medaljon: { naziv: string; brojPitanja: number; imaKviz: boolean };
    lekcije: Array<{ naslov: string }>;
  };
  assert.equal(body.medaljon.naziv, "Etappe der Reinheit");
  assert.equal(body.lekcije[0]?.naslov, "Die Gebetswaschung");
  // Polja koja nisu tekst moraju preživjeti preklapanje netaknuta.
  assert.equal(body.medaljon.brojPitanja, 1);
  assert.equal(body.medaljon.imaKviz, true);
});

test("bez X-Lang zaglavlja pregled etape ostaje bosanski", async () => {
  const res = await fetch(`${baseUrl}/etape/medaljon/${medaljonSlug}`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const body = await res.json() as { medaljon: { naziv: string }; lekcije: Array<{ naslov: string }> };
  assert.equal(body.medaljon.naziv, "Etapa čistoće");
  assert.equal(body.lekcije[0]?.naslov, "Abdest");
});

test("pokrenuti ispit na njemačkom nosi prevedena pitanja i ponuđene odgovore", async () => {
  const res = await fetch(`${baseUrl}/etape/medaljon/${medaljonSlug}/start`, {
    method: "POST",
    headers: {
      "X-Lang": "de",
      "Content-Type": "application/json",
      Authorization: `Bearer ${studentToken}`,
    },
    body: "{}",
  });
  assert.equal(res.status, 200);
  const body = await res.json() as {
    naziv: string;
    pitanja: Array<{ id: number; pitanje: string; opcije: string[] }>;
  };
  assert.equal(body.naziv, "Etappe der Reinheit");
  assert.equal(body.pitanja.length, 1);
  assert.equal(body.pitanja[0]?.pitanje, "Wie oft wäscht man das Gesicht?");
  assert.deepEqual(body.pitanja[0]?.opcije, ["Einmal", "Zweimal", "Dreimal"]);
});
