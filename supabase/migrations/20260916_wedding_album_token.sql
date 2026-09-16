-- Посилання, яким пара забирає свої фото (Діана, 16.09.2026).
--
-- НАВІЩО ОКРЕМИЙ ТОКЕН, А НЕ ТОЙ САМИЙ СЛАГ. Слаг знає кожен гість, бо він
-- надрукований на QR-коді посеред столу. Якби архів віддавався за ним, будь-хто
-- із запрошених міг би вивантажити все весілля цілком, включно з чужими
-- знімками. Пара отримує свою адресу, якої немає на жодному столі.
--
-- ЧОМУ ЦЕ НЕ ЗАМІНЮЄ ВХОДУ. Захист той самий, що й у сторінки гостя: адресу не
-- вгадати. Для пайлота цього досить, бо пара отримує посилання від Діани в
-- особистому листуванні, а не шукає його на сайті.
--
-- Токен рівно на 32 шістнадцяткові символи, тобто 128 біт випадковості — стільки
-- ж, скільки в UUID, з якого він і зроблений. Дефісів немає навмисно: адресу
-- пара копіює руками, і символ, який половина людей приймає за перенос рядка,
-- у ній зайвий.
alter table public.wedding_events
  add column if not exists download_token text unique;

update public.wedding_events
   set download_token = replace(gen_random_uuid()::text, '-', '')
 where download_token is null;

alter table public.wedding_events
  alter column download_token set default replace(gen_random_uuid()::text, '-', ''),
  alter column download_token set not null;

-- Адреса архіву — /wedding/album/<токен>, тож подія зі слагом «album» зробила б
-- сторінку гостя недосяжною: у Next.js статичний сегмент завжди виграє в
-- динамічного. Заборона коштує один рядок, а пастка коштувала б вечора пошуків.
alter table public.wedding_events
  drop constraint if exists wedding_events_slug_not_album;
alter table public.wedding_events
  add constraint wedding_events_slug_not_album check (slug <> 'album');
