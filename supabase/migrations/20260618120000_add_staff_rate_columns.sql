-- Add pay-rate columns to `staff`.
--
-- The team form (app/admin/team) and the Staff type carry daily_base_rate,
-- commission_percentage and piece_rate ("Ставки оплати"), and the staff API
-- route inserts them — but no prior migration ever created these columns. On
-- any environment where they are missing, inserting/updating a teammate fails
-- with 42703 ("column ... does not exist"), surfaced in the UI as the generic
-- "Помилка збереження". This adds them so rates persist.
--
-- Idempotent: safe to re-run.

ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS daily_base_rate NUMERIC DEFAULT 0;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC DEFAULT 0;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS piece_rate NUMERIC DEFAULT 0;
