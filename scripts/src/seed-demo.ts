import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  usersTable,
  muallimProfiliTable,
  ucenikProfiliTable,
  roditeljProfiliTable,
  roditeljUcenikTable,
  grupeTable,
  mektebiTable,
  priustvoTable,
  ocjeneTable,
  mektebKalendarTable,
  planLekcijaTable,
  zadaceTable,
  kvizRezultatiTable,
  studentProgressTable,
  ilmihalLekcijeTable,
  kvizoviTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { clearDemoData } from "./clear-demo";

const DEMO_PREFIX = "demo.";
const DEMO_GROUP_PREFIX = "Demo - ";
const DEMO_NOTE_TAG = "[DEMO]";

const grupe = [
  { naziv: `${DEMO_GROUP_PREFIX}Mlađi (I-III razred)`, dani: ["sri", "pet"], vrijeme: "16:00", students: [
    { first: "Amina", last: "Hasić" },
    { first: "Ali", last: "Bektić" },
    { first: "Lejla", last: "Mehmedović" },
    { first: "Hamza", last: "Spahić" },
    { first: "Sara", last: "Begić" },
    { first: "Tarik", last: "Avdić" },
  ]},
  { naziv: `${DEMO_GROUP_PREFIX}Srednji (IV-V razred)`, dani: ["uto", "cet"], vrijeme: "17:00", students: [
    { first: "Emina", last: "Selimović" },
    { first: "Adnan", last: "Hodžić" },
    { first: "Zara", last: "Kurtović" },
    { first: "Faris", last: "Tahirović" },
    { first: "Lamija", last: "Beganović" },
    { first: "Kerim", last: "Imamović" },
  ]},
  { naziv: `${DEMO_GROUP_PREFIX}Stariji (VI-VIII razred)`, dani: ["sub"], vrijeme: "10:00", students: [
    { first: "Iman", last: "Salihović" },
    { first: "Hasan", last: "Karić" },
    { first: "Maja", last: "Kovačević" },
    { first: "Omar", last: "Žiga" },
    { first: "Ajla", last: "Hadžić" },
    { first: "Vedad", last: "Memić" },
  ]},
];

const kategorijeOcjena = ["učenje", "vladanje", "aktivnost", "domaća zadaća"];
const naslovi = [
  "Abdest", "Sabah namaz", "Sura El-Fatiha", "Iman", "Ramazan i post",
  "Ahlak", "Život Poslanika a.s.", "Dove i zikr", "Pet stubova islama",
  "Halal i haram",
];

const kalendarDogadjaji = [
  { offset: -45, tip: "praznik", opis: "Mevlud — rođenje Poslanika a.s." },
  { offset: -20, tip: "ispit", opis: "Provjera znanja — Ilmihal nivo 1" },
  { offset: -10, tip: "mekteb", opis: "Posebna pouka — adabi u mektebu" },
  { offset: 5, tip: "mekteb", opis: "Roditeljski sastanak" },
  { offset: 14, tip: "ispit", opis: "Polugodišnji test" },
  { offset: 21, tip: "praznik", opis: "Lejletu-l-Berat" },
  { offset: 30, tip: "raspust", opis: "Proljetni raspust (3 dana)" },
  { offset: 45, tip: "mekteb", opis: "Učlanjivanje u dovaski krug" },
  { offset: 60, tip: "ispit", opis: "Završni kviz iz Ilmihala 1" },
  { offset: 75, tip: "praznik", opis: "Ramazanski Bajram - mubarek!" },
];

const zadace = [
  { naslov: "Naučiti suru El-Fatiha napamet", opis: "Vježbati 5 minuta dnevno. Snimit ćemo na času.", offsetRok: 7 },
  { naslov: "Pročitati priču o Poslaniku a.s.", opis: "Knjiga: Hayat (str. 20-30). Pripremit pitanja za sljedeći čas.", offsetRok: 14 },
  { naslov: "Vježbati abdest", opis: "Roditelji potpisuju da je dijete vježbalo barem 3x sedmično.", offsetRok: 10 },
];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}
function fmtDate(d: Date): string { return d.toISOString().split("T")[0]; }
function dayCode(d: Date): string { return ["ned", "pon", "uto", "sri", "cet", "pet", "sub"][d.getDay()]; }
function slugify(name: string): string {
  return name.toLowerCase()
    .replace(/[čć]/g, "c").replace(/[š]/g, "s").replace(/[ž]/g, "z").replace(/[đ]/g, "dj")
    .replace(/[^a-z0-9]/g, ".");
}

export async function seedDemo() {
  console.log("🌱 Seeding demo data...");
  console.log("🧹 Brišem prethodne demo podatke (ako postoje) da izbjegnem duplikate...");
  await clearDemoData(false);

  // 1) Demo mekteb
  let [mekteb] = await db.select().from(mektebiTable).where(eq(mektebiTable.naziv, "Demo Mekteb"));
  if (!mekteb) {
    [mekteb] = await db.insert(mektebiTable).values({
      naziv: "Demo Mekteb",
      grad: "Sarajevo",
      kontaktEmail: "demo@mekteb.net",
    }).returning();
    console.log("✅ Demo mekteb kreiran");
  }

  // 2) Demo muallim
  let [muallimUser] = await db.select().from(usersTable).where(eq(usersTable.username, `${DEMO_PREFIX}muallim`));
  if (!muallimUser) {
    const hash = await bcrypt.hash("demo123", 10);
    [muallimUser] = await db.insert(usersTable).values({
      username: `${DEMO_PREFIX}muallim`,
      displayName: "Muallim Sabit Hodžić",
      email: "demo.muallim@mekteb.net",
      passwordHash: hash,
      role: "muallim",
    }).returning();
    await db.insert(muallimProfiliTable).values({
      userId: muallimUser.id,
      mektebId: mekteb.id,
      licenceCount: 30,
    });
    console.log("✅ Demo muallim: demo.muallim / demo123");
  }

  // 3) Demo grupe i učenici
  const today = new Date();
  const allUcenikIds: number[] = [];

  for (const g of grupe) {
    let [grupa] = await db.select().from(grupeTable).where(eq(grupeTable.naziv, g.naziv));
    if (!grupa) {
      [grupa] = await db.insert(grupeTable).values({
        muallimId: muallimUser.id,
        naziv: g.naziv,
        skolskaGodina: "Mektebska 2025/26",
        daniNastave: g.dani,
        vrijemeNastave: g.vrijeme,
      }).returning();
      console.log(`✅ Grupa: ${g.naziv}`);
    }

    // Učenici
    const ucenikIds: number[] = [];
    for (const s of g.students) {
      const username = `${DEMO_PREFIX}${slugify(s.first)}.${slugify(s.last)}`;
      let [u] = await db.select().from(usersTable).where(eq(usersTable.username, username));
      if (!u) {
        const hash = await bcrypt.hash("demo123", 10);
        [u] = await db.insert(usersTable).values({
          username,
          displayName: `${s.first} ${s.last}`,
          passwordHash: hash,
          role: "ucenik",
        }).returning();
        await db.insert(ucenikProfiliTable).values({
          userId: u.id,
          muallimId: muallimUser.id,
          grupaId: grupa.id,
          mektebId: mekteb.id,
        });
      }
      ucenikIds.push(u.id);
      allUcenikIds.push(u.id);
    }
    console.log(`  → ${ucenikIds.length} učenika u grupi`);

    // 4) Prisustvo: posljednjih 8 sedmica, samo na danima nastave
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 56);
    const datumiNastave: string[] = [];
    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
      if (g.dani.includes(dayCode(d))) datumiNastave.push(fmtDate(d));
    }

    for (const datum of datumiNastave) {
      for (const ucId of ucenikIds) {
        const r = Math.random();
        const status = r < 0.85 ? "prisutan" : r < 0.92 ? "kasni" : r < 0.97 ? "odsutan" : "opravdano";
        await db.insert(priustvoTable).values({
          ucenikId: ucId,
          grupaId: grupa.id,
          muallimId: muallimUser.id,
          datum,
          status,
          napomena: status !== "prisutan" ? `${DEMO_NOTE_TAG}` : null,
        });
      }
    }
    console.log(`  → Prisustvo za ${datumiNastave.length} dana zabilježeno`);

    // 5) Ocjene: 5-10 po učeniku
    for (const ucId of ucenikIds) {
      const broj = randInt(5, 10);
      for (let i = 0; i < broj; i++) {
        const datum = new Date(today);
        datum.setDate(datum.getDate() - randInt(1, 50));
        await db.insert(ocjeneTable).values({
          ucenikId: ucId,
          muallimId: muallimUser.id,
          grupaId: grupa.id,
          kategorija: rand(kategorijeOcjena),
          ocjena: randInt(3, 5),
          lekcijaNaziv: rand(naslovi),
          napomena: `${DEMO_NOTE_TAG}`,
          datum: fmtDate(datum),
        });
      }
    }

    // 6) Kalendar — 10 događaja po grupi
    for (const ev of kalendarDogadjaji) {
      const datum = new Date(today);
      datum.setDate(datum.getDate() + ev.offset);
      await db.insert(mektebKalendarTable).values({
        grupaId: grupa.id,
        muallimId: muallimUser.id,
        datum: fmtDate(datum),
        tip: ev.tip,
        opis: `${DEMO_NOTE_TAG} ${ev.opis}`,
      });
    }

    // 7) Plan lekcija — sljedećih 4 sedmice
    const lekcije = pickN(naslovi, 8);
    let lekcijaIdx = 0;
    const startPlan = new Date(today);
    for (let d = new Date(startPlan); d <= new Date(today.getTime() + 28 * 86400000); d.setDate(d.getDate() + 1)) {
      if (g.dani.includes(dayCode(d)) && lekcijaIdx < lekcije.length) {
        await db.insert(planLekcijaTable).values({
          grupaId: grupa.id,
          muallimId: muallimUser.id,
          datum: fmtDate(d),
          lekcijaNaslov: `${DEMO_NOTE_TAG} ${lekcije[lekcijaIdx]}`,
          lekcijaTip: "ilmihal",
          redoslijed: lekcijaIdx,
        });
        lekcijaIdx++;
      }
    }

    // 8) Zadaće
    for (const z of zadace) {
      const rok = new Date(today);
      rok.setDate(rok.getDate() + z.offsetRok);
      await db.insert(zadaceTable).values({
        grupaId: grupa.id,
        muallimId: muallimUser.id,
        naslov: `${DEMO_NOTE_TAG} ${z.naslov}`,
        opis: z.opis,
        rokDo: fmtDate(rok),
        lekcijaNaslov: rand(naslovi),
        lekcijaTip: "ilmihal",
      });
    }
  }

  // 8.5) Demo roditelji — povezani sa po nekoliko demo učenika
  const demoRoditelji = [
    { username: `${DEMO_PREFIX}roditelj.amir`, displayName: "Amir Hadžić (roditelj)", linkSlugs: ["demo.amina.hasic", "demo.ali.bektic"] },
    { username: `${DEMO_PREFIX}roditelj.fatma`, displayName: "Fatma Selimović (roditelj)", linkSlugs: ["demo.faris.tahirovic", "demo.lamija.beganovic"] },
  ];
  for (const r of demoRoditelji) {
    let [u] = await db.select().from(usersTable).where(eq(usersTable.username, r.username));
    if (!u) {
      const hash = await bcrypt.hash("demo123", 10);
      [u] = await db.insert(usersTable).values({
        username: r.username,
        displayName: r.displayName,
        passwordHash: hash,
        role: "roditelj",
      }).returning();
      await db.insert(roditeljProfiliTable).values({ userId: u.id });
    }
    for (const slug of r.linkSlugs) {
      const [child] = await db.select().from(usersTable).where(eq(usersTable.username, slug));
      if (child) {
        await db.insert(roditeljUcenikTable).values({ roditeljId: u.id, ucenikId: child.id }).onConflictDoNothing();
      }
    }
    console.log(`✅ Demo roditelj: ${r.username} / demo123 (${r.linkSlugs.length} djece)`);
  }

  // 9) Kviz rezultati i student_progress za sve učenike
  const [{ id: lekcijaSampleStart }] = await db.select({ id: ilmihalLekcijeTable.id }).from(ilmihalLekcijeTable).limit(1);
  const allLekcije = await db.select({ id: ilmihalLekcijeTable.id }).from(ilmihalLekcijeTable).limit(40);
  const allKvizovi = await db.select({ id: kvizoviTable.id, naslov: kvizoviTable.naslov }).from(kvizoviTable).limit(8);

  for (const ucId of allUcenikIds) {
    // 3-5 kviz rezultata
    const brojKv = randInt(3, 5);
    for (let i = 0; i < brojKv; i++) {
      const kv = rand(allKvizovi);
      const tacni = randInt(6, 10);
      const ukupno = 10;
      const procenat = Math.round((tacni / ukupno) * 100);
      const completed = new Date(today);
      completed.setDate(completed.getDate() - randInt(1, 40));
      await db.insert(kvizRezultatiTable).values({
        userId: ucId,
        kvizId: kv.id,
        kvizNaslov: kv.naslov,
        tacniOdgovori: tacni,
        ukupnoPitanja: ukupno,
        procenat,
        bodovi: tacni * 10,
        completedAt: completed,
      });
    }

    // student_progress
    const completedLekcije = pickN(allLekcije.map(l => l.id), randInt(3, 18));
    const streakDays = randInt(1, 14);
    const lastActivity = new Date(today);
    lastActivity.setDate(lastActivity.getDate() - randInt(0, 2));
    const lastActivityStr = fmtDate(lastActivity);

    const existing = await db.select().from(studentProgressTable).where(eq(studentProgressTable.studentId, String(ucId)));
    if (existing.length === 0) {
      await db.insert(studentProgressTable).values({
        studentId: String(ucId),
        totalHasanat: completedLekcije.length * randInt(15, 25),
        completedLessons: completedLekcije,
        badges: [],
        streakDays,
        lastActivityDate: lastActivityStr,
      });
    }
  }
  console.log(`✅ Kvizovi i napredak za ${allUcenikIds.length} učenika`);

  console.log("\n🎉 Demo podaci uspješno dodani!");
  console.log("\nLogin podaci za testiranje:");
  console.log("  Muallim:  demo.muallim / demo123");
  console.log("  Učenik:   demo.amina.hasic / demo123  (i ostali)");
  console.log("\nDa obrišeš demo podatke, pokreni: pnpm --filter @workspace/scripts run clear-demo");
}

const invokedViaCli = process.argv[1]?.endsWith("/seed-demo.ts") ?? false;
if (invokedViaCli) {
  seedDemo().catch(err => {
    console.error("❌ Greška:", err);
    process.exit(1);
  });
}
