import { pgTable, serial, integer, varchar, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";

// === PUSH TOKENS ================================================================
// Bilježi OneSignal `playerId` (subscription ID) po korisniku i uređaju.
// Jedan korisnik može imati više tokena (telefon + tablet + desktop).
// UNIQUE(userId, playerId) — isti uređaj se ne duplira; ako se isti playerId
// javi za drugog usera (npr. logout/login na istom telefonu), upsert prepiše userId.
export const pushTokensTable = pgTable("push_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  playerId: varchar("player_id", { length: 64 }).notNull(),
  platform: varchar("platform", { length: 16 }).notNull(),
  userAgent: text("user_agent").notNull().default(""),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  userPlayerUnique: uniqueIndex("push_tokens_user_player_unique_idx")
    .on(t.userId, t.playerId),
  playerIdx: uniqueIndex("push_tokens_player_unique_idx").on(t.playerId),
  userIdx: index("push_tokens_user_idx").on(t.userId),
}));

export type PushToken = typeof pushTokensTable.$inferSelect;
