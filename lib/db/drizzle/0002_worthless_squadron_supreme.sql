CREATE TABLE "push_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"player_id" varchar(64) NOT NULL,
	"platform" varchar(16) NOT NULL,
	"user_agent" text DEFAULT '' NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "push_tokens_user_player_unique_idx" ON "push_tokens" USING btree ("user_id","player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "push_tokens_player_unique_idx" ON "push_tokens" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "push_tokens_user_idx" ON "push_tokens" USING btree ("user_id");