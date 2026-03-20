-- Migration: Add constructor-related columns to orders table
-- Description: Adds constructor_data, photo_count, and cover_type columns for photobook/magazine constructor orders

ALTER TABLE orders ADD COLUMN IF NOT EXISTS constructor_data text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS photo_count integer DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cover_type text;
