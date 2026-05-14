ALTER TABLE "daily_register_entries" ADD COLUMN "service_type" varchar(64);--> statement-breakpoint
ALTER TABLE "daily_register_entries" ADD COLUMN "payment_status" varchar(16) DEFAULT 'paid' NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "dob_day" smallint;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "dob_month" smallint;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "dob_year" smallint;
