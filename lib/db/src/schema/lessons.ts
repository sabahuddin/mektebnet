import { pgTable, serial, text, integer, boolean, jsonb, timestamp, varchar, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const lessonsTable = pgTable("lessons", {
  id: serial("id").primaryKey(),
  orderNum: integer("order_num").notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  title: text("title").notNull(),
  lessonType: varchar("lesson_type", { length: 30 }).notNull(),
  letters: jsonb("letters").notNull().$type<string[]>(),
  durationMin: integer("duration_min").notNull().default(20),
  storyData: jsonb("story_data").$type<object>(),
  letterData: jsonb("letter_data").$type<object[]>(),
  exerciseTypes: jsonb("exercise_types").notNull().$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLessonSchema = createInsertSchema(lessonsTable).omit({ id: true, createdAt: true });
export type InsertLesson = z.infer<typeof insertLessonSchema>;
export type Lesson = typeof lessonsTable.$inferSelect;

export const studentProgressTable = pgTable("student_progress", {
  id: serial("id").primaryKey(),
  studentId: varchar("student_id", { length: 100 }).notNull().unique(),
  totalHasanat: integer("total_hasanat").notNull().default(0),
  // Razdvajanje od Aferim ekonomije (T#NN ChatGPT preporuka): "med" se zarađuje
  // ISKLJUČIVO igranjem igrica (server-side scoring u games.ts /end), dok
  // Aferimi ostaju nagrada za stvarno učenje (lekcije, kvizovi, H5P, Popravi
  // saće). Ova razdvojenost sprječava da djeca "love bodove" igricama.
  totalMed: integer("total_med").notNull().default(0),
  completedLessons: jsonb("completed_lessons").notNull().$type<number[]>().default([]),
  badges: jsonb("badges").notNull().$type<object[]>().default([]),
  streakDays: integer("streak_days").notNull().default(0),
  lastActivityDate: varchar("last_activity_date", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertStudentProgressSchema = createInsertSchema(studentProgressTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStudentProgress = z.infer<typeof insertStudentProgressSchema>;
export type StudentProgress = typeof studentProgressTable.$inferSelect;

export const exerciseSessionsTable = pgTable("exercise_sessions", {
  id: serial("id").primaryKey(),
  studentId: varchar("student_id", { length: 100 }).notNull(),
  lessonId: integer("lesson_id").notNull(),
  exerciseType: varchar("exercise_type", { length: 50 }).notNull(),
  correctAnswers: integer("correct_answers").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  timeSpentSeconds: integer("time_spent_seconds").notNull(),
  hasanatEarned: integer("hasanat_earned").notNull().default(0),
  completedAt: timestamp("completed_at").defaultNow(),
});

export const insertExerciseSessionSchema = createInsertSchema(exerciseSessionsTable).omit({ id: true, completedAt: true });
export type InsertExerciseSession = z.infer<typeof insertExerciseSessionSchema>;
export type ExerciseSession = typeof exerciseSessionsTable.$inferSelect;

// === MEDALJONI (Nivo 1 mapa - bedževi/checkpointi) ============================
// Medaljon je posebno polje na mapi (između grupa lekcija). 5 fiksnih medaljona:
//   1. Prvi koraci   — poslije 5. lekcije
//   2. Putnik        — poslije 10. lekcije
//   3. Polovina puta — poslije 30. lekcije
//   4. Ustrajni      — poslije 45. lekcije
//   5. Prva košnica  — poslije zadnje (64.) lekcije
// `posAfterRedoslijed` = redoslijed posljednje lekcije nakon koje medaljon dolazi.
// `contentHtml` je kasnije editovan kroz admin panel (sadržaj aktivnosti koju
// dijete mora odraditi da bi osvojilo bedž).
export const medaljoniTable = pgTable("medaljoni", {
  id: serial("id").primaryKey(),
  nivo: integer("nivo").notNull().default(1),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  naziv: text("naziv").notNull(),
  opis: text("opis").notNull().default(""),
  posAfterRedoslijed: integer("pos_after_redoslijed").notNull(),
  contentHtml: text("content_html").notNull().default(""),
  ikona: varchar("ikona", { length: 32 }).notNull().default("medal"),
  boja: varchar("boja", { length: 16 }).notNull().default("amber"),
  // === Task #126: Etape kviz konfiguracija =====================================
  // Lista ID-jeva iz pitanja_banka koje admin bira kao završni ispit etape.
  // Server scoring (anti-cheat): klijent dobija pitanja BEZ tačnog odgovora,
  // odgovori se predaju serveru koji ih boduje protiv banke.
  kvizPitanjaIds: jsonb("kviz_pitanja_ids").$type<number[]>().notNull().default([]),
  // Minimalni procenat tačnih odgovora za prolaz (0-100). Default 70%.
  pragProlazaPercent: integer("prag_prolaza_percent").notNull().default(70),
  // Ako je true (default), nepoloženi ispit zaključava lekcije sa
  // redoslijed > posAfterRedoslijed. Ako je false, etapa je samo dekorativna
  // (medaljon se i dalje claim-uje kao nagrada, ali ne blokira napredak).
  isGating: boolean("is_gating").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Medaljon = typeof medaljoniTable.$inferSelect;

// === ETAPA POLAGANJA — pokušaji studenta na završnom ispitu etape ============
// Svaki pokušaj se loguje (audit + UI prikaz historije). `polozeno=true` znači
// da je dosegnut prag prolaza; tek to otključava sljedeće lekcije.
export const etapaPolaganjaTable = pgTable("etapa_polaganja", {
  id: serial("id").primaryKey(),
  studentId: varchar("student_id", { length: 100 }).notNull(),
  medaljonId: integer("medaljon_id").notNull(),
  brojTacnih: integer("broj_tacnih").notNull().default(0),
  brojPitanja: integer("broj_pitanja").notNull().default(0),
  procenat: integer("procenat").notNull().default(0),
  polozeno: boolean("polozeno").notNull().default(false),
  pokusajBr: integer("pokusaj_br").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  studentMedaljonIdx: uniqueIndex("etapa_polaganja_student_med_pokusaj_idx").on(t.studentId, t.medaljonId, t.pokusajBr),
}));

export type EtapaPolaganje = typeof etapaPolaganjaTable.$inferSelect;

// === KRUNISANJA — završetak nivoa ============================================
// Jedan red po nivou (UNIQUE nivo). Drži meta krunisanja i konfiguraciju
// završnog kviza nivoa (isti pattern kao etapa).
export const krunisanjaTable = pgTable("krunisanja", {
  id: serial("id").primaryKey(),
  nivo: integer("nivo").notNull().unique(),
  naslov: text("naslov").notNull().default(""),
  opisHtml: text("opis_html").notNull().default(""),
  ikona: varchar("ikona", { length: 32 }).notNull().default("crown"),
  boja: varchar("boja", { length: 16 }).notNull().default("amber"),
  kvizPitanjaIds: jsonb("kviz_pitanja_ids").$type<number[]>().notNull().default([]),
  pragProlazaPercent: integer("prag_prolaza_percent").notNull().default(70),
  // Ako je true, nivo N+1 je zaključan dok krunisanje N nije položeno.
  isGating: boolean("is_gating").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Krunisanje = typeof krunisanjaTable.$inferSelect;

// === KRUNSKE LEKCIJE — proizvoljne dodatne lekcije unutar krunisanja ========
// Admin pravi 0..N dodatnih lekcija (npr. "Ponavljanje svih sura") koje
// učenik prolazi prije završnog ispita krunisanja.
export const krunisanjeLekcijeTable = pgTable("krunisanje_lekcije", {
  id: serial("id").primaryKey(),
  krunisanjeId: integer("krunisanje_id").notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  naslov: text("naslov").notNull(),
  contentHtml: text("content_html").notNull().default(""),
  redoslijed: integer("redoslijed").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export type KrunisanjeLekcija = typeof krunisanjeLekcijeTable.$inferSelect;

// === STUDENT KRUNISANJA — passage tracking ===================================
export const studentKrunisanjaTable = pgTable("student_krunisanja", {
  id: serial("id").primaryKey(),
  studentId: varchar("student_id", { length: 100 }).notNull(),
  krunisanjeId: integer("krunisanje_id").notNull(),
  brojTacnih: integer("broj_tacnih").notNull().default(0),
  brojPitanja: integer("broj_pitanja").notNull().default(0),
  procenat: integer("procenat").notNull().default(0),
  polozenoAt: timestamp("polozeno_at").defaultNow().notNull(),
}, (t) => ({
  uniq: uniqueIndex("student_krunisanja_unique_idx").on(t.studentId, t.krunisanjeId),
}));

export type StudentKrunisanje = typeof studentKrunisanjaTable.$inferSelect;

// Bilježi koje je medaljone učenik osvojio i kada (jedan medaljon po učeniku
// jednom). Koristi se za: prikaz zlatnog medaljona na mapi, vidljivost u
// profilu djeteta i obavještenje roditelju.
export const studentMedaljoniTable = pgTable("student_medaljoni", {
  id: serial("id").primaryKey(),
  studentId: varchar("student_id", { length: 100 }).notNull(),
  medaljonId: integer("medaljon_id").notNull(),
  earnedAt: timestamp("earned_at").defaultNow().notNull(),
}, (t) => ({
  uniq: uniqueIndex("student_medaljoni_unique_idx").on(t.studentId, t.medaljonId),
}));

export type StudentMedaljon = typeof studentMedaljoniTable.$inferSelect;
