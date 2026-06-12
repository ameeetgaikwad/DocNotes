ALTER TABLE "clinic_expenses" ADD COLUMN "payment_method" text;--> statement-breakpoint
ALTER TABLE "clinic_expenses" ADD COLUMN "staff_name" text;--> statement-breakpoint
UPDATE "clinic_expenses" SET "payment_method" = 'cash' WHERE "paid_at" IS NOT NULL AND "payment_method" IS NULL;