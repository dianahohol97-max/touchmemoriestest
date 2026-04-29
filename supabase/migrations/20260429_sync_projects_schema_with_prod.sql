-- Schema drift recovery for `projects` table
-- 
-- Background: the original migration `20260323_create_projects_table.sql`
-- defined a narrow projects table (CHECK constraints on product_type and format,
-- no name/uploaded_photos columns, no notified_*_at columns).
-- Production was extended over time via the Supabase dashboard, so production
-- schema and repo migrations had drifted apart. This migration brings the repo
-- in sync with what production already looks like, so a fresh setup
-- (`supabase db reset`) produces the same shape we have running.
--
-- Production state (verified 2026-04-29 against project yivfsicvaoewxrtkrfxr):
--   - product_type and format are plain TEXT (no CHECK constraints)
--   - total_pages is nullable with DEFAULT 20
--   - status, format, cover_type, all are nullable
--   - name TEXT exists
--   - uploaded_photos JSONB exists with default '[]'::jsonb
--   - notified_24h_at, notified_10d_at, notified_55d_at, notified_59d_at exist
--   - RLS policy is a single FOR ALL "Users can manage own projects"
--     using auth.uid() = user_id (replaces the four split policies).
--
-- All statements are idempotent (DROP IF EXISTS, ADD COLUMN IF NOT EXISTS) so
-- this is safe to apply on prod and on fresh local DBs.

-- 1. Drop the over-restrictive CHECK constraints
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_product_type_check;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_format_check;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_total_pages_check;

-- 2. Relax NOT NULL constraints to match prod (PhotoPrintConstructor doesn't
--    pass total_pages; cover_type can be empty for non-printed covers)
ALTER TABLE projects ALTER COLUMN format DROP NOT NULL;
ALTER TABLE projects ALTER COLUMN total_pages DROP NOT NULL;
ALTER TABLE projects ALTER COLUMN total_pages SET DEFAULT 20;

-- 3. Add the columns code already writes
ALTER TABLE projects ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS uploaded_photos JSONB DEFAULT '[]'::jsonb;

-- 4. Add the columns the design-lifecycle cron reads/writes
ALTER TABLE projects ADD COLUMN IF NOT EXISTS notified_24h_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS notified_10d_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS notified_55d_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS notified_59d_at TIMESTAMPTZ;

-- 5. Replace the four split RLS policies with the single FOR ALL policy
--    that prod actually uses. This is functionally equivalent but matches reality.
DROP POLICY IF EXISTS "Users can view own projects"   ON projects;
DROP POLICY IF EXISTS "Users can create own projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polrelid = 'public.projects'::regclass
      AND polname = 'Users can manage own projects'
  ) THEN
    CREATE POLICY "Users can manage own projects"
      ON projects
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 6. Index on notified_*_at would be nice for the lifecycle cron's filters,
--    but the prod table has rows=0 and the cron only runs once a day, so we
--    skip the indexes for now. Add later if the table grows past ~10k rows.
