-- Manoj msg 2032: reference format calls out Quantity as a separate
-- field so the doctor sees the total tablets needed for the duration.
-- Auto-computed client-side from dosage × duration but editable.
ALTER TABLE "prescription_lines" ADD COLUMN "quantity" integer;
