-- Certificates: admin-create form has "Джерело" (source) and internal notes
-- fields that were silently dropped because the columns never existed.
-- Also records reserved_order_id / reserved_at in the migration history:
-- these two already exist in production (added by hand via the dashboard)
-- and are now used by the checkout to atomically reserve a certificate for
-- one pending order, closing the multi-spend hole where the same code could
-- discount any number of parallel unpaid orders.
-- All statements are idempotent so this applies cleanly both to production
-- (where reserved_* exist) and to a fresh database (where nothing exists).

ALTER TABLE certificates ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS reserved_order_id uuid;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS reserved_at timestamptz;

COMMENT ON COLUMN certificates.source IS 'Де створено/продано сертифікат: manual | website | instagram | other';
COMMENT ON COLUMN certificates.notes IS 'Внутрішні нотатки адміністратора (не видно клієнту)';
COMMENT ON COLUMN certificates.reserved_order_id IS 'Замовлення, яке зарезервувало сертифікат на час оплати (TTL 24 год, див. lib/certificates/redeemCertificate.ts)';
COMMENT ON COLUMN certificates.reserved_at IS 'Момент резервування; резервації старші за 24 год вважаються звільненими';
