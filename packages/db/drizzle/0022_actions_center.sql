ALTER TABLE "doctor_profiles" ADD COLUMN "overdue_days_threshold" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
CREATE TABLE "home_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" text NOT NULL,
	"patient_name" varchar(200) NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_todos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" text NOT NULL,
	"text" text NOT NULL,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "home_visits" ADD CONSTRAINT "home_visits_provider_id_users_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_todos" ADD CONSTRAINT "custom_todos_provider_id_users_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "home_visits_provider_idx" ON "home_visits" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "home_visits_provider_scheduled_idx" ON "home_visits" USING btree ("provider_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "custom_todos_provider_idx" ON "custom_todos" USING btree ("provider_id");