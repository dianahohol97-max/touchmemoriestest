-- Кандидат на прив'язку гостьового замовлення до акаунта.
--
-- Проблема. customer_id ставиться рівно в одному місці — у /api/orders/submit,
-- і лише якщо на момент оформлення є сесія. Немає сесії, поле лишається
-- порожнім назавжди: механізму прив'язки заднім числом не існує ніде, і
-- реєстрація таблицю orders не чіпає жодним рядком.
--
-- Наслідок на 14.09.2026: 64 зареєстровані клієнти мають у картці нуль
-- замовлень, хоча купували на 69 510 грн, ще у двох історія розділена навпіл.
-- І це не «купили до реєстрації»: 71 із 72 замовлень зроблені ПІСЛЯ неї, у
-- середньому через 3,2 дня. Люди мають акаунт і оформлюють не залогіненими.
--
-- Чому не просто проставити customer_id за поштою. Бо пошта не доказ: родина
-- ділить одну адресу, і в базі це вже є. З акаунта «Svitlana Krasnova»
-- систематично замовляє «Ірина Байдакова», а з «Julia Savkiv» приходили
-- замовлення на «Савків Наталія», де прізвище те саме, а ім'я інше. Прив'язати
-- такі означає показати людині в кабінеті чужі покупки з чужими адресами
-- доставки.
--
-- Рішення: правило в lib/customers/name-match.ts прив'язує лише за позитивним
-- доказом тотожності, а все сумнівне лишає менеджерові. Колонки нижче і є
-- те місце, де сумнівне чекає на рішення людини.

alter table public.orders
    add column if not exists link_candidate_customer_id uuid
        references public.customers(id) on delete set null,
    add column if not exists link_candidate_at timestamptz,
    add column if not exists link_candidate_reason text,
    add column if not exists link_review_rejected_at timestamptz;

comment on column public.orders.link_candidate_customer_id is
    'Акаунт, до якого це гостьове замовлення СХОЖЕ, але доказу забракло. '
    'Прив''язкою НЕ є: customer_id лишається порожнім, доки менеджер не '
    'підтвердить. Ставиться при реєстрації клієнта з тією самою поштою.';

comment on column public.orders.link_candidate_reason is
    'Чому правило не прив''язало само — текст із matchCustomerName(). '
    'Менеджер має бачити причину, а не гадати.';

comment on column public.orders.link_review_rejected_at is
    'Менеджер сказав «це не та сама людина». Замовлення більше не потрапляє '
    'до списку на перевірку і не пропонується знову.';

-- Індекс саме під список у адмінці: відкриті кандидати, найновіші згори.
-- Частковий, бо таких рядків завжди буде жменя проти всієї таблиці.
create index if not exists orders_link_candidate_open_idx
    on public.orders (link_candidate_at desc)
    where customer_id is null
      and link_candidate_customer_id is not null
      and link_review_rejected_at is null;
