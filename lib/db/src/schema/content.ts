import { pgTable, serial, text, integer, boolean, timestamp, varchar, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Centralna banka pitanja — kategorije i vrste pitanja koje admin koristi pri
// kreiranju pitanja u banci. `KVIZ_KATEGORIJE` je pedagoški širok set:
// vjerovanje (akida), namaz/ibadet, ahlak (lijepo ponašanje), historija,
// Bosna i njena baština, sure i ajeti, dove i zikrovi, halal/haram, Kuran,
// Sufara (osnove arapskog), opće znanje. Admin može ostaviti `null` ako
// pitanje ne pripada nijednoj jasnoj kategoriji.
export const KVIZ_KATEGORIJE = [
  "vjerovanje",
  "namaz",
  "ahlak",
  "historija",
  "bosna",
  "sure",
  "dove",
  "halal_haram",
  "kuran",
  "sufara",
  "opce",
] as const;
export type KvizKategorija = (typeof KVIZ_KATEGORIJE)[number];

export const KVIZ_KATEGORIJE_META: Record<KvizKategorija, { naziv: string; ikona: string }> = {
  vjerovanje: { naziv: "Vjerovanje (Akida)", ikona: "⭐" },
  namaz: { naziv: "Namaz i ibadeti", ikona: "🕌" },
  ahlak: { naziv: "Lijepo ponašanje (Ahlak)", ikona: "💝" },
  historija: { naziv: "Islamska historija", ikona: "📜" },
  bosna: { naziv: "Bosna i naša baština", ikona: "🇧🇦" },
  sure: { naziv: "Sure i ajeti", ikona: "📖" },
  dove: { naziv: "Dove i zikrovi", ikona: "🤲" },
  halal_haram: { naziv: "Halal i haram", ikona: "⚖️" },
  kuran: { naziv: "Kur'an", ikona: "📕" },
  sufara: { naziv: "Sufara — arapsko pismo", ikona: "ﺃ" },
  opce: { naziv: "Opće znanje", ikona: "💡" },
};

// Vrsta pitanja u banci.
// - "single":    jedan tačan odgovor među opcijama (correctIndex)
// - "multiple":  više tačnih odgovora (correctIndexes)
// - "truefalse": Da/Ne pitanje — opcije su uvijek ["Da","Ne"], correctIndex=0|1.
//                Frontend renderira identično kao single ali sa 2 dugmeta.
// - "reorder":   poredaj stavke pravilnim redoslijedom — opcije su tekstovi
//                stavki u redoslijedu kako se PRIKAZUJU učeniku (može i kao
//                izvorni redoslijed iz banke), a `correctOrder` je niz pozicija
//                (1-based) koji govori koja stavka je 1., koja 2., itd.
//                Primjer: opcije=["A","B","C"], correctOrder=[3,1,2] znači
//                "A treba biti 3., B 1., C 2.".
// - "dragDrop":  "Dopuni..." — šablon sa DROP markerima i bank riječi koje
//                učenik povlači (klikom) u prazne slotove. Drži se u `meta`:
//                  { template: string[] (sa "DROP" markerima),
//                    words:    string[] (pool ponuđenih riječi),
//                    correct:  string[] (tačan slijed za DROP slotove) }
//                Polje `opcije` se ne koristi (ostaje []).
// - "markWords": "Pronađi grešku" — učenik klikne pogrešne riječi u tekstu.
//                Drži se u `meta`:
//                  { text:      string   (pun tekst, fallback),
//                    words:     string[] (klikabilne riječi po redu),
//                    incorrect: string[] (riječi koje treba kliknuti) }
//                Polje `opcije` se ne koristi (ostaje []).
export const PITANJE_VRSTE = ["single", "multiple", "truefalse", "reorder", "dragDrop", "markWords"] as const;
export type PitanjeVrsta = (typeof PITANJE_VRSTE)[number];

// Tip-specifični meta podaci za dragDrop / markWords pitanja.
// Stari (single/multiple/truefalse/reorder) tipovi imaju `meta = null`.
export interface PitanjeMeta {
  template?: string[];   // dragDrop
  words?: string[];      // dragDrop + markWords
  correct?: string[];    // dragDrop
  text?: string;         // markWords
  incorrect?: string[];  // markWords
}

// Ilmihal lessons (3 nivoa)
export interface LekcijaKvizPitanje {
  question: string;
  options: string[];
  answer: string;
}

export const ilmihalLekcijeTable = pgTable("ilmihal_lekcije", {
  id: serial("id").primaryKey(),
  nivo: integer("nivo").notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  naslov: text("naslov").notNull(),
  contentHtml: text("content_html").notNull().default(""),
  audioSrc: varchar("audio_src", { length: 500 }),
  redoslijed: integer("redoslijed").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(true),
  // Predmet (Akaid, Ahlak, Ibadat, ...) — koristi se za filter na "Sve lekcije".
  // Inicijalno backfill-ovano iz priprema HTML-a (regex extract iz meta bloka),
  // dalje admin može direktno mijenjati. NULL za lekcije bez priprema/predmeta.
  predmet: varchar("predmet", { length: 60 }),
  kvizPitanja: jsonb("kviz_pitanja").$type<LekcijaKvizPitanje[]>(),
  locked: boolean("locked").notNull().default(false),
  lockedAt: timestamp("locked_at"),
  lockedNote: text("locked_note"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Quizzes (ilmihal + books)
export interface QuizQuestion {
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
  image?: string;
}

export const kvizoviTable = pgTable("kvizovi", {
  id: serial("id").primaryKey(),
  nivo: integer("nivo"),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  naslov: text("naslov").notNull(),
  modul: varchar("modul", { length: 50 }).notNull().default("ilmihal"),
  variant: varchar("variant", { length: 20 }).default("normal"),
  // LEGACY: pitanja ugrađena u kviz kao JSONB. Zadržava se kao fallback
  // dok se svi kvizovi ne migriraju u banku pitanja (vidi `pitanjaBankaTable`
  // i `kvizPitanjaTable`). Read path prvo provjerava join tabelu, pa ako je
  // prazna pada na ovaj jsonb. Novi kvizovi pravljeni preko admin UI-ja
  // odmah koriste banku i ovo polje ostaje prazno (default []).
  pitanja: jsonb("pitanja").$type<QuizQuestion[]>().notNull().default([]),
  // Vezivanje kviza za pedagoške oblasti. Kategorija = široka oblast
  // (vidi KVIZ_KATEGORIJE), lekcijaId = opciona veza za konkretnu Ilmihal
  // lekciju. Oboje opciono — postojeći kvizovi nakon migracije će imati NULL
  // dok ih admin ne kategorizuje.
  kategorija: varchar("kategorija", { length: 60 }),
  lekcijaId: integer("lekcija_id"),
  opis: text("opis").notNull().default(""),
  // Koliko nasumičnih pitanja se generira po sesiji kad učenik pokrene kviz.
  // Ako je `null`, klijent koristi default (20). Postavlja se per-kviz npr. za
  // tematske kvizove sa velikim banaka pitanja (100+) gdje želimo 30 po sesiji.
  pitanjaPoSesiji: integer("pitanja_po_sesiji"),
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// === BANKA PITANJA — centralizovana baza svih pitanja za kvizove ================
// Sva pitanja koja se mogu pojaviti u bilo kojem kvizu žive u ovoj tabeli.
// Kviz NE drži pitanja sam, već referencira ID-jeve preko join tabele
// `kvizPitanjaTable`. Tako:
//   - isto pitanje može biti u više kvizova istovremeno (M:N),
//   - edit pitanja u banci automatski mijenja sve kvizove gdje stoji,
//   - brisanje pitanja iz banke (ON DELETE CASCADE) tiho ga uklanja iz
//     svih kvizova, bez gubitka istorije rezultata (jer `kviz_rezultati`
//     već čuva snapshot `kvizNaslov` + brojeve).
//
// `pitanje` je UNIQUE po normalizovanom (lower+trim) tekstu da se izbjegne
// duplo dodavanje istog pitanja kroz admin formu. Migracioni script koristi
// to za dedup pri prelasku iz JSONB-a u banku.
export const pitanjaBankaTable = pgTable("pitanja_banka", {
  id: serial("id").primaryKey(),
  pitanje: text("pitanje").notNull(),
  opcije: jsonb("opcije").$type<string[]>().notNull().default([]),
  // 0-based indeks tačnog odgovora unutar `opcije`. Za `vrsta='single'` ovo je
  // primarni izvor istine. Za `vrsta='multiple'` postavlja se na prvi indeks
  // iz `correctIndexes` (radi back-compata sa starim read path-om).
  correctIndex: integer("correct_index").notNull().default(0),
  // Lista 0-based indeksa tačnih odgovora za `vrsta='multiple'`. Za 'single'
  // ostaje `null` (tada se koristi samo `correctIndex`). Frontend renderira
  // multi-select kad ima više od jednog elementa; read path slaže
  // `answer = opcije[i].join('|||')` za backward kompatibilnost sa kviz UI.
  correctIndexes: jsonb("correct_indexes").$type<number[] | null>(),
  // Za vrsta='reorder': niz 1-based pozicija koji preslikava `opcije[i]` u
  // tačnu poziciju. Dužina mora biti ista kao `opcije`. Za ostale tipove NULL.
  correctOrder: jsonb("correct_order").$type<number[] | null>(),
  // Tip-specifični podaci za interaktivne tipove (dragDrop, markWords).
  // Za standardne single/multiple/truefalse/reorder ostaje NULL.
  // Vidi `PitanjeMeta` interface za shape.
  meta: jsonb("meta").$type<PitanjeMeta | null>(),
  objasnjenje: text("objasnjenje").notNull().default(""),
  // URL slike (relativan, npr. /uploads/xyz.png). Renderira se iznad pitanja.
  slika: varchar("slika", { length: 500 }),
  vrsta: varchar("vrsta", { length: 20 }).notNull().default("single"),
  kategorija: varchar("kategorija", { length: 60 }),
  // Veza za konkretnu Ilmihal lekciju (opciono). Kasnije se može koristiti
  // za "predloži pitanje za ovu lekciju" UX.
  lekcijaId: integer("lekcija_id"),
  tezina: integer("tezina").notNull().default(1), // 1=lako, 2=srednje, 3=teško
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  // Dedup strategija ovisi o `vrsta`:
  // - Standardni tipovi (single/multiple/truefalse/reorder): UNIQUE po `pitanje`.
  //   Tekst pitanja je dovoljno specifičan da identifikuje pitanje.
  // - Interaktivni tipovi (dragDrop/markWords): UNIQUE po `(pitanje, md5(meta))`.
  //   Razlog: ista generička pitanja kao "Dopuni:" ili "Pronađi greške:" se
  //   koriste za 40+ različitih varijanti (template/words/correct se mijenjaju).
  //   Bez meta hash-a sve te varijante bi se prepisivale jedna preko druge i
  //   gubile bi se desetine pitanja. Partial indeksi se kreiraju RAW SQL-om
  //   u migration push-u jer drizzle ne podržava `WHERE` na uniqueIndex.
  //   Manage-an i u `scripts/src/migrate-pitanja-u-banku.ts` (ručni dedup za
  //   interaktivne) i raw SQL u inicijalnom migration step-u (vidi DB ALTER).
  kategorijaIdx: index("pitanja_banka_kategorija_idx").on(t.kategorija),
  lekcijaIdx: index("pitanja_banka_lekcija_idx").on(t.lekcijaId),
}));

export type PitanjeBanka = typeof pitanjaBankaTable.$inferSelect;
export type InsertPitanjeBanka = typeof pitanjaBankaTable.$inferInsert;

// === KVIZ ↔ PITANJE (M:N join) ==================================================
// Veže pitanja iz banke za konkretne kvizove. Isto pitanje može biti u više
// kvizova; isti kviz može imati isto pitanje samo jednom (UNIQUE). `redoslijed`
// kontroliše redoslijed prikaza unutar kviza. ON DELETE CASCADE na obje strane:
//   - brisanje kviza briše sve njegove veze (pitanja u banci ostaju),
//   - brisanje pitanja iz banke uklanja ga iz svih kvizova (rezultati ostaju
//     netaknuti jer žive u kviz_rezultati sa snapshot vrijednostima).
export const kvizPitanjaTable = pgTable("kviz_pitanja", {
  id: serial("id").primaryKey(),
  kvizId: integer("kviz_id").notNull(),
  pitanjeId: integer("pitanje_id").notNull(),
  redoslijed: integer("redoslijed").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  kvizPitanjeUnique: uniqueIndex("kviz_pitanja_kviz_pitanje_unique_idx")
    .on(t.kvizId, t.pitanjeId),
  kvizRedoslijedIdx: index("kviz_pitanja_kviz_redoslijed_idx")
    .on(t.kvizId, t.redoslijed),
  pitanjeIdx: index("kviz_pitanja_pitanje_idx").on(t.pitanjeId),
}));

export type KvizPitanje = typeof kvizPitanjaTable.$inferSelect;
export type InsertKvizPitanje = typeof kvizPitanjaTable.$inferInsert;

// Books / Čitaonica (stories about prophets etc.)
export const knjige = pgTable("knjige", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  naslov: text("naslov").notNull(),
  // Slug-style key matching kategorijeKnjigeTable.slug. NEMA FK constrainta —
  // konvencija (lakše brisanje kategorije bez orphan-a; orphan-i se grupišu
  // pod "Bez kategorije" na frontendu).
  kategorija: varchar("kategorija", { length: 50 }).notNull().default("prica"),
  contentHtml: text("content_html").notNull().default(""),
  coverImage: varchar("cover_image", { length: 500 }),
  redoslijed: integer("redoslijed").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Kategorije za Čitaonicu — admin-definisane grupe priča.
// `slug` se referencira iz `knjige.kategorija` (string match, no FK).
// `defaultOpen` kontroliše početno stanje akordiona na javnoj /citaonica.
export const kategorijeKnjigeTable = pgTable("kategorije_knjige", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  naziv: varchar("naziv", { length: 120 }).notNull(),
  opis: text("opis"),
  redoslijed: integer("redoslijed").notNull().default(100),
  defaultOpen: boolean("default_open").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export type KategorijaKnjige = typeof kategorijeKnjigeTable.$inferSelect;
export type InsertKategorijaKnjige = typeof kategorijeKnjigeTable.$inferInsert;

// Kategorije za pitanja u banci. Admin-definisane (mogu se dodavati/brisati
// kroz admin panel). `slug` se referencira iz `pitanja_banka.kategorija`
// (string match, no FK — brisanje kategorije ostavlja postojeća pitanja sa
// stalnim slugom u koloni; admin ih može masovno premjestiti ili će se
// prikazivati pod "Bez kategorije" u UI-ju).
// Inicijalni seed iz `KVIZ_KATEGORIJE_META` se ubacuje pri prvom startu
// (vidi runResidualSchema u api-server/src/index.ts).
export const kvizKategorijeTable = pgTable("kviz_kategorije", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 60 }).notNull().unique(),
  naziv: varchar("naziv", { length: 120 }).notNull(),
  ikona: varchar("ikona", { length: 16 }),
  redoslijed: integer("redoslijed").notNull().default(100),
  createdAt: timestamp("created_at").defaultNow(),
});

export type KvizKategorijaRow = typeof kvizKategorijeTable.$inferSelect;
export type InsertKvizKategorijaRow = typeof kvizKategorijeTable.$inferInsert;

// User content progress (across all modules)
export const korisnikNapredakTable = pgTable("korisnik_napredak", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  contentType: varchar("content_type", { length: 30 }).notNull(),
  contentId: integer("content_id").notNull(),
  zavrsen: boolean("zavrsen").notNull().default(false),
  bodovi: integer("bodovi").notNull().default(0),
  pokusaji: integer("pokusaji").notNull().default(1),
  // Ukupno aktivno vrijeme (u sekundama) koje je korisnik proveo na ovom
  // sadržaju. Mjeri se samo dok je tab aktivan (Page Visibility API). Raste
  // i nakon završetka ako se učenik vrati na lekciju ponovo da uči.
  // Za `ilmihal`: vrijednost rastu ISKLJUČIVO server-side heartbeat-i
  // (POST /content/heartbeat) — klijent ne smije direktno povećavati ovo
  // polje preko POST /napredak, jer to je glavni cheat vector.
  timeSpentSeconds: integer("time_spent_seconds").notNull().default(0),
  // Vrijeme kad je učenik USPJEŠNO riješio mini-kviz "Provjeri znanje" za
  // ovu lekciju (sva pitanja tačno). Koristi se kao 4. uslov gate-a za
  // "Označi kao završeno" — ako lekcija ima `kvizPitanja`, completion
  // ne prolazi dok ovaj timestamp nije postavljen. Idempotentno: jednom
  // postavljen, ne mijenja se.
  quizPassedAt: timestamp("quiz_passed_at"),
  // Vrijeme posljednjeg heartbeat-a od ovog korisnika za ovaj sadržaj.
  // Server koristi razliku NOW() - lastHeartbeatAt (cap 15s) da inkrementira
  // `timeSpentSeconds`. Tako stvarno akumulirano vrijeme nikad ne može
  // premašiti realno proteklo vrijeme između prvog i posljednjeg heartbeat-a.
  lastHeartbeatAt: timestamp("last_heartbeat_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const kvizRezultatiTable = pgTable("kviz_rezultati", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  kvizId: integer("kviz_id").notNull(),
  kvizNaslov: text("kviz_naslov").notNull().default(""),
  tacniOdgovori: integer("tacni_odgovori").notNull().default(0),
  ukupnoPitanja: integer("ukupno_pitanja").notNull().default(0),
  procenat: integer("procenat").notNull().default(0),
  bodovi: integer("bodovi").notNull().default(0),
  completedAt: timestamp("completed_at").defaultNow(),
});

export const posjeteTable = pgTable("posjete", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  path: varchar("path", { length: 500 }).notNull().default("/"),
  ip: varchar("ip", { length: 100 }),
  country: varchar("country", { length: 100 }),
  city: varchar("city", { length: 200 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const prilozi = pgTable("prilozi", {
  id: serial("id").primaryKey(),
  lekcijaId: integer("lekcija_id").notNull(),
  originalName: text("original_name").notNull(),
  storedName: varchar("stored_name", { length: 300 }).notNull().default(""),
  fileSize: integer("file_size").notNull().default(0),
  mimeType: varchar("mime_type", { length: 100 }).notNull().default("application/octet-stream"),
  kind: varchar("kind", { length: 20 }).notNull().default("file"),
  externalUrl: text("external_url"),
  approved: boolean("approved").notNull().default(false),
  uploadedByRole: varchar("uploaded_by_role", { length: 20 }),
  uploadedByUserId: integer("uploaded_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const rjecnikTable = pgTable("rjecnik", {
  id: serial("id").primaryKey(),
  rijec: varchar("rijec", { length: 200 }).notNull().unique(),
  definicija: text("definicija").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Rjecnik = typeof rjecnikTable.$inferSelect;

// H5P pokušaji — server-side scoring; klijent NIKAD ne šalje konačnu vrijednost
// hasanata. Server čuva sve pokušaje (audit) i računa ih sa multiplier-om
// po broju pokušaja: 1=100%, 2=50%, 3+=0%.
export const h5pPokusajiTable = pgTable("h5p_pokusaji", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  priloziId: integer("prilozi_id").notNull(),
  attemptNo: integer("attempt_no").notNull(),
  score: integer("score").notNull().default(0),
  maxScore: integer("max_score").notNull().default(0),
  procenat: integer("procenat").notNull().default(0),
  hasanatGained: integer("hasanat_gained").notNull().default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow().notNull(),
});

export type H5pPokusaj = typeof h5pPokusajiTable.$inferSelect;

export const insertIlmihalLekcijaSchema = createInsertSchema(ilmihalLekcijeTable).omit({ id: true, createdAt: true });
export const insertKvizSchema = createInsertSchema(kvizoviTable).omit({ id: true, createdAt: true });
export const insertPitanjeBankaSchema = createInsertSchema(pitanjaBankaTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertKvizPitanjeSchema = createInsertSchema(kvizPitanjaTable).omit({ id: true, createdAt: true });
export const insertKnjigaSchema = createInsertSchema(knjige).omit({ id: true, createdAt: true });
export const insertKorisnikNapredakSchema = createInsertSchema(korisnikNapredakTable).omit({ id: true, createdAt: true, updatedAt: true });

export type IlmihalLekcija = typeof ilmihalLekcijeTable.$inferSelect;
export type Kviz = typeof kvizoviTable.$inferSelect;
export type Knjiga = typeof knjige.$inferSelect;
export type KorisnikNapredak = typeof korisnikNapredakTable.$inferSelect;
export type KvizRezultat = typeof kvizRezultatiTable.$inferSelect;
export type Posjeta = typeof posjeteTable.$inferSelect;
