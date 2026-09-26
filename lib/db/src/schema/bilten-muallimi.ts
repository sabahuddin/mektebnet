import { integer, pgTable, primaryKey, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";

export const biltenMuallimiTable = pgTable("bilten_muallimi", {
  id: serial("id").primaryKey(),
  naslov: varchar("naslov", { length: 180 }).notNull(),
  sadrzaj: text("sadrzaj").notNull(),
  status: varchar("status", { length: 12 }).notNull().default("nacrt"),
  autorId: integer("autor_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  publishedAt: timestamp("published_at"),
});

export const biltenMuallimiCitanjaTable = pgTable("bilten_muallimi_citanja", {
  biltenId: integer("bilten_id").notNull().references(() => biltenMuallimiTable.id, { onDelete: "cascade" }),
  muallimId: integer("muallim_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  procitanoAt: timestamp("procitano_at").notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.biltenId, table.muallimId] }),
]);

export const insertBiltenMuallimiSchema = createInsertSchema(biltenMuallimiTable)
  .omit({ id: true, status: true, autorId: true, createdAt: true, updatedAt: true, publishedAt: true });
export type BiltenMuallimi = typeof biltenMuallimiTable.$inferSelect;