-- 20260605_editable_section_images.sql  (applied via Supabase MCP)
-- Make the previously-hardcoded home sections editable in admin → Контент:
--   photo_print  → metadata.collage[0..8]  (9-photo "Швидкий друк" grid)
--   wedding      → metadata.images.{guestbook,newspaper,photobook,magazine}
--   how_it_works → image_url (the "Чому варто обрати нас" workshop photo)
-- Components fall back to bundled /public/images/* when a slot is empty.
insert into public.section_content (section_name, is_active, heading, metadata)
select v.section_name, true, v.heading, '{}'::jsonb
from (values
  ('photo_print','Швидкий друк фото'),
  ('wedding','Весільна секція'),
  ('how_it_works','Чому варто обрати нас')
) as v(section_name, heading)
where not exists (select 1 from public.section_content sc where sc.section_name = v.section_name);
