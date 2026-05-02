import { pgTable, serial, text, integer, boolean, timestamp, varchar, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// === POGREŠNI ODGOVORI (Popravi saće) ============================================
// Bilježi pojedinačne pogrešne odgovore iz kvizova (i kasnije H5P-a) da bi
// učenik mogao posebno vježbati ono što nije znao. Kombinacija
// (userId, sourceType, sourceId, questionIndex) je UNIQUE — ako dijete
// pogriješi isto pitanje više puta, samo se ažurira `lastWrongIndex` i
// inkrementira `attempts`. Polje `resolvedAt` postaje !NULL kad učenik
// tačno odgovori unutar Popravi saće tool-a.
export const pogresniOdgovoriTable = pgTable("pogresni_odgovori", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  sourceType: varchar("source_type", { length: 20 }).notNull(), // 'kviz' | 'h5p' | 'ilmihal'
  sourceId: integer("source_id").notNull(),
  sourceNaslov: text("source_naslov").notNull().default(""),
  questionIndex: integer("question_index").notNull(),
  questionText: text("question_text").notNull(),
  options: jsonb("options").notNull().$type<string[]>(),
  correctIndex: integer("correct_index").notNull(),
  lastWrongIndex: integer("last_wrong_index").notNull(),
  attempts: integer("attempts").notNull().default(1),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  userQuestionUnique: uniqueIndex("pogresni_odgovori_user_question_unique_idx")
    .on(t.userId, t.sourceType, t.sourceId, t.questionIndex),
  userOpenIdx: index("pogresni_odgovori_user_open_idx").on(t.userId, t.resolvedAt),
}));

export type PogresniOdgovor = typeof pogresniOdgovoriTable.$inferSelect;

// === MISIJE ====================================================================
// Definicija misije (dnevna ili sedmična). Evaluator čita postojeće podatke
// (lekcije, kvizovi, H5P, popravi-saće) i računa progress on-the-fly za
// trenutni period. Period je dan ili ISO sedmica. Cilj je broj koji se mora
// dostići (npr. 1 lekcija, 3 popravljene greške, 80% na 2 kviza).
export const misijaDefinicijaTable = pgTable("misija_definicija", {
  id: serial("id").primaryKey(),
  kod: varchar("kod", { length: 60 }).notNull().unique(), // stabilan ID za seed (npr. "daily_lesson_1")
  naziv: text("naziv").notNull(),
  opis: text("opis").notNull().default(""),
  tip: varchar("tip", { length: 20 }).notNull(), // 'dnevna' | 'sedmicna'
  uvjetTip: varchar("uvjet_tip", { length: 40 }).notNull(),
  // Mogući uvjetTip:
  //   'complete_lesson_count'  — cilj = broj završenih ilmihal lekcija u periodu
  //   'quiz_high_score_count'  — cilj = broj kvizova sa procenat >= uvjetParam.minProcenat
  //   'fix_mistake_count'      — cilj = broj riješenih grešaka u Popravi saću
  //   'h5p_attempt_count'      — cilj = broj H5P pokušaja
  uvjetParam: jsonb("uvjet_param").$type<Record<string, unknown>>().default({}),
  cilj: integer("cilj").notNull().default(1),
  nagradaAferim: integer("nagrada_aferim").notNull().default(0),
  nagradaMed: integer("nagrada_med").notNull().default(0),
  ikona: varchar("ikona", { length: 30 }).notNull().default("🎯"),
  aktivna: boolean("aktivna").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type MisijaDefinicija = typeof misijaDefinicijaTable.$inferSelect;

// Per-user, per-period progress. periodKey:
//   - dnevna  → 'YYYY-MM-DD' (UTC)
//   - sedmicna → 'YYYY-Www' (ISO week, npr. '2026-W18')
// `trenutno` se ažurira pri svakom claim pozivu i pri evaluaciji (cache).
// `completedAt` se postavlja kad trenutno >= cilj. `claimedAt` kad učenik
// klikne dugme "Preuzmi nagradu".
export const misijaProgressTable = pgTable("misija_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  misijaId: integer("misija_id").notNull(),
  periodKey: varchar("period_key", { length: 20 }).notNull(),
  trenutno: integer("trenutno").notNull().default(0),
  completedAt: timestamp("completed_at"),
  claimedAt: timestamp("claimed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  userMisijaPeriodUnique: uniqueIndex("misija_progress_user_misija_period_unique_idx")
    .on(t.userId, t.misijaId, t.periodKey),
  userPeriodIdx: index("misija_progress_user_period_idx").on(t.userId, t.periodKey),
}));

export type MisijaProgress = typeof misijaProgressTable.$inferSelect;

export const insertPogresniOdgovorSchema = createInsertSchema(pogresniOdgovoriTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMisijaDefinicijaSchema = createInsertSchema(misijaDefinicijaTable).omit({ id: true, createdAt: true });
export const insertMisijaProgressSchema = createInsertSchema(misijaProgressTable).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertPogresniOdgovor = z.infer<typeof insertPogresniOdgovorSchema>;
export type InsertMisijaDefinicija = z.infer<typeof insertMisijaDefinicijaSchema>;
export type InsertMisijaProgress = z.infer<typeof insertMisijaProgressSchema>;
