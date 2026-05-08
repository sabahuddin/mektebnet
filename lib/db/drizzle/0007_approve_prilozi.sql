ALTER TABLE "prilozi" ADD COLUMN "approved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "prilozi" ADD COLUMN "uploaded_by_role" varchar(20);--> statement-breakpoint
UPDATE "prilozi" SET "approved" = true;
