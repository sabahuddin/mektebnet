import { pgTable, serial, text, integer, boolean, timestamp, varchar, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

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
  kvizPitanja: jsonb("kviz_pitanja").$type<LekcijaKvizPitanje[]>(),
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
  pitanja: jsonb("pitanja").$type<QuizQuestion[]>().notNull().default([]),
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Books / Čitaonica (stories about prophets etc.)
export const knjige = pgTable("knjige", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  naslov: text("naslov").notNull(),
  kategorija: varchar("kategorija", { length: 50 }).notNull().default("prica"),
  contentHtml: text("content_html").notNull().default(""),
  coverImage: varchar("cover_image", { length: 500 }),
  redoslijed: integer("redoslijed").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// User content progress (across all modules)
export const korisnikNapredakTable = pgTable("korisnik_napredak", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  contentType: varchar("content_type", { length: 30 }).notNull(),
  contentId: integer("content_id").notNull(),
  zavrsen: boolean("zavrsen").notNull().default(false),
  bodovi: integer("bodovi").notNull().default(0),
  pokusaji: integer("pokusaji").notNull().default(1),
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

export const insertIlmihalLekcijaSchema = createInsertSchema(ilmihalLekcijeTable).omit({ id: true, createdAt: true });
export const insertKvizSchema = createInsertSchema(kvizoviTable).omit({ id: true, createdAt: true });
export const insertKnjigaSchema = createInsertSchema(knjige).omit({ id: true, createdAt: true });
export const insertKorisnikNapredakSchema = createInsertSchema(korisnikNapredakTable).omit({ id: true, createdAt: true, updatedAt: true });

export type IlmihalLekcija = typeof ilmihalLekcijeTable.$inferSelect;
export type Kviz = typeof kvizoviTable.$inferSelect;
export type Knjiga = typeof knjige.$inferSelect;
export type KorisnikNapredak = typeof korisnikNapredakTable.$inferSelect;
export type KvizRezultat = typeof kvizRezultatiTable.$inferSelect;
export type Posjeta = typeof posjeteTable.$inferSelect;
