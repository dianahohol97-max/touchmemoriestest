-- Єдина таблиця цін для посторінкових товарів (журнали + Travel Book)
--
-- Навіщо: ці товари описані ДВІЧІ — шкала в lib/products.ts і «база плюс
-- надбавка» в products.options — і жодна копія не перевіряє іншу. Так журнал
-- з твердою обкладинкою продавав 12 сторінок за 825 ₴ замість 675 ₴
-- (TM-001202): надбавки оновили, базу забули. Ця таблиця — майбутнє єдине
-- джерело: один рядок = товар × кількість сторінок × абсолютна ціна, додавати
-- нічого не треба, зламати нічим. Точно за зразком photobook_prices, який з
-- травня жодного разу не розійшовся — бо розходитись більше нема з чим.
--
-- ВАЖЛИВО: цим кроком читання ще НЕ перемикається. Сайт далі рахує за старою
-- схемою, а таблиця живе під наглядом аудиту (lib/pricing/audit.ts, тепер він
-- звіряє всі ТРИ копії двічі на день в ops-digest). Перемикання читання —
-- окремий крок після кількох днів чистого аудиту.
--
-- Сід згенеровано скриптом зі шкал lib/products.ts (не передруковано руками)
-- і на момент міграції всі три копії збігаються до гривні — аудит по живій
-- базі: 87 тарифів, 0 розходжень.

create table if not exists page_product_prices (
    id uuid primary key default gen_random_uuid(),
    product_slug text not null,
    page_count integer not null check (page_count > 0),
    price numeric(10,2) not null check (price > 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (product_slug, page_count)
);

comment on table page_product_prices is
    'Абсолютні ціни посторінкових товарів (журнали, Travel Book). Один рядок = товар × сторінки × ціна. Майбутнє єдине джерело замість пари lib/products + products.options.';

-- Ціни публічні — їх і так видно на сайті. Запис лишається за service role:
-- RLS увімкнено, а політик на insert/update/delete немає, тож anon/auth
-- можуть тільки читати.
alter table page_product_prices enable row level security;

drop policy if exists "page_product_prices_read" on page_product_prices;
create policy "page_product_prices_read"
    on page_product_prices for select
    to anon, authenticated
    using (true);

insert into page_product_prices (product_slug, page_count, price) values
    ('personalized-glossy-magazine', 8, 525),
    ('personalized-glossy-magazine', 12, 575),
    ('personalized-glossy-magazine', 16, 725),
    ('personalized-glossy-magazine', 20, 875),
    ('personalized-glossy-magazine', 24, 1025),
    ('personalized-glossy-magazine', 28, 1175),
    ('personalized-glossy-magazine', 32, 1325),
    ('personalized-glossy-magazine', 36, 1475),
    ('personalized-glossy-magazine', 40, 1625),
    ('personalized-glossy-magazine', 44, 1775),
    ('personalized-glossy-magazine', 48, 1925),
    ('personalized-glossy-magazine', 52, 2050),
    ('personalized-glossy-magazine', 60, 2250),
    ('personalized-glossy-magazine', 72, 2550),
    ('personalized-glossy-magazine', 80, 2800),
    ('personalized-glossy-magazine', 92, 2950),
    ('personalized-glossy-magazine', 100, 3150),
    ('fotozhurnal-tverd-obkladynka', 12, 675),
    ('fotozhurnal-tverd-obkladynka', 14, 750),
    ('fotozhurnal-tverd-obkladynka', 16, 825),
    ('fotozhurnal-tverd-obkladynka', 18, 900),
    ('fotozhurnal-tverd-obkladynka', 20, 975),
    ('fotozhurnal-tverd-obkladynka', 22, 1050),
    ('fotozhurnal-tverd-obkladynka', 24, 1125),
    ('fotozhurnal-tverd-obkladynka', 26, 1200),
    ('fotozhurnal-tverd-obkladynka', 28, 1275),
    ('fotozhurnal-tverd-obkladynka', 30, 1350),
    ('fotozhurnal-tverd-obkladynka', 32, 1425),
    ('fotozhurnal-tverd-obkladynka', 34, 1500),
    ('fotozhurnal-tverd-obkladynka', 36, 1575),
    ('fotozhurnal-tverd-obkladynka', 38, 1650),
    ('fotozhurnal-tverd-obkladynka', 40, 1725),
    ('fotozhurnal-tverd-obkladynka', 42, 1800),
    ('fotozhurnal-tverd-obkladynka', 44, 1875),
    ('fotozhurnal-tverd-obkladynka', 46, 1950),
    ('fotozhurnal-tverd-obkladynka', 48, 2025),
    ('fotozhurnal-tverd-obkladynka', 50, 2075),
    ('fotozhurnal-tverd-obkladynka', 52, 2150),
    ('fotozhurnal-tverd-obkladynka', 54, 2200),
    ('fotozhurnal-tverd-obkladynka', 56, 2250),
    ('fotozhurnal-tverd-obkladynka', 58, 2300),
    ('fotozhurnal-tverd-obkladynka', 60, 2350),
    ('fotozhurnal-tverd-obkladynka', 62, 2400),
    ('fotozhurnal-tverd-obkladynka', 64, 2450),
    ('fotozhurnal-tverd-obkladynka', 66, 2500),
    ('fotozhurnal-tverd-obkladynka', 68, 2550),
    ('fotozhurnal-tverd-obkladynka', 70, 2600),
    ('fotozhurnal-tverd-obkladynka', 72, 2650),
    ('fotozhurnal-tverd-obkladynka', 74, 2700),
    ('fotozhurnal-tverd-obkladynka', 76, 2750),
    ('fotozhurnal-tverd-obkladynka', 78, 2800),
    ('fotozhurnal-tverd-obkladynka', 80, 2900),
    ('travelbook-20x30', 12, 675),
    ('travelbook-20x30', 14, 750),
    ('travelbook-20x30', 16, 825),
    ('travelbook-20x30', 18, 900),
    ('travelbook-20x30', 20, 975),
    ('travelbook-20x30', 22, 1050),
    ('travelbook-20x30', 24, 1125),
    ('travelbook-20x30', 26, 1200),
    ('travelbook-20x30', 28, 1275),
    ('travelbook-20x30', 30, 1350),
    ('travelbook-20x30', 32, 1425),
    ('travelbook-20x30', 34, 1500),
    ('travelbook-20x30', 36, 1575),
    ('travelbook-20x30', 38, 1650),
    ('travelbook-20x30', 40, 1725),
    ('travelbook-20x30', 42, 1800),
    ('travelbook-20x30', 44, 1875),
    ('travelbook-20x30', 46, 1950),
    ('travelbook-20x30', 48, 2025),
    ('travelbook-20x30', 50, 2075),
    ('travelbook-20x30', 52, 2150),
    ('travelbook-20x30', 54, 2200),
    ('travelbook-20x30', 56, 2250),
    ('travelbook-20x30', 58, 2300),
    ('travelbook-20x30', 60, 2350),
    ('travelbook-20x30', 62, 2400),
    ('travelbook-20x30', 64, 2450),
    ('travelbook-20x30', 66, 2500),
    ('travelbook-20x30', 68, 2550),
    ('travelbook-20x30', 70, 2600),
    ('travelbook-20x30', 72, 2650),
    ('travelbook-20x30', 74, 2700),
    ('travelbook-20x30', 76, 2750),
    ('travelbook-20x30', 78, 2800),
    ('travelbook-20x30', 80, 2900)
on conflict (product_slug, page_count) do update
    set price = excluded.price,
        updated_at = now()
    where page_product_prices.price is distinct from excluded.price;

-- Повторний запуск міграції не дублює і не губить: ціна оновлюється на
-- сідову ЛИШЕ якщо відрізняється, з оновленням updated_at.
