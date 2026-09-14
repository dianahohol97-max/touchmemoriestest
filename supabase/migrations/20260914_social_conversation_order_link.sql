-- Звʼязок «розмова ↔ замовлення» стає даними, а не здогадом на льоту.
--
-- НАВІЩО. У social_conversations від початку є колонки order_id і
-- customer_id, і обидві порожні в усіх 838 розмовах. Заповнити order_id уміє
-- рівно одне місце — processReceivedMessage у lib/chatbot/core.ts, коли клієнт
-- сам написав номер замовлення І бот працює в режимі автовідповіді. Режим
-- telegram_business_mode стоїть 'off' від самого підключення, тож ця гілка не
-- виконалася жодного разу.
--
-- Через це на питання «чи стосується ця розмова замовлення» система відповісти
-- не може. Єдиний працездатний звʼязок живе в lib/chatbot/client-chat-lookup.ts
-- і будується щоразу заново в інший бік: від замовлення до розмови, пошуком
-- телефону й прізвища по тексту. Для відповіді Софії цього досить, для
-- будь-якого правила зберігання — ні: не можна видаляти за ознакою, яку
-- доводиться перераховувати наосліп при кожному запиті.
--
-- ЩО ДОДАЄТЬСЯ. Три службові колонки поряд із наявними order_id та
-- customer_id, і функція, яка їх заповнює. Самі повідомлення не змінюються і
-- не видаляються — ця міграція нічого не стирає.
--
-- ЯК ЧИТАТИ РЕЗУЛЬТАТ. link_confidence каже, ЧИМ доведено звʼязок, і три його
-- значення нерівноцінні:
--   'order' — у розмові названо номер замовлення поряд зі словом-маркером
--             («замовлення TM-001194», «#TM-001239», «ТМ - 001221»);
--   'phone' — у розмові є телефон, що збігається з телефоном замовлення;
--   'name'  — у розмові є довге слово з імені клієнта, і це слово в усій базі
--             замовлень належить одній людині.
-- Порожній link_confidence означає «звʼязку НЕ ЗНАЙДЕНО», а не «клієнта тут
-- немає»: людина могла замовити на сайті й ніколи не друкувати в чаті ні
-- телефон, ні номер. Саме тому правило ретенції на цих колонках писати ще
-- зарано, і ця міграція його не вводить.
--
-- link_order_count — скільки замовлень підійшло під ту саму ознаку. Постійний
-- клієнт має їх кілька, і тоді order_id вказує на НАЙСВІЖІШЕ, а не на «те
-- саме». Число поруч існує, щоб ця неоднозначність була видима, а не
-- прихована за одним uuid.

alter table public.social_conversations
    add column if not exists link_confidence  text,
    add column if not exists link_order_count integer,
    add column if not exists linked_at        timestamptz;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'social_conversations_link_confidence_check') then
        alter table public.social_conversations add constraint social_conversations_link_confidence_check
            check (link_confidence is null or link_confidence = any (array['order', 'phone', 'name']));
    end if;
end $$;

create index if not exists social_conversations_link_confidence_idx
    on public.social_conversations using btree (link_confidence);

comment on column public.social_conversations.link_confidence is
    'Чим доведено звʼязок із замовленням: order (названо номер), phone '
    '(збігся телефон), name (рідкісне слово з імені клієнта). NULL означає '
    '«не знайдено», а не «клієнта немає».';
comment on column public.social_conversations.link_order_count is
    'Скільки замовлень підійшло під ту саму ознаку. Більше одного — постійний '
    'клієнт, і тоді order_id вказує на найсвіжіше з них.';
comment on column public.social_conversations.linked_at is
    'Коли звʼязок порахували востаннє. Порожнє поле означає, що розмову ще не '
    'проганяли матчером.';

-- Матчер. Один прохід по всіх розмовах, три сходинки в порядку надійності:
-- номер замовлення, потім телефон, потім імʼя. Перша, що спрацювала, і стає
-- відповіддю — нижча сходинка вже не розглядається.
--
-- Чому це SQL, а не TS поруч із client-chat-lookup.ts. Там матчер працює від
-- ОДНОГО замовлення і робить окремий запит на кожну спробу; тут треба навпаки —
-- пройти 66 тисяч повідомлень разом, і тягти їх через застосунок заради цього
-- немає сенсу. Логіка навмисно СУВОРІША за ту, бо результат зберігається:
-- відповідь Софії людина читає і може відкинути, а записаний у базу звʼязок
-- живе далі сам по собі.
--
-- p_apply = false (за замовчуванням) нічого не пише, а лише повертає, що
-- матчер пропонує. Прогін на бойовій базі завжди починається з нього.
-- p_name_phase вмикає третю сходинку (імʼя) — за замовчуванням вона ВИМКНЕНА.
-- Причина в перевірці на бойових даних: у зворотному напрямку, від розмови до
-- замовлення, імʼя доводить надто мало. З двадцяти двох знайдених збігів добра
-- половина була хибною, бо в чаті звучить не лише імʼя самого клієнта: фотограф
-- диктує дані своїх замовниць, людина замовляє книгу в подарунок і пише чуже
-- прізвище для накладної. Найгірший випадок — розмова «Фотограф Ксенія Чала» на
-- три тисячі повідомлень, яку матчер звʼязав із двадцятьма різними замовленнями.
-- Тому фаза лишається доступною для ручного перегляду (p_name_phase = true,
-- p_apply = false), але автоматично в базу не пишеться.
create or replace function public.link_social_conversations(p_apply boolean default false, p_name_phase boolean default false)
returns table (
    conversation_id  uuid,
    external_username text,
    messages         bigint,
    link_confidence  text,
    order_id         uuid,
    order_number     text,
    link_order_count integer,
    customer_id      uuid
)
language plpgsql
set search_path to 'public'
as $fn$
-- Імена вихідних полів функції (conversation_id, order_id, customer_id) збігаються
-- з іменами колонок у запиті нижче, і plpgsql за замовчуванням вважає їх своїми
-- змінними — запит падає з «column reference is ambiguous». Директива каже
-- вирішувати збіг на користь КОЛОНКИ; вихідні поля й так заповнюються через
-- return query з явними псевдонімами.
#variable_conflict use_column
begin
    create temporary table tmp_conversation_links on commit drop as
    with ord as (
        select o.id,
               o.order_number,
               o.created_at,
               o.customer_id,
               regexp_replace(o.order_number, '\D', '', 'g') as digits,
               right(regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g'), 9) as phone_key,
               lower(coalesce(o.customer_name, '')) as name_lc
        from public.orders o
    ),
    -- Телефон у чаті пишуть як завгодно: «+380 67 123 45 67», «067-123-45-67»,
    -- «(067) 1234567». Чотири проходи прибирають роздільники САМЕ МІЖ цифрами,
    -- не чіпаючи решту тексту, і тільки після цього шукається суцільний номер.
    -- Без цього кроку губиться близько сорока пʼяти розмов із пʼятисот.
    norm as (
        select m.conversation_id,
               regexp_replace(regexp_replace(regexp_replace(regexp_replace(
                   m.original_text, '(\d)[\s\-().]+(\d)', '\1\2', 'g'),
                   '(\d)[\s\-().]+(\d)', '\1\2', 'g'),
                   '(\d)[\s\-().]+(\d)', '\1\2', 'g'),
                   '(\d)[\s\-().]+(\d)', '\1\2', 'g') as t
        from public.social_messages m
        where m.original_text is not null
    ),
    -- Сходинка 1. Номер замовлення — але ТІЛЬКИ біля слова-маркера. Голі пʼять
    -- цифр брати не можна: «Чернігів Укрпошта 14005» це поштовий індекс, а не
    -- замовлення CRM-14005, і саме на цьому попередній, вільніший варіант
    -- матчера дав два хибні збіги з тридцяти шести.
    num_tok as (
        select distinct m.conversation_id, t.arr[1] as tok
        from public.social_messages m
        cross join (values
            ('(?:tm|тм|crm|срм)[\s\-–—#№:.]*([0-9]{4,6})'),
            ('(?:замовленн|заказ|заявк)[^0-9]{0,25}([0-9]{5,6})'),
            ('[#№][\s]*([0-9]{5,6})')
        ) as p(re)
        cross join lateral regexp_matches(lower(m.original_text), p.re, 'g') as t(arr)
        where m.original_text is not null
    ),
    by_number as (
        select nt.conversation_id, o.id as order_id, o.order_number, o.created_at, o.customer_id
        from num_tok nt
        join ord o on o.digits = nt.tok or ltrim(o.digits, '0') = ltrim(nt.tok, '0')
    ),
    number_pick as (
        select distinct on (conversation_id)
               conversation_id, order_id, order_number, customer_id,
               count(*) over (partition by conversation_id)::int as n
        from by_number
        order by conversation_id, created_at desc
    ),
    -- Сходинка 2. Телефон. Останні девʼять цифр — щоб «0677546059» і
    -- «677546059» були одним номером, як і в TS-матчері.
    phone_hit as (
        select distinct n.conversation_id, right(m.arr[1], 9) as phone_key
        from norm n
        cross join lateral regexp_matches(n.t, '\d{9,13}', 'g') as m(arr)
    ),
    by_phone as (
        select ph.conversation_id, o.id as order_id, o.order_number, o.created_at, o.customer_id
        from phone_hit ph
        join ord o on o.phone_key = ph.phone_key and o.phone_key <> ''
        where ph.conversation_id not in (select conversation_id from number_pick)
    ),
    phone_pick as (
        select distinct on (conversation_id)
               conversation_id, order_id, order_number, customer_id,
               count(*) over (partition by conversation_id)::int as n
        from by_phone
        order by conversation_id, created_at desc
    ),
    -- Сходинка 3. Імʼя. Слово від шести літер, яке в усій базі замовлень
    -- належить ОДНІЙ людині (одному телефону) і трапляється щонайбільше у двох
    -- розмовах. Дві «Олени» тут не звʼяжуться ніяк — і не мають.
    name_tok as (
        select t.arr[1] as tok, o.phone_key
        from ord o
        cross join lateral regexp_matches(o.name_lc, '[а-яіїєґ''ʼa-z-]{6,}', 'g') as t(arr)
        where o.phone_key <> ''
    ),
    uniq_tok as (
        select tok from name_tok group by tok having count(distinct phone_key) = 1
    ),
    conv_word as (
        select distinct m.conversation_id, w.arr[1] as tok
        from public.social_messages m
        cross join lateral regexp_matches(lower(m.original_text), '[а-яіїєґ''ʼa-z-]{6,}', 'g') as w(arr)
        where p_name_phase
          and m.original_text is not null
          and m.conversation_id not in (select conversation_id from number_pick)
          and m.conversation_id not in (select conversation_id from phone_pick)
    ),
    name_hit as (
        select cw.conversation_id, cw.tok
        from conv_word cw
        join uniq_tok u on u.tok = cw.tok
    ),
    rare_tok as (
        select tok from name_hit group by tok having count(distinct conversation_id) <= 2
    ),
    by_name as (
        select nh.conversation_id, o.id as order_id, o.order_number, o.created_at, o.customer_id
        from name_hit nh
        join rare_tok r on r.tok = nh.tok
        join name_tok nt on nt.tok = nh.tok
        join ord o on o.phone_key = nt.phone_key
    ),
    name_pick as (
        select distinct on (conversation_id)
               conversation_id, order_id, order_number, customer_id,
               count(*) over (partition by conversation_id)::int as n
        from by_name
        order by conversation_id, created_at desc
    ),
    picked as (
        select conversation_id, 'order'::text as confidence, order_id, order_number, n, customer_id from number_pick
        union all
        select conversation_id, 'phone', order_id, order_number, n, customer_id from phone_pick
        union all
        select conversation_id, 'name',  order_id, order_number, n, customer_id from name_pick
    )
    select c.id                                            as conversation_id,
           c.external_username                             as external_username,
           (select count(*) from public.social_messages m where m.conversation_id = c.id) as messages,
           p.confidence                                    as link_confidence,
           p.order_id                                      as order_id,
           p.order_number                                  as order_number,
           p.n                                             as link_order_count,
           coalesce(p.customer_id, cu.id)                  as customer_id
    from public.social_conversations c
    left join picked p on p.conversation_id = c.id
    -- Акаунт клієнта беремо з картки замовлення, а як його там немає (а немає
    -- він у 1015 замовленнях з 1107, бо дзеркало KeyCRM його не несе) — за тим
    -- самим телефоном із таблиці customers.
    left join lateral (
        select cust.id from public.customers cust
        where p.order_id is not null
          and right(regexp_replace(coalesce(cust.phone, ''), '\D', '', 'g'), 9) =
              (select right(regexp_replace(coalesce(o2.customer_phone, ''), '\D', '', 'g'), 9)
               from public.orders o2 where o2.id = p.order_id)
          and length(regexp_replace(coalesce(cust.phone, ''), '\D', '', 'g')) >= 9
        limit 1
    ) cu on true;

    if p_apply then
        -- coalesce, а не просте присвоєння: якщо звʼязок колись проставить
        -- processReceivedMessage (клієнт назвав номер у режимі автовідповіді),
        -- прогін матчера не має його стерти лише тому, що сам нічого не знайшов.
        update public.social_conversations c
        set order_id         = coalesce(t.order_id, c.order_id),
            customer_id      = coalesce(t.customer_id, c.customer_id),
            link_confidence  = t.link_confidence,
            link_order_count = t.link_order_count,
            linked_at        = now()
        from tmp_conversation_links t
        where c.id = t.conversation_id;
    end if;

    return query select t.conversation_id, t.external_username, t.messages, t.link_confidence,
                        t.order_id, t.order_number, t.link_order_count, t.customer_id
                 from tmp_conversation_links t;
end;
$fn$;

comment on function public.link_social_conversations(boolean, boolean) is
    'Проганяє всі розмови через сходинки «номер замовлення» і «телефон», а за '
    'p_name_phase = true ще й через «імʼя», і повертає запропоновані звʼязки. '
    'Пише в таблицю лише при p_apply = true. Нічого не видаляє.';

-- Писати може тільки той, хто ходить сервісним ключем або сидить у SQL-редакторі.
revoke all on function public.link_social_conversations(boolean, boolean) from public;
revoke all on function public.link_social_conversations(boolean, boolean) from anon, authenticated;
