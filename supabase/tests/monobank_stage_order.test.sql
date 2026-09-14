-- Тест правила порядку стадій Monobank.
--
-- Навіщо окремий SQL-файл. Правило живе тільки в базі — у mono_stage_rank()
-- і в умові apply_monobank_payment, — а vitest бази не бачить. Двійник на
-- TypeScript був би не страховкою, а другим джерелом правди: рівно так уже
-- розійшлися дві копії правила «оплачено повністю», і їх довелося зшивати
-- назад тестом. Тому перевірка написана там, де живе саме правило.
--
-- Як запускати. Файл нічого не змінює і безпечний на проді: він читає
-- функції, а таблиці не чіпає. Виконати можна в SQL-редакторі Supabase або
-- через psql. Успіх — жодного рядка у виводі і напис у кінці; будь-яка
-- розбіжність зупиняє виконання винятком із назвою переходу.
--
-- Що саме захищається. 13.09.2026 подія 'processing' прийшла через 47 мс
-- після 'success', пройшла умову «пара відрізняється» і повернула оплачене
-- замовлення TM-001087 у 'pending'. Гроші були отримані, а система рахувала
-- його неоплаченим.

do $$
declare
    r record;
    v_got boolean;
begin
    -- Ранги самі по собі. Числа з проміжками, тож тест пильнує ПОРЯДОК, а не
    -- конкретні значення: поміняти 20 на 25 можна, поміняти місцями success і
    -- failure — ні.
    if not (public.mono_stage_rank('created') < public.mono_stage_rank('processing')) then
        raise exception 'created має бути раніше за processing';
    end if;
    if not (public.mono_stage_rank('processing') < public.mono_stage_rank('hold')) then
        raise exception 'processing має бути раніше за hold';
    end if;
    -- Найважливіша пара в усьому файлі. Якби failure стояв на одному ранзі зі
    -- success, умова «не менший» пропустила б провал після успіху і зробила б
    -- оплачене замовлення проваленим — той самий дефект дзеркально.
    if not (public.mono_stage_rank('failure') < public.mono_stage_rank('success')) then
        raise exception 'failure мусить бути НИЖЧЕ за success, інакше провал перезапише оплату';
    end if;
    if not (public.mono_stage_rank('expired') < public.mono_stage_rank('success')) then
        raise exception 'expired мусить бути НИЖЧЕ за success';
    end if;
    -- Повернення коштів законно приходить після оплати і мусить застосуватися.
    if not (public.mono_stage_rank('reversed') > public.mono_stage_rank('success')) then
        raise exception 'reversed мусить бути ВИЩЕ за success, інакше повернення не застосується';
    end if;
    -- Невідома стадія не має мовчки відкидати платіж.
    if public.mono_stage_rank('щось нове') <> 0 then
        raise exception 'невідома стадія має давати 0, щоб подія застосувалася';
    end if;
    if public.mono_stage_rank(null) <> 0 then
        raise exception 'null має давати 0';
    end if;

    -- Сама умова, у тому ж вигляді, у якому вона стоїть у
    -- apply_monobank_payment. Перебираються всі переходи, які має сенс
    -- перевіряти, разом з очікуваною відповіддю.
    for r in
        select * from (values
            -- Після успішної оплати назад не відкочуємося нікуди, крім повернення.
            ('success',    'processing', false),
            ('success',    'created',    false),
            ('success',    'hold',       false),
            ('success',    'failure',    false),
            ('success',    'expired',    false),
            ('success',    'reversed',   true),
            -- Рух уперед застосовується завжди.
            ('created',    'processing', true),
            ('created',    'expired',    true),
            ('processing', 'hold',       true),
            ('processing', 'success',    true),
            ('processing', 'failure',    true),
            ('hold',       'success',    true),
            -- Невдала спроба, яку клієнт повторив і вона пройшла.
            ('failure',    'success',    true),
            ('expired',    'success',    true),
            -- Повернення остаточне.
            ('reversed',   'success',    false),
            ('reversed',   'processing', false),
            -- Стадії ще немає — застосовується будь-що.
            (null,         'created',    true),
            (null,         'success',    true)
        ) as t(stored, incoming, want)
    loop
        v_got := (
            r.stored is distinct from r.incoming
            and case
                  when r.stored = 'success' then r.incoming = 'reversed'
                  else public.mono_stage_rank(r.incoming)
                       >= public.mono_stage_rank(r.stored)
                end
        );
        if v_got is distinct from r.want then
            raise exception 'Перехід % -> %: очікували %, отримали %',
                coalesce(r.stored, '(немає)'), r.incoming, r.want, v_got;
        end if;
    end loop;

    -- Інший інвойс рангу не перевіряє взагалі. Це окрема гілка умови в
    -- apply_monobank_payment, і без неї перевиставлене посилання на оплату
    -- було б зламане: воно починається зі стадії created з рангом 10, і
    -- порівняння зі старим success відкинуло б усі події нової спроби.
    if not ('INV-НОВИЙ' is distinct from 'INV-СТАРИЙ') then
        raise exception 'перевірка нового інвойсу написана неправильно';
    end if;

    raise notice 'monobank_stage_order: усі перевірки пройдено';
end $$;
