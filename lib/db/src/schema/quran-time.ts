import { date, integer, pgTable, primaryKey, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";

// Jedan zbir po učeniku i kalendarskom danu (Europe/Zurich).
// lastHeartbeatAt se koristi za server-side mjerenje bez vjerovanja klijentskom satu.
export const quranVrijemeDnevnoTable = pgTable("quran_vrijeme_dnevno", {
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  dan: date("dan", { mode: "string" }).notNull(),
  seconds: integer("seconds").notNull().default(0),
  lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.userId, table.dan] }),
]);

export const insertQuranVrijemeDnevnoSchema = createInsertSchema(quranVrijemeDnevnoTable);
export type QuranVrijemeDnevno = typeof quranVrijemeDnevnoTable.$inferSelect;