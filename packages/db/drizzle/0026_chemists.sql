-- Manoj msg 2267: chemists / pharmacy contacts. Doctors save the
-- WhatsApp numbers of chemists they regularly send prescriptions to,
-- then one-tap Send-to-Chemist from the Rx page opens WhatsApp with
-- the Rx text pre-filled.
CREATE TABLE IF NOT EXISTS "chemists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider_id" text NOT NULL,
  "name" varchar(200) NOT NULL,
  "whatsapp_number" varchar(32) NOT NULL,
  "notes" text,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chemists_provider_id_users_id_fk"
    FOREIGN KEY ("provider_id") REFERENCES "public"."users"("id")
    ON DELETE no action ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "chemists_provider_idx"
  ON "chemists" USING btree ("provider_id");
