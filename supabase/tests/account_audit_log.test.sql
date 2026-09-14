-- Тест обмежень account_audit_log.
--
-- Навіщо окремий SQL-файл. Головне правило цієї таблиці живе тільки в базі:
-- CHECK забороняє зберігати customer_id у рядку про видалення акаунта. Саме в
-- цьому суть таблиці — не записати ідентифікатор людини, яка попросила свої
-- дані стерти, — і саме такі правила ламають найтихіше: хтось дописує
-- customer_id «для зручності», ніхто не помічає, а vitest бази не бачить.
--
-- Як запускати. Файл створює рядки у ТИМЧАСОВІЙ транзакції і відкочує її, тож
-- на проді нічого не лишає. Виконати можна в SQL-редакторі Supabase або через
-- psql. Успіх — напис у кінці; будь-яка розбіжність зупиняє виконання
-- винятком.

do $$
declare
    v_customer uuid;
    v_ok boolean;
begin
    -- Будь-який наявний клієнт, щоб FK не заважав перевіряти саме те, що
    -- перевіряємо. Якщо клієнтів немає взагалі, частину з посиланням
    -- пропускаємо чесно, а не підмінюємо вигаданим uuid.
    select id into v_customer from public.customers limit 1;

    -- 1. Вивантаження даних МОЖЕ нести посилання на акаунт.
    if v_customer is not null then
        begin
            insert into public.account_audit_log (event_type, customer_id)
            values ('data_export', v_customer);
        exception when others then
            raise exception 'data_export із customer_id мусить проходити, а не «%»', sqlerrm;
        end;
    end if;

    -- 2. Видалення акаунта МОЖЕ бути записане без жодного посилання.
    begin
        insert into public.account_audit_log (event_type) values ('account_deletion');
    exception when others then
        raise exception 'account_deletion без customer_id мусить проходити, а не «%»', sqlerrm;
    end;

    -- 3. Видалення акаунта з посиланням на акаунт — заборонено. Це і є те
    --    правило, заради якого таблиця існує окремо від consent_log.
    if v_customer is not null then
        v_ok := false;
        begin
            insert into public.account_audit_log (event_type, customer_id)
            values ('account_deletion', v_customer);
        exception when check_violation then
            v_ok := true;
        end;
        if not v_ok then
            raise exception 'account_deletion із customer_id мусив бути відхилений CHECK-ом, але пройшов';
        end if;
    end if;

    -- 4. Чужий тип події не приймається: словник закритий, і нова подія має
    --    зʼявлятися міграцією, а не довільним рядком із коду.
    v_ok := false;
    begin
        insert into public.account_audit_log (event_type) values ('marketing_accepted');
    exception when check_violation then
        v_ok := true;
    end;
    if not v_ok then
        raise exception 'невідомий event_type мусив бути відхилений CHECK-ом, але пройшов';
    end if;

    -- Нічого з написаного вище не має лишитися в таблиці.
    raise exception 'ROLLBACK_OK';
exception
    when others then
        if sqlerrm = 'ROLLBACK_OK' then
            raise notice 'account_audit_log: усі перевірки пройдено, тестові рядки відкочено';
        else
            raise;
        end if;
end $$;
