import { pgTable, serial, text, integer, boolean, timestamp, varchar, jsonb } from "drizzle-orm/pg-core";
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
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Muallim profile (extends users where role='muallim')
export const muallimProfiliTable = pgTable("muallim_profili", {
  userId: integer("user_id").notNull().unique(),
  mektebId: integer("mekteb_id"),
  licenceCount: integer("licence_count").notNull().default(30),
  licencesUsed: integer("licences_used").notNull().default(0),
  tekucaSkolskaGodina: varchar("tekuca_skolska_godina", { length: 20 }).default("2024/2025"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Class groups (razredi)
export const grupeTable = pgTable("grupe", {
  id: serial("id").primaryKey(),
  muallimId: integer("muallim_id").notNull(),
  naziv: varchar("naziv", { length: 100 }).notNull(),
  skolskaGodina: varchar("skolska_godina", { length: 20 }).notNull(),
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
});

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

export const insertMektebSchema = createInsertSchema(mektebiTable).omit({ id: true, createdAt: true });
export const insertGrupaSchema = createInsertSchema(grupeTable).omit({ id: true, createdAt: true });
export const insertUcenikProfilSchema = createInsertSchema(ucenikProfiliTable).omit({ createdAt: true, archivedAt: true });

export type Mekteb = typeof mektebiTable.$inferSelect;
export type Grupa = typeof grupeTable.$inferSelect;
export type UcenikProfil = typeof ucenikProfiliTable.$inferSelect;
export type RoditeljUcenik = typeof roditeljUcenikTable.$inferSelect;
