-- Migration: Add display_style to categories
-- Description: Adds display_style column to categories table for sidebar thumbnails or banner display.

ALTER TABLE categories ADD COLUMN IF NOT EXISTS display_style TEXT DEFAULT 'banner';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
