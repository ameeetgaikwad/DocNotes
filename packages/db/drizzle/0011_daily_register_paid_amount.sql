ALTER TABLE "daily_register_entries" ADD COLUMN "paid_amount" numeric(10, 2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
-- Backfill: existing 'paid' entries are fully paid; existing 'due' / 'nil'
-- entries default to 0. Idempotent — safe to re-run.
UPDATE "daily_register_entries"
SET "paid_amount" = "fee_amount"
WHERE "payment_status" = 'paid' AND "paid_amount" = 0;
