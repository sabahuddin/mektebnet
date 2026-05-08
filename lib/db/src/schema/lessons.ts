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
  createdAt: timestamp("created_at").defaultNow(),
});

export type Medaljon = typeof medaljoniTable.$inferSelect;

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
