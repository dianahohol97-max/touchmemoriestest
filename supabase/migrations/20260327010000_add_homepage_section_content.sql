-- =====================================================
-- ADD HOMEPAGE SECTION CONTENT
-- Populates section_content table with all homepage sections
-- =====================================================

-- Insert/Update section content for all homepage sections
INSERT INTO section_content (section_name, heading, subheading, body_text, cta_text, cta_url, metadata) VALUES

-- Gift Ideas section
('gift_ideas_main',
 'Не знаєш що обрати на подарунок?',
 'Пройди швидкий тест і отримай персональні рекомендації',
 NULL,
 'Пройти тест',
 '/gift-quiz',
 '{"quiz_enabled": true}'::jsonb),

-- Photo Print Promo section
('photo_print_promo',
 'Швидкий друк фото',
 NULL,
 'Професійний фотодрук високої якості на преміум фотопапері',
 'Замовити друк фото',
 '/catalog?category=prints',
 '{"steps": [
   {"number": "1", "title": "Оберіть формат", "description": "Стандартний, нестандартний, Polaroid — вибери розмір, який підходить вам."},
   {"number": "2", "title": "Завантажте фото", "description": "Надішли нам фотографії у зручний спосіб — через Telegram, Instagram або на email."},
   {"number": "3", "title": "Оформіть замовлення", "description": "Ми підтвердимо деталі та надішлемо готові фото у зазначені терміни."}
 ]}'::jsonb),

-- Custom Book Promo section
('custom_book_promo',
 'Фотокниги, журнали та фотовироби з душею',
 'Touch.Memories — студія у Тернополі, яка перетворює ваші фотографії на красиві фізичні вироби',
 'Фотокниги, глянцеві журнали, тревел-буки, фотодрук та сувеніри — все з преміум якістю та турботою до деталей.',
 'В магазин',
 '/catalog',
 NULL),

-- Constructor Selection section (photobooks, magazines, travel books)
('constructor_selection',
 'Створюй свою історію',
 'Обери формат і розпочни роботу',
 NULL,
 NULL,
 NULL,
 '{"categories": [
   {"label": "Фотокниги", "description": "Збережіть найкращі моменти у преміум фотокнизі", "cta_text": "Відкрити конструктор", "cta_url": "/editor/new?product=photobook"},
   {"label": "Глянцеві журнали", "description": "Елегантний формат для ваших спогадів", "cta_text": "Відкрити конструктор", "cta_url": "/editor/new?product=magazine"},
   {"label": "Travel Book", "description": "Подорожній щоденник у форматі А4", "cta_text": "Створити TravelBook", "cta_url": "/order/book?productSlug=travelbook"}
 ]}'::jsonb),

-- Photobooth section
('photobooth_promo',
 'Фотобудка на ваше свято',
 'Оренда професійної фотобудки з миттєвим друком',
 'Створюйте незабутні спогади разом з вашими гостями. Миттєвий друк фотографій, стильний дизайн, необмежена кількість знімків.',
 'Дізнатися більше',
 '/services/photobooth',
 '{"features": ["Миттєвий друк", "Необмежена кількість фото", "Стильний дизайн", "Доставка та встановлення"]}'::jsonb),

-- PopularProducts section heading
('popular_products',
 'Найпопулярніші товари',
 'Обирайте серед найкращих наших продуктів',
 NULL,
 'Переглянути всі',
 '/catalog',
 NULL)

ON CONFLICT (section_name)
DO UPDATE SET
    heading = EXCLUDED.heading,
    subheading = EXCLUDED.subheading,
    body_text = EXCLUDED.body_text,
    cta_text = EXCLUDED.cta_text,
    cta_url = EXCLUDED.cta_url,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- Add comment for reference
COMMENT ON COLUMN section_content.metadata IS 'JSONB field for section-specific data like steps, features, categories, etc.';
