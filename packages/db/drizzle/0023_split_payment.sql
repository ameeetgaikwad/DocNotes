-- Manoj msg 1926: support partial payments (cash + digital + balance)
-- on a single register entry. The new payment_status value "split" is
-- enforced at the app layer (Zod) since payment_status is a free-form
-- varchar(16) with no DB check constraint. All three columns are
-- nullable — only populated when paymentStatus = 'split'.
ALTER TABLE "daily_register_entries" ADD COLUMN "cash_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "daily_register_entries" ADD COLUMN "digital_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "daily_register_entries" ADD COLUMN "balance_amount" numeric(10, 2);
