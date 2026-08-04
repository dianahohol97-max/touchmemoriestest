-- Pixieset-style gallery redesign: the client gallery opens with a fullscreen
-- cover photo. The photographer picks it in the cabinet; when unset, the
-- first uploaded photo is used.
ALTER TABLE photographer_galleries
  ADD COLUMN IF NOT EXISTS cover_photo_id uuid REFERENCES photographer_gallery_photos(id) ON DELETE SET NULL;
