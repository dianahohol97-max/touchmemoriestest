-- Migration: Add variants and video_url to products, remove price_per_page
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS variants jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE public.products DROP COLUMN IF EXISTS price_per_page;
