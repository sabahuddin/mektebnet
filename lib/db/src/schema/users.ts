import { pgTable, serial, text, integer, boolean, timestamp, varchar, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", ["admin", "muallim", "ucenik", "roditelj"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 60 }).notNull().unique(),
  email: varchar("email", { length: 255 }).unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: userRoleEnum("role").notNull().default("ucenik"),
  isActive: boolean("is_active").notNull().default(true),
  // Probni period — popunjeno kod self-registration (NOW + 7 dana). Login je
  // dozvoljen ako je `isActive=true` (admin odobrio) ILI `trialUntil > now`.
  // Kad admin odobri pretplatu, postavi se `isActive=true` i ovo polje se
  // čisti (NULL).
  trialUntil: timestamp("trial_until"),
  createdAt: timestamp("created_at").defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
  // Presence/screentime — ažurirano preko POST /api/aktivnost/heartbeat svakih ~60s.
  lastSeenAt: timestamp("last_seen_at"),
  totalScreentimeSec: integer("total_screentime_sec").notNull().default(0),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, lastLoginAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
