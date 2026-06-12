CREATE TABLE "clinic_expense_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinic_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"category_name" varchar(100) NOT NULL,
	"expense_date" date NOT NULL,
	"paid_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clinic_expense_categories" ADD CONSTRAINT "clinic_expense_categories_provider_id_users_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_expenses" ADD CONSTRAINT "clinic_expenses_provider_id_users_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clinic_expense_categories_provider_name_uq" ON "clinic_expense_categories" USING btree ("provider_id","name");--> statement-breakpoint
CREATE INDEX "clinic_expenses_provider_idx" ON "clinic_expenses" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "clinic_expenses_provider_date_idx" ON "clinic_expenses" USING btree ("provider_id","expense_date");