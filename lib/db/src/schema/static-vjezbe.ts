import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Admin overrides for the bundled, self-contained static exercises.  The
// exercise key is the stable public identifier used by medaljon iframes.
export const staticVjezbeIzvoriTable = pgTable("static_vjezbe_izvori", {
  key: text("key").primaryKey(),
  sourceHtml: text("source_html").notNull(),
  updatedBy: integer("updated_by").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStaticVjezbaIzvorSchema = createInsertSchema(staticVjezbeIzvoriTable)
  .omit({ updatedAt: true });
export type InsertStaticVjezbaIzvor = z.infer<typeof insertStaticVjezbaIzvorSchema>;
export type StaticVjezbaIzvor = typeof staticVjezbeIzvoriTable.$inferSelect;