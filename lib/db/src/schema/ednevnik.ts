import { pgTable, serial, text, integer, timestamp, varchar, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Attendance / Prisustvo
export const priustvoTable = pgTable("prisustvo", {
  id: serial("id").primaryKey(),
  ucenikId: integer("ucenik_id").notNull(),
  grupaId: integer("grupa_id").notNull(),
  muallimId: integer("muallim_id").notNull(),
  datum: varchar("datum", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("prisutan"),
  napomena: text("napomena"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Grades / Ocjene
export const ocjeneTable = pgTable("ocjene", {
  id: serial("id").primaryKey(),
  ucenikId: integer("ucenik_id").notNull(),
  muallimId: integer("muallim_id").notNull(),
  grupaId: integer("grupa_id"),
  kategorija: varchar("kategorija", { length: 50 }).notNull(),
  ocjena: integer("ocjena").notNull(),
  lekcijaNaziv: varchar("lekcija_naziv", { length: 200 }),
  napomena: text("napomena"),
  datum: varchar("datum", { length: 20 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Mekteb Calendar — days when classes happen, holidays, important dates
export const mektebKalendarTable = pgTable("mekteb_kalendar", {
  id: serial("id").primaryKey(),
  grupaId: integer("grupa_id").notNull(),
  muallimId: integer("muallim_id").notNull(),
  datum: varchar("datum", { length: 20 }).notNull(),
  tip: varchar("tip", { length: 20 }).notNull().default("mekteb"),
  opis: text("opis"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Lesson Plan — lessons assigned to a specific date for a group
export const planLekcijaTable = pgTable("plan_lekcija", {
  id: serial("id").primaryKey(),
  grupaId: integer("grupa_id").notNull(),
  muallimId: integer("muallim_id").notNull(),
  datum: varchar("datum", { length: 20 }).notNull(),
  lekcijaNaslov: varchar("lekcija_naslov", { length: 300 }).notNull(),
  lekcijaTip: varchar("lekcija_tip", { length: 50 }).notNull().default("ilmihal"),
  redoslijed: integer("redoslijed").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Messages / Poruke (muallim <-> roditelj)
export const porukeTable = pgTable("poruke", {
  id: serial("id").primaryKey(),
  posiljateljId: integer("posiljatelj_id").notNull(),
  primateljId: integer("primatelj_id").notNull(),
  naslov: varchar("naslov", { length: 200 }).notNull(),
  sadrzaj: text("sadrzaj").notNull(),
  procitanoAt: timestamp("procitano_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Homework / Zadaće
export const zadaceTable = pgTable("zadace", {
  id: serial("id").primaryKey(),
  grupaId: integer("grupa_id").notNull(),
  muallimId: integer("muallim_id").notNull(),
  naslov: varchar("naslov", { length: 300 }).notNull(),
  opis: text("opis"),
  rokDo: varchar("rok_do", { length: 20 }),
  lekcijaNaslov: varchar("lekcija_naslov", { length: 300 }),
  lekcijaTip: varchar("lekcija_tip", { length: 50 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Certificates / Certifikati
export const certifikatiTable = pgTable("certifikati", {
  id: serial("id").primaryKey(),
  ucenikId: integer("ucenik_id").notNull(),
  modul: varchar("modul", { length: 100 }).notNull(),
  naslov: text("naslov").notNull(),
  issuedById: integer("issued_by_id"),
  issuedAt: timestamp("issued_at").defaultNow(),
});

export const insertPriustvoSchema = createInsertSchema(priustvoTable).omit({ id: true, createdAt: true });
export const insertOcjenaSchema = createInsertSchema(ocjeneTable).omit({ id: true, createdAt: true });
export const insertPorukaSchema = createInsertSchema(porukeTable).omit({ id: true, createdAt: true, procitanoAt: true });
export const insertKalendarSchema = createInsertSchema(mektebKalendarTable).omit({ id: true, createdAt: true });
export const insertPlanLekcijaSchema = createInsertSchema(planLekcijaTable).omit({ id: true, createdAt: true });
export const insertZadacaSchema = createInsertSchema(zadaceTable).omit({ id: true, createdAt: true });

export type Prisustvo = typeof priustvoTable.$inferSelect;
export type Ocjena = typeof ocjeneTable.$inferSelect;
export type Poruka = typeof porukeTable.$inferSelect;
export type Certifikat = typeof certifikatiTable.$inferSelect;
export type MektebKalendar = typeof mektebKalendarTable.$inferSelect;
export type PlanLekcija = typeof planLekcijaTable.$inferSelect;
export type Zadaca = typeof zadaceTable.$inferSelect;
