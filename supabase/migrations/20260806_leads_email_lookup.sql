-- Пошук пошти ліда на його ж сайті (Diana, 2026-08-06).
--
-- Google Places не віддає пошту — такого поля в їхньому API немає, тому 593
-- зібрані контакти приїхали з телефоном і сайтом, але без адреси. Пошта майже
-- завжди опублікована на самому сайті, тож адмінка вміє її звідти дістати.
--
-- email_checked_at памʼятає, що сайт уже переглядали. Без цієї позначки кожен
-- наступний запуск знову ходив би по тих самих сайтах, де пошти немає, і
-- ніколи не доходив до нових лідів.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_checked_at timestamptz;

-- Часткий індекс саме під чергу пошуку: лише ті, кому ще шукати пошту.
CREATE INDEX IF NOT EXISTS leads_email_lookup_idx
  ON leads(email_checked_at)
  WHERE email IS NULL AND website IS NOT NULL;
