-- Patient Charts (Amit msg 3051, spec Manoj msg 3054). Doctor-wide
-- custom chart definitions + readings added directly in Charts. BP /
-- Sugar / Weight charts also read patient_visits; nothing here writes
-- back to visits. Soft delete via deleted_at.
CREATE TABLE IF NOT EXISTS "chart_definitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider_id" text NOT NULL REFERENCES "users"("id"),
  "name" varchar(80) NOT NULL,
  "unit" varchar(30),
  "normal_min" numeric(10, 2),
  "normal_max" numeric(10, 2),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "chart_definitions_provider_idx"
  ON "chart_definitions" USING btree ("provider_id");

CREATE TABLE IF NOT EXISTS "chart_readings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider_id" text NOT NULL REFERENCES "users"("id"),
  "patient_id" uuid NOT NULL REFERENCES "patients"("id"),
  "metric" varchar(16) NOT NULL,
  "definition_id" uuid REFERENCES "chart_definitions"("id"),
  "reading_date" date NOT NULL,
  "value" numeric(10, 2) NOT NULL,
  "value2" numeric(10, 2),
  "sugar_type" varchar(16),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "chart_readings_patient_idx"
  ON "chart_readings" USING btree ("patient_id", "metric");

CREATE INDEX IF NOT EXISTS "chart_readings_definition_idx"
  ON "chart_readings" USING btree ("definition_id");
