-- The public photographer landing («візитка») and its booking flow are not
-- design-complete yet (Diana, 2026-08-04). landing_enabled doubles as the
-- feature flag: off for everyone while the design is finished, on only for
-- the internal test photographer. Re-enable per photographer from the admin
-- panel (or flip the default back) once the design ships.
ALTER TABLE photographers ALTER COLUMN landing_enabled SET DEFAULT false;

UPDATE photographers SET landing_enabled = (lower(email) = 'gogolka16@gmail.com');
