-- Migration: Add translations JSONB to products and blog_posts
-- This enables multilingual product names, descriptions, and blog content.
-- Structure: { "en": { "name": "...", "short_description": "..." }, "ro": {...}, "pl": {...}, "de": {...} }

-- ═══ PRODUCTS ═══

-- Add translations column
ALTER TABLE products ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT NULL;

-- Comment for documentation
COMMENT ON COLUMN products.translations IS 'Multilingual translations: { "en": { "name": "...", "short_description": "...", "description": "..." }, ... }';

-- Populate English translations for all active products
-- These are AI-generated starting points — review and edit in admin panel
UPDATE products SET translations = jsonb_build_object(
  'en', jsonb_build_object(
    'name', CASE slug
      WHEN 'photobook-printed' THEN 'Photo Book with Printed Cover'
      WHEN 'photobook-velour' THEN 'Photo Book with Velour Cover'
      WHEN 'photobook-leatherette' THEN 'Photo Book with Leatherette Cover'
      WHEN 'photobook-fabric' THEN 'Photo Book with Fabric Cover'
      WHEN 'personalized-glossy-magazine' THEN 'Glossy Magazine with Soft Cover'
      WHEN 'personalized-glossy-magazine-hard' THEN 'Glossy Magazine with Hard Cover'
      WHEN 'travelbook-20x30' THEN 'Travel Book'
      WHEN 'wishbook' THEN 'Guest Book'
      WHEN 'photo-prints' THEN 'Photo Prints Standard Sizes'
      WHEN 'photo-prints-nonstandard' THEN 'Photo Prints Non-Standard Sizes'
      WHEN 'photo-polaroid' THEN 'Polaroid Photo Prints'
      WHEN 'canvas-print' THEN 'Canvas Print'
      WHEN 'photo-puzzle' THEN 'Photo Puzzle'
      WHEN 'wall-calendar' THEN 'Wall Calendar 2026'
      WHEN 'star-map' THEN 'Star Map'
      WHEN 'birth-stats' THEN 'Birth Stats Poster'
      WHEN 'love-map' THEN 'Love Map'
      WHEN 'city-map' THEN 'City Map'
      WHEN 'zodiac-poster' THEN 'Zodiac Poster'
      WHEN 'monogram' THEN 'Monogram'
      WHEN 'cartoon-portrait' THEN 'Cartoon Portrait'
      WHEN 'gift-certificate' THEN 'Gift Certificate'
      WHEN 'poster-custom' THEN 'Custom Poster'
      WHEN 'photo-magnet' THEN 'Photo Magnet'
      ELSE name  -- fallback to Ukrainian name
    END,
    'short_description', COALESCE(short_description, '')
  ),
  'ro', jsonb_build_object(
    'name', CASE slug
      WHEN 'photobook-printed' THEN 'Album Foto cu Copertă Tipărită'
      WHEN 'photobook-velour' THEN 'Album Foto cu Copertă din Velur'
      WHEN 'photobook-leatherette' THEN 'Album Foto cu Copertă din Piele Ecologică'
      WHEN 'photobook-fabric' THEN 'Album Foto cu Copertă din Țesătură'
      WHEN 'personalized-glossy-magazine' THEN 'Revistă Lucioasă cu Copertă Moale'
      WHEN 'personalized-glossy-magazine-hard' THEN 'Revistă Lucioasă cu Copertă Tare'
      WHEN 'travelbook-20x30' THEN 'Travel Book'
      WHEN 'wishbook' THEN 'Carte de Oaspeți'
      WHEN 'photo-prints' THEN 'Tipărire Foto Dimensiuni Standard'
      WHEN 'canvas-print' THEN 'Tipărire pe Pânză'
      WHEN 'photo-puzzle' THEN 'Puzzle Foto'
      WHEN 'wall-calendar' THEN 'Calendar de Perete 2026'
      WHEN 'star-map' THEN 'Harta Stelelor'
      WHEN 'gift-certificate' THEN 'Certificat Cadou'
      ELSE name
    END,
    'short_description', COALESCE(short_description, '')
  ),
  'pl', jsonb_build_object(
    'name', CASE slug
      WHEN 'photobook-printed' THEN 'Fotoksiążka z Drukowaną Okładką'
      WHEN 'photobook-velour' THEN 'Fotoksiążka z Welurową Okładką'
      WHEN 'photobook-leatherette' THEN 'Fotoksiążka z Okładką ze Skóry Ekologicznej'
      WHEN 'photobook-fabric' THEN 'Fotoksiążka z Okładką z Tkaniny'
      WHEN 'personalized-glossy-magazine' THEN 'Magazyn Błyszczący z Miękką Okładką'
      WHEN 'personalized-glossy-magazine-hard' THEN 'Magazyn Błyszczący z Twardą Okładką'
      WHEN 'travelbook-20x30' THEN 'Travel Book'
      WHEN 'wishbook' THEN 'Księga Gości'
      WHEN 'photo-prints' THEN 'Wydruki Foto Standardowe Rozmiary'
      WHEN 'canvas-print' THEN 'Wydruk na Płótnie'
      WHEN 'photo-puzzle' THEN 'Puzzle ze Zdjęciem'
      WHEN 'wall-calendar' THEN 'Kalendarz Ścienny 2026'
      WHEN 'star-map' THEN 'Mapa Gwiazd'
      WHEN 'gift-certificate' THEN 'Bon Podarunkowy'
      ELSE name
    END,
    'short_description', COALESCE(short_description, '')
  ),
  'de', jsonb_build_object(
    'name', CASE slug
      WHEN 'photobook-printed' THEN 'Fotobuch mit Bedrucktem Einband'
      WHEN 'photobook-velour' THEN 'Fotobuch mit Velour-Einband'
      WHEN 'photobook-leatherette' THEN 'Fotobuch mit Kunstleder-Einband'
      WHEN 'photobook-fabric' THEN 'Fotobuch mit Stoff-Einband'
      WHEN 'personalized-glossy-magazine' THEN 'Hochglanzmagazin mit Weichem Einband'
      WHEN 'personalized-glossy-magazine-hard' THEN 'Hochglanzmagazin mit Hartem Einband'
      WHEN 'travelbook-20x30' THEN 'Travel Book'
      WHEN 'wishbook' THEN 'Gästebuch'
      WHEN 'photo-prints' THEN 'Fotoabzüge Standardgrößen'
      WHEN 'canvas-print' THEN 'Leinwanddruck'
      WHEN 'photo-puzzle' THEN 'Fotopuzzle'
      WHEN 'wall-calendar' THEN 'Wandkalender 2026'
      WHEN 'star-map' THEN 'Sternenkarte'
      WHEN 'gift-certificate' THEN 'Geschenkgutschein'
      ELSE name
    END,
    'short_description', COALESCE(short_description, '')
  )
) WHERE translations IS NULL AND is_active = true;


-- ═══ BLOG POSTS ═══

-- Add translations column  
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT NULL;

COMMENT ON COLUMN blog_posts.translations IS 'Multilingual translations: { "en": { "title": "...", "excerpt": "...", "content": "..." }, ... }';

-- Blog translations need to be done per-post in admin panel.
-- The structure is: { "en": { "title": "...", "excerpt": "...", "content": "..." }, ... }


-- ═══ INDEX for faster lookups ═══
CREATE INDEX IF NOT EXISTS idx_products_translations ON products USING gin (translations);
CREATE INDEX IF NOT EXISTS idx_blog_posts_translations ON blog_posts USING gin (translations);
