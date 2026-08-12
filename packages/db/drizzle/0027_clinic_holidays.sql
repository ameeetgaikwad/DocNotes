-- Manoj msg 2595: Clinic holidays / closed dates. A simple log of
-- dates the clinic was/is closed, surfaced under More → Reports.
-- Hard delete on remove (Manoj msg 2597) — not medical data, no
-- soft-delete column.
CREATE TABLE IF NOT EXISTS "clinic_holidays" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider_id" text NOT NULL,
  "holiday_date" date NOT NULL,
  "reason" varchar(32) NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "clinic_holidays_provider_id_users_id_fk"
    FOREIGN KEY ("provider_id") REFERENCES "public"."users"("id")
    ON DELETE no action ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "clinic_holidays_provider_idx"
  ON "clinic_holidays" USING btree ("provider_id");

CREATE INDEX IF NOT EXISTS "clinic_holidays_date_idx"
  ON "clinic_holidays" USING btree ("holiday_date");
