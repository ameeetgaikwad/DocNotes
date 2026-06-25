-- Manoj msg 1945: structured prescription storage for the new Write Rx
-- feature. Each prescription_lines row is one medicine on a visit's
-- prescription. visit_id cascades on delete so a removed visit drops
-- its Rx with it; provider_id is denormalised for fast "frequently
-- used medicines" queries without joining through patient_visits.
CREATE TABLE "prescription_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visit_id" uuid NOT NULL,
	"provider_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"medicine_name" varchar(200) NOT NULL,
	"tablets_count" integer,
	"dosage" varchar(100),
	"frequency" varchar(100),
	"duration" varchar(50),
	"instructions" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prescription_lines" ADD CONSTRAINT "prescription_lines_visit_id_patient_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."patient_visits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescription_lines" ADD CONSTRAINT "prescription_lines_provider_id_users_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prescription_lines_visit_idx" ON "prescription_lines" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "prescription_lines_provider_idx" ON "prescription_lines" USING btree ("provider_id");
