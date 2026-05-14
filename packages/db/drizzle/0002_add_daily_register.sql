CREATE TABLE "daily_register_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" text NOT NULL,
	"visit_date" date NOT NULL,
	"patient_id" uuid NOT NULL,
	"fee_amount" numeric(10, 2) NOT NULL,
	"payment_mode" varchar(16) NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_register_entries" ADD CONSTRAINT "daily_register_entries_provider_id_users_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_register_entries" ADD CONSTRAINT "daily_register_entries_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_register_provider_idx" ON "daily_register_entries" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "daily_register_visit_date_idx" ON "daily_register_entries" USING btree ("visit_date");--> statement-breakpoint
CREATE INDEX "daily_register_provider_date_idx" ON "daily_register_entries" USING btree ("provider_id","visit_date");--> statement-breakpoint
CREATE INDEX "daily_register_patient_idx" ON "daily_register_entries" USING btree ("patient_id");
