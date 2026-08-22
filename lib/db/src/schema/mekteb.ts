import { pgTable, serial, text, integer, boolean, timestamp, varchar, date, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Mekteb (school/institution)
export const mektebiTable = pgTable("mektebi", {
  id: serial("id").primaryKey(),
  naziv: text("naziv").notNull(),
  grad: varchar("grad", { length: 100 }),
  adresa: text("adresa"),
  kontaktEmail: varchar("kontakt_email", { length: 255 }),
  kontaktTel: varchar("kontakt_tel", { length: 50 }),
  // userId glavnog (admin) muallima — onaj ko je registrovao mekteb.
  glavniMuallimId: integer("glavni_muallim_id"),
  // Koliko muallimskih naloga je dozvoljeno (uključujući glavnog).
  dozvoljenoMuallima: integer("dozvoljeno_muallima").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Muallim profile (extends users where role='muallim')
export const muallimProfiliTable = pgTable("muallim_profili", {
  userId: integer("user_id").notNull().unique(),
  mektebId: integer("mekteb_id"),
  // Glavni (admin) muallim mekteba — jedini kreira/briše ostale muallime i
  // vidi zbirnu statistiku cijelog mekteba. Obični muallim vidi samo svoje grupe.
  isGlavni: boolean("is_glavni").notNull().default(false),
  licenceCount: integer("licence_count").notNull().default(30),
  licencesUsed: integer("licences_used").notNull().default(0),
  tekucaSkolskaGodina: varchar("tekuca_skolska_godina", { length: 30 }).default("Mektebska 2025/26"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Class groups (razredi)
export const grupeTable = pgTable("grupe", {
  id: serial("id").primaryKey(),
  muallimId: integer("muallim_id").notNull(),
  naziv: varchar("naziv", { length: 100 }).notNull(),
  skolskaGodina: varchar("skolska_godina", { length: 20 }).notNull(),
  // Datumi početka i kraja mektebske godine za ovu grupu. Služe za prikaz i
  // kao trigger za "kraj godine" (izvještaj/izvoz). Nullable za stare grupe.
  datumPocetka: date("datum_pocetka"),
  datumKraja: date("datum_kraja"),
  daniNastave: jsonb("dani_nastave").$type<string[]>().default([]),
  vrijemeNastave: varchar("vrijeme_nastave", { length: 20 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Student profile (extends users where role='ucenik')
export const ucenikProfiliTable = pgTable("ucenik_profili", {
  userId: integer("user_id").notNull().unique(),
  muallimId: integer("muallim_id"),
  grupaId: integer("grupa_id"),
  mektebId: integer("mekteb_id"),
  isArchived: boolean("is_archived").notNull().default(false),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Parent profile
export const roditeljProfiliTable = pgTable("roditelj_profili", {
  userId: integer("user_id").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Parent-child relationship
export const roditeljUcenikTable = pgTable("roditelj_ucenik", {
  id: serial("id").primaryKey(),
  roditeljId: integer("roditelj_id").notNull(),
  ucenikId: integer("ucenik_id").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  requestedAt: timestamp("requested_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
  approvedBy: integer("approved_by"),
}, (t) => ({
  uniqRoditeljUcenik: uniqueIndex("roditelj_ucenik_unique_idx").on(t.roditeljId, t.ucenikId),
}));

// Subscriptions / licences
export const pretplateTable = pgTable("pretplate", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  planType: varchar("plan_type", { length: 50 }).notNull(),
  stripeSessionId: varchar("stripe_session_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  iznos: integer("iznos"),
  valuta: varchar("valuta", { length: 10 }).default("EUR"),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  licencesPurchased: integer("licences_purchased").default(0),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const obavjestenjaTable = pgTable("obavjestenja", {
  id: serial("id").primaryKey(),
  muallimId: integer("muallim_id").notNull(),
  grupaId: integer("grupa_id"),
  naslov: varchar("naslov", { length: 200 }).notNull(),
  sadrzaj: text("sadrzaj").notNull(),
  slikaUrl: text("slika_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  muallimIdx: index("obavjestenja_muallim_idx").on(t.muallimId),
  grupaIdx: index("obavjestenja_grupa_idx").on(t.grupaId),
  createdIdx: index("obavjestenja_created_idx").on(t.createdAt),
}));

// Per-grupa raspored lekcija — muallim slaže vlastiti redoslijed lekcija za
// svoju grupu. Ako grupa NEMA redove za neki nivo, koristi se globalni
// `ilmihal_lekcije.redoslijed` (default). Ako ima, server preslaže lekcije po
// `pozicija` (1-based, kontiguirano). Medaljon-lekcije (slug `medaljon-nivo%`)
// se NE uključuju — one ostaju checkpointi na svojim ordinalnim pozicijama.
export const grupaRasporedTable = pgTable("grupa_raspored", {
  id: serial("id").primaryKey(),
  grupaId: integer("grupa_id").notNull(),
  nivo: integer("nivo").notNull(),
  lekcijaId: integer("lekcija_id").notNull(),
  pozicija: integer("pozicija").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  uniqGrupaLekcija: uniqueIndex("grupa_raspored_grupa_lekcija_unique_idx").on(t.grupaId, t.lekcijaId),
  grupaNivoIdx: index("grupa_raspored_grupa_nivo_idx").on(t.grupaId, t.nivo, t.pozicija),
}));

// Mekteb-specific NAPAMET catalogue. The item id is deliberately stable so
// grades remain attached when a teacher changes its title or position.
export const napametProgramTable = pgTable("napamet_program", {
  id: serial("id").primaryKey(),
  mektebId: integer("mekteb_id").notNull(),
  stavkaId: varchar("stavka_id", { length: 80 }).notNull(),
  nivo: integer("nivo").notNull(),
  naziv: varchar("naziv", { length: 200 }).notNull(),
  redoslijed: integer("redoslijed").notNull(),
  isVisible: boolean("is_visible").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  mektebStavkaIdx: uniqueIndex("napamet_program_mekteb_stavka_unique_idx").on(t.mektebId, t.stavkaId),
  mektebOrderIdx: index("napamet_program_mekteb_order_idx").on(t.mektebId, t.nivo, t.redoslijed),
}));

// Globalni NAPAMET katalog uređuje administrator platforme. `stavkaId` je
// namjerno stabilan — ocjene ga čuvaju kao historijski identitet stavke.
export const napametGlobalProgramTable = pgTable("napamet_global_program", {
  id: serial("id").primaryKey(),
  stavkaId: varchar("stavka_id", { length: 80 }).notNull(),
  nivo: integer("nivo").notNull(),
  naziv: varchar("naziv", { length: 200 }).notNull(),
  redoslijed: integer("redoslijed").notNull(),
  sourceLessonSlug: varchar("source_lesson_slug", { length: 100 }),
  isVisible: boolean("is_visible").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  stavkaIdx: uniqueIndex("napamet_global_program_stavka_unique_idx").on(t.stavkaId),
  orderIdx: index("napamet_global_program_order_idx").on(t.nivo, t.redoslijed),
}));

// Lokalna stavka je privatna za muallima koji ju je dodao i njegovu grupu.
// Time ručni dodatak ne ulazi u katalog drugih muallima.
export const napametMuallimProgramTable = pgTable("napamet_muallim_program", {
  id: serial("id").primaryKey(),
  stavkaId: varchar("stavka_id", { length: 80 }).notNull(),
  muallimId: integer("muallim_id").notNull(),
  grupaId: integer("grupa_id").notNull(),
  nivo: integer("nivo").notNull(),
  naziv: varchar("naziv", { length: 200 }).notNull(),
  redoslijed: integer("redoslijed").notNull(),
  isVisible: boolean("is_visible").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => ({
  stavkaIdx: uniqueIndex("napamet_muallim_program_stavka_unique_idx").on(t.stavkaId),
  ownerOrderIdx: index("napamet_muallim_program_owner_order_idx").on(t.muallimId, t.grupaId, t.nivo, t.redoslijed),
  grupaOrderIdx: index("napamet_muallim_program_grupa_order_idx").on(t.grupaId, t.nivo, t.redoslijed),
}));

// Mekteb-nivo dokumenti (PDF): pravila, kućni red i sl. Uploaduje ih glavni
// muallim; vidljivi su svim učenicima i roditeljima tog mekteba.
export const mektebDokumentiTable = pgTable("mekteb_dokumenti", {
  id: serial("id").primaryKey(),
  mektebId: integer("mekteb_id").notNull(),
  naziv: varchar("naziv", { length: 200 }).notNull(),
  opis: text("opis"),
  originalName: text("original_name").notNull(),
  storedName: varchar("stored_name", { length: 300 }).notNull(),
  fileSize: integer("file_size").notNull().default(0),
  mimeType: varchar("mime_type", { length: 100 }).notNull().default("application/pdf"),
  uploadedByUserId: integer("uploaded_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  mektebIdx: index("mekteb_dokumenti_mekteb_idx").on(t.mektebId),
}));

export type MektebDokument = typeof mektebDokumentiTable.$inferSelect;

export type GrupaRaspored = typeof grupaRasporedTable.$inferSelect;
export type InsertGrupaRaspored = typeof grupaRasporedTable.$inferInsert;

export const insertMektebSchema = createInsertSchema(mektebiTable).omit({ id: true, createdAt: true });
export const insertGrupaSchema = createInsertSchema(grupeTable).omit({ id: true, createdAt: true });
export const insertUcenikProfilSchema = createInsertSchema(ucenikProfiliTable).omit({ createdAt: true, archivedAt: true });

export type Mekteb = typeof mektebiTable.$inferSelect;
export type Grupa = typeof grupeTable.$inferSelect;
export type UcenikProfil = typeof ucenikProfiliTable.$inferSelect;
export type RoditeljUcenik = typeof roditeljUcenikTable.$inferSelect;
export type Obavjestenje = typeof obavjestenjaTable.$inferSelect;
