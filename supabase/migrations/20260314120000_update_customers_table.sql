-- Migration: Update customers table for Google Auth and detailed profiles
-- Description: Adds first/last name, avatar, subscription status, and tracking fields.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_subscribed BOOLEAN DEFAULT FALSE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- Optionally migrate data from 'name' to 'first_name' if 'name' exists and 'first_name' is empty
-- This is a simple split (first part is first_name, rest is last_name)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'name') THEN
        UPDATE customers 
        SET 
            first_name = SPLIT_PART(name, ' ', 1),
            last_name = SUBSTRING(name FROM POSITION(' ' IN name) + 1)
        WHERE (first_name IS NULL OR first_name = '') AND name IS NOT NULL;
    END IF;
END $$;
