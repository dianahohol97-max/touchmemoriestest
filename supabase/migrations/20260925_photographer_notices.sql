-- Листи фотографу про галереї (Діана, 2026-09-24): «галерея скоро згасне»,
-- «місце закінчується», «файли галереї видалено». Кожен лист — рівно один раз
-- на подію (гоча 15), тому відправка фіксується в базі.
--
-- Чому колонки, а не окрема таблиця. Подія завжди належить одному рядку:
-- термін і очищення — галереї, місце — фотографу. Окрема таблиця подій несла б
-- зовнішні ключі на photographer_galleries і photographers, а кожен новий ключ
-- — ще одна нагода для PGRST201 у вбудовуваннях (гоча 12; між галереями й фото
-- ключів уже два). Колонки без ключів цієї пастки не відкривають зовсім.
--
-- expiry_notice_for — це НЕ час відправки, а той expires_at, про який лист
-- попереджав. Лист вважається надісланим, лише доки ця позначка дорівнює
-- поточному expires_at. Продовжив фотограф галерею — expires_at змінився, і
-- перед новим терміном лист прийде знову, без жодного коду скидання в
-- маршрутах продовження (їх може стати більше, ніж один).
--
-- storage_notice_pending_at — коротка «бронь» на час відправки. Кабінет
-- вантажить кілька файлів паралельно, і два confirm майже одночасно побачили б
-- «ще не надіслано». Позначка sent ставиться тільки після успіху, тож без броні
-- лист пішов би двічі. Бронь старша за п'ять хвилин вважається покинутою.

alter table public.photographer_galleries
  add column if not exists expiry_notice_for timestamptz,
  add column if not exists expiry_notice_sent_at timestamptz,
  add column if not exists purge_notice_sent_at timestamptz;

alter table public.photographers
  add column if not exists storage_notice_sent_at timestamptz,
  add column if not exists storage_notice_pending_at timestamptz;

comment on column public.photographer_galleries.expiry_notice_for is
  'expires_at, про який пішов лист «галерея скоро згасне». Не дорівнює expires_at — лист ще не надіслано для поточного терміну.';
comment on column public.photographer_galleries.purge_notice_sent_at is
  'Коли пішов лист «файли галереї видалено». Ставиться тільки після того, як провайдер прийняв лист.';
comment on column public.photographers.storage_notice_sent_at is
  'Коли пішов лист «місце закінчується» (поріг 90%). Скидається, коли зайняте падає нижче 80%.';
comment on column public.photographers.storage_notice_pending_at is
  'Бронь на час відправки листа про місце, щоб паралельні аплоади не надіслали його двічі.';
