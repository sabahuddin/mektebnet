ALTER TABLE "medaljoni"
ADD COLUMN IF NOT EXISTS "kviz_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;