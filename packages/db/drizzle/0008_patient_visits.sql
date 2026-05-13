CREATE TABLE "patient_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" text NOT NULL,
	"patient_id" uuid NOT NULL,
	"visit_date" date NOT NULL,
	"bp_systolic" smallint,
	"bp_diastolic" smallint,
	"heart_rate" smallint,
	"bsl_fasting" numeric(5, 1),
	"bsl_postprandial" numeric(5, 1),
	"bsl_random" numeric(5, 1),
	"temperature_celsius" numeric(4, 1),
	"weight_kg" numeric(5, 1),
	"height_cm" numeric(5, 1),
	"clinical_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patient_visits" ADD CONSTRAINT "patient_visits_provider_id_users_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_visits" ADD CONSTRAINT "patient_visits_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "patient_visits_patient_date_uniq" ON "patient_visits" USING btree ("patient_id","visit_date");--> statement-breakpoint
CREATE INDEX "patient_visits_provider_idx" ON "patient_visits" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "patient_visits_patient_idx" ON "patient_visits" USING btree ("patient_id");--> statement-breakpoint
INSERT INTO "patient_visits" ("provider_id", "patient_id", "visit_date")
SELECT DISTINCT "provider_id", "patient_id", "visit_date"
FROM "daily_register_entries"
ON CONFLICT ("patient_id", "visit_date") DO NOTHING;
