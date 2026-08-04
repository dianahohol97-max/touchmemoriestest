-- Download statistics for photographer galleries (Diana, 2026-08-04):
-- the cabinet shows how many times clients downloaded the ZIP and single
-- photos. Counters are telemetry — races on increment are acceptable.
ALTER TABLE photographer_galleries
  ADD COLUMN IF NOT EXISTS zip_downloads integer NOT NULL DEFAULT 0;
ALTER TABLE photographer_gallery_photos
  ADD COLUMN IF NOT EXISTS download_count integer NOT NULL DEFAULT 0;

-- Atomic increment helpers (supabase-js has no "col = col + 1" update).
CREATE OR REPLACE FUNCTION increment_gallery_zip_downloads(gallery uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS
$$ UPDATE photographer_galleries SET zip_downloads = zip_downloads + 1 WHERE id = gallery $$;

CREATE OR REPLACE FUNCTION increment_photo_downloads(photo uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS
$$ UPDATE photographer_gallery_photos SET download_count = download_count + 1 WHERE id = photo $$;
