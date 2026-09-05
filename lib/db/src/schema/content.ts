import { pgTable, serial, text, integer, boolean, timestamp, varchar, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Centralna banka pitanja — kategorije su usklađene sa predmetima lekcija i
// NPP 2018. Postoji 6 glavnih kategorija (predmeta)
// i prateći tagovi za pod-teme. Tagovi se koriste za filtriranje unutar
// glavne kategorije; ne vide ih polaznici, već admin prilikom kreiranja sadržaja.
export const KVIZ_KATEGORIJE = [
  "kiraet",
  "akaid",
  "ibadet",
  "ahlak",
  "historija",
  "bosna",
] as const;
export type KvizKategorija = (typeof KVIZ_KATEGORIJE)[number];

export const KVIZ_KATEGORIJE_META: Record<KvizKategorija, { naziv: string; ikona: string }> = {
  kiraet: { naziv: "Kiraet", ikona: "📖" },
  akaid: { naziv: "Vjerovanje", ikona: "⭐" },
  ibadet: { naziv: "Ibadet", ikona: "🕌" },
  ahlak: { naziv: "Ahlak", ikona: "💝" },
  historija: { naziv: "Historija islama", ikona: "📜" },
  bosna: { naziv: "Ostali sadržaji", ikona: "🇧🇦" },
};

// Tagovi — pod-teme unutar glavne kategorije. Svaki tag pripada tačno jednoj
// glavnoj kategoriji. Admin koristi tagove za filtriranje u banci pitanja.
export const KVIZ_TAGOVI = [
  // Kiraet (2)
  "sure", "kuran_tekst",
  // Akaid (6)
  "allah", "meleki", "knjige", "poslanici", "ahiret", "kuran",
  // Ibadet (8)
  "namaz", "abdest", "post", "zekat", "hadz", "dove", "zikrovi", "halal_haram", "ostali_ibadeti",
  // Ahlak (6)
  "ponasanje", "obici", "ljubaznost", "postenje", "srdacnost", "pomaganje",
  // Historija (5)
  "zivot_poslanika", "ashabi", "islamska_civilizacija", "osvajanja", "kalifi",
  // Bosna (5)
  "nas_ucenjaci", "dzamije", "tradicije", "ilahije", "dijaspora", "ostalo",
] as const;
export type KvizTag = (typeof KVIZ_TAGOVI)[number];

export const KVIZ_TAG_KATEGORIJA_MAP: Record<KvizTag, KvizKategorija> = {
  sure: "kiraet", kuran_tekst: "kiraet",
  allah: "akaid", meleki: "akaid", knjige: "akaid", poslanici: "akaid",
  ahiret: "akaid", kuran: "akaid",
  namaz: "ibadet", abdest: "ibadet", post: "ibadet", zekat: "ibadet",
  hadz: "ibadet", dove: "ibadet", zikrovi: "ibadet", halal_haram: "ibadet",
  ostali_ibadeti: "ibadet",
  ponasanje: "ahlak", obici: "ahlak", ljubaznost: "ahlak", postenje: "ahlak",
  srdacnost: "ahlak", pomaganje: "ahlak",
  zivot_poslanika: "historija", ashabi: "historija", islamska_civilizacija: "historija",
  osvajanja: "historija", kalifi: "historija",
  nas_ucenjaci: "bosna", dzamije: "bosna", tradicije: "bosna", ilahije: "bosna",
  dijaspora: "bosna", ostalo: "bosna",
};

// Čitljivi nazivi tagova — koriste se za seed `kviz_tagovi` tabele i kao
// fallback labela u UI-ju. DB tabela je nakon seeda izvor istine (admin može
// dodavati/brisati/preimenovati tagove).
export const KVIZ_TAGOVI_META: Record<KvizTag, string> = {
  allah: "Allah", meleki: "Meleki", knjige: "Knjige", poslanici: "Poslanici",
  ahiret: "Ahiret", kuran: "Kuran kao objava", sure: "Sure",
  kuran_tekst: "Kuran i ajeti",
  namaz: "Namaz", abdest: "Abdest", post: "Post", zekat: "Zekat", hadz: "Hadž",
  dove: "Dove", zikrovi: "Zikrovi", halal_haram: "Halal/Haram",
  ostali_ibadeti: "Ostali ibadeti",
  ponasanje: "Ponašanje", obici: "Običaji", ljubaznost: "Ljubaznost",
  postenje: "Poštenje", srdacnost: "Srdačnost", pomaganje: "Pomaganje",
  zivot_poslanika: "Život poslanika", ashabi: "Ashabi",
  islamska_civilizacija: "Isl. civilizacija", osvajanja: "Osvajanja", kalifi: "Kalifi",
  nas_ucenjaci: "Naši učenjaci", dzamije: "Džamije", tradicije: "Tradicije",
  ilahije: "Ilahije", dijaspora: "Dijaspora", ostalo: "Ostalo",
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

export const DIDAKTICKI_TIPOVI = ["prisjecanje", "razlikovanje", "primjena", "redoslijed"] as const;
export type DidaktickiTip = (typeof DIDAKTICKI_TIPOVI)[number];

// Tip-specifični meta podaci za interaktivna pitanja i pedagoški podaci koji
// vrijede za sve vrste pitanja. Standardna pitanja mogu imati `meta` samo zbog
// didaktičkog tipa, objašnjenog ponovnog pokušaja i veze sa izvornim pitanjem.
export interface PitanjeMeta {
  template?: string[];   // dragDrop
  words?: string[];      // dragDrop + markWords
  correct?: string[];    // dragDrop
  text?: string;         // markWords
  incorrect?: string[];  // markWords
  didaktickiTip?: DidaktickiTip;
  retryMode?: "immediate";
  retryPrompt?: string;
  sourceQuestion?: string;
  pilotKey?: string;
}

export const UREDNICKI_STATUSI = ["na_cekanju", "odobreno", "vraceno_na_doradu"] as const;
export type UrednickiStatus = (typeof UREDNICKI_STATUSI)[number];

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
  // Ko smije vidjeti lekciju: "svi" ili "muallimi" (admin uvijek ima pristup).
  dostupnost: varchar("dostupnost", { length: 20 }).notNull().default("svi"),
  // Predmet (Akaid, Ahlak, Ibadat, ...) — koristi se za filter na "Sve lekcije".
  // Inicijalno backfill-ovano iz priprema HTML-a (regex extract iz meta bloka),
  // dalje admin može direktno mijenjati. NULL za lekcije bez priprema/predmeta.
  predmet: varchar("predmet", { length: 60 }),
  kvizPitanja: jsonb("kviz_pitanja").$type<LekcijaKvizPitanje[]>(),
  locked: boolean("locked").notNull().default(false),
  lockedAt: timestamp("locked_at"),
  lockedNote: text("locked_note"),
  // Preduvjeti lekcije: lista ID-jeva lekcija koje student mora završiti
  // prije nego što mu se ova lekcija otključa. Maksimalno 6 preduvjeta.
  // Prazna lista ([]) = lekcija uvijek otključana (bez preduvjeta).
  uvjetiIds: jsonb("uvjeti_ids").$type<number[]>().default([]),
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
  seedKey: varchar("seed_key", { length: 160 }),
  nivo: integer("nivo"),
  // Etapa unutar nivoa: 1 = lekcije 1–10, 2 = 11–20, i tako dalje do
  // posljednjeg bloka nivoa. Nivoi 1 i 2 imaju sedam etapa, a Nivo 3 deset
  // (100 lekcija).
  // NULL znači da kviz nije vezan za etapu. U UI-ju se prikazuje kao
  // "{etapa}-{nivo}", npr. 1-1 za prvu etapu Nivoa 1.
  etapa: integer("etapa"),
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
  // Tagovi — pod-teme unutar glavne kategorije (npr. "namaz" unutar "ibadet").
  // JSON niz stringova. Prazan niz = nema tagova. Validira se na backendu.
  tagovi: jsonb("tagovi").$type<string[]>().notNull().default([]),
  lekcijaId: integer("lekcija_id"),
  opis: text("opis").notNull().default(""),
  // Koliko nasumičnih pitanja se generira po sesiji kad učenik pokrene kviz.
  // Ako je `null`, klijent koristi default (20). Postavlja se per-kviz npr. za
  // tematske kvizove sa velikim banaka pitanja (100+) gdje želimo 30 po sesiji.
  pitanjaPoSesiji: integer("pitanja_po_sesiji"),
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  seedKeyUnique: uniqueIndex("kvizovi_seed_key_unique_idx").on(t.seedKey),
}));

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
  // Tagovi — pod-teme unutar glavne kategorije (npr. "namaz" unutar "ibadet").
  // JSON niz stringova. Admin koristi za filtriranje u banci pitanja.
  tagovi: jsonb("tagovi").$type<string[]>().notNull().default([]),
  // Veza za konkretnu Ilmihal lekciju (opciono). Kasnije se može koristiti
  // za "predloži pitanje za ovu lekciju" UX.
  lekcijaId: integer("lekcija_id"),
  // Stabilan vlasnički ključ za seed sadržaj. NULL za admin-kreirana pitanja.
  // Seed koristi samo ovaj ključ i nakon prvog kreiranja ne prepisuje sadržaj.
  seedKey: varchar("seed_key", { length: 160 }),
  // Pitanja koja su nastala iz Ilmihal lekcije moraju proći stručni pregled
  // prije nego što se mogu prikazati učenicima kroz learning kviz.
  urednickiStatus: varchar("urednicki_status", { length: 24 })
    .$type<UrednickiStatus>()
    .notNull()
    .default("odobreno"),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  reviewNote: text("review_note"),
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
  seedKeyUnique: uniqueIndex("pitanja_banka_seed_key_unique_idx").on(t.seedKey),
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

// Tagovi (pod-teme) — admin-definisani, vezani za glavnu kategoriju preko
// `kategorija` slug-a (string match, no FK). `slug` se referencira iz
// `pitanja_banka.tagovi` (jsonb array). Inicijalni seed iz KVIZ_TAGOVI /
// KVIZ_TAG_KATEGORIJA_MAP / KVIZ_TAGOVI_META se ubacuje pri prvom startu
// (vidi runResidualSchema u api-server/src/index.ts). Nakon seeda admin može
// dodavati/brisati/preimenovati tagove kroz admin panel.
export const kvizTagoviTable = pgTable("kviz_tagovi", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 60 }).notNull().unique(),
  naziv: varchar("naziv", { length: 120 }).notNull(),
  kategorija: varchar("kategorija", { length: 60 }).notNull(),
  redoslijed: integer("redoslijed").notNull().default(100),
  createdAt: timestamp("created_at").defaultNow(),
});

export type KvizTagRow = typeof kvizTagoviTable.$inferSelect;
export type InsertKvizTagRow = typeof kvizTagoviTable.$inferInsert;

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
  hasanatReward: integer("hasanat_reward").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Audit + anti-double-claim za embed vježbe. Unique (student_id, prilozi_id)
// se osigurava migracijom u index.ts (CREATE UNIQUE INDEX IF NOT EXISTS).
export const embedCompletionsTable = pgTable("embed_completions", {
  id: serial("id").primaryKey(),
  studentId: varchar("student_id", { length: 120 }).notNull(),
  priloziId: integer("prilozi_id").notNull(),
  hasanatGained: integer("hasanat_gained").notNull().default(0),
  completedAt: timestamp("completed_at").defaultNow(),
});

// Ocjene sadržaja (5 pčelica) — jedna ocjena po korisniku po (tip, id).
// Bez FK zbog mixed tipova sadržaja (lekcija/prilog/kviz) — guard radimo
// unique indexom (vidi index.ts migration) i app logikom.
export const ocjeneSadrzajaTable = pgTable("ocjene_sadrzaja", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  tipSadrzaja: varchar("tip_sadrzaja", { length: 32 }).notNull(),
  sadrzajId: integer("sadrzaj_id").notNull(),
  ocjena: integer("ocjena").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const rjecnikTable = pgTable("rjecnik", {
  id: serial("id").primaryKey(),
  rijec: varchar("rijec", { length: 200 }).notNull().unique(),
  definicija: text("definicija").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Rjecnik = typeof rjecnikTable.$inferSelect;

// H5P pokušaji — server-side scoring; klijent NIKAD ne šalje konačnu vrijednost
// hasanata. Server čuva sve pokušaje (audit): prvi donosi do 5 kapi meda,
// drugi do 3, a treći i naredni ne donose nagradu.
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
