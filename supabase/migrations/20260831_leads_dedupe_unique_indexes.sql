-- APPLIED to project yivfsicvaoewxrtkrfxr on 2026-08-31.
-- Verified after applying: both indexes present with the definitions below, and
-- probed live — a case-differing duplicate email and a repeated
-- google_place_id are both rejected with 23505 (the probe ran inside a
-- transaction that was rolled back, so it left no rows).
-- To reverse: drop index leads_google_place_id_key, leads_email_lower_key;
--
-- Make the leads dedupe rule a constraint instead of a convention.
--
-- /api/leads/ingest deduped in application code: for each of up to 200 leads
-- it ran a SELECT on google_place_id, then a SELECT on email, then an INSERT.
-- Two problems with that.
--
--   1. Up to 600 sequential round-trips in one request, on a platform with a
--      function timeout.
--   2. It is check-then-insert, so two concurrent ingests both see "no
--      duplicate" and both write. The Make.com scenario can retry, which is
--      exactly how that race gets exercised.
--
-- With these indexes the database enforces the rule under concurrency, the
-- route collapses to a single upsert, and every future write path inherits
-- the same guarantee instead of having to remember it.
--
-- Partial indexes (WHERE ... IS NOT NULL) because both columns are optional:
-- a lead may have a place id and no email, or the reverse, and many NULLs must
-- not collide with each other.
--
-- Verified before writing this migration (2026-08-31): 593 rows, 0 duplicate
-- google_place_id, 0 duplicate lower(email), 0 empty-string emails — so both
-- indexes build without a backfill.

create unique index if not exists leads_google_place_id_key
    on public.leads (google_place_id)
    where google_place_id is not null;

-- lower(): emails were matched case-insensitively in the old code, so the
-- constraint has to be case-insensitive too or it would permit duplicates the
-- application considered the same lead.
create unique index if not exists leads_email_lower_key
    on public.leads (lower(email))
    where email is not null and email <> '';
