import { pgTable, serial, text, integer, boolean, jsonb, timestamp, varchar } from "drizzle-orm/pg-core";
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
