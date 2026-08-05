-- Per-photographer storage cap override, in megabytes.
--
-- Diana asked to see the "storage is full → choose a plan" screen without
-- actually uploading four gigabytes of photos (2026-08-05). Lowering the free
-- plan itself would hit every photographer, so the override lives on the
-- account: NULL means "use the plan's limit", any number wins over it.
--
-- It also works upwards — a support gesture ("we gave you extra space this
-- month") no longer needs a fake paid plan.
ALTER TABLE photographers
  ADD COLUMN IF NOT EXISTS storage_limit_mb integer;

COMMENT ON COLUMN photographers.storage_limit_mb IS
  'Ручний ліміт місця в МБ. NULL — діє ліміт тарифу. Використовується для тестів і винятків.';
