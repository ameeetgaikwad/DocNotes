-- Manoj msg 2595: personal insight / observation notes. Free-form
-- clinical observations, reading takeaways, disease insights — kept
-- separate from any patient record. Per-doctor. Soft delete per
-- Manoj msg 2597 so a valuable observation isn't lost to an
-- accidental tap.
CREATE TABLE IF NOT EXISTS "insight_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider_id" text NOT NULL,
  "title" varchar(200),
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "insight_notes_provider_id_users_id_fk"
    FOREIGN KEY ("provider_id") REFERENCES "public"."users"("id")
    ON DELETE no action ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "insight_notes_provider_idx"
  ON "insight_notes" USING btree ("provider_id");

CREATE INDEX IF NOT EXISTS "insight_notes_updated_at_idx"
  ON "insight_notes" USING btree ("updated_at");
