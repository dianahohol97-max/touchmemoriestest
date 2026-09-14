-- Порядок стадій оплати Monobank: пізніший стан не можна перезаписати ранішим.
--
-- Проблема. Замовлення TM-001087 від 25 липня має paid_at із того ж дня і
-- payment_status = 'pending'. Гроші 2290 ₴ отримані, а система рахує його
-- неоплаченим: світлофор оплати показує червоне, фільтр «Потребує уваги»
-- тягне його менеджерові, і після переходу на заявку paid_at is null лист про
-- оплату такому замовленню вже не піде ніколи.
--
-- Причина, видима в історії замовлення з точністю до мілісекунд:
--
--   11:51:17.567  Оплата успішна через Monobank   → payment_status = 'paid'
--   11:51:17.614  Оплата в обробці                → payment_status = 'pending'
--
-- Monobank надіслав 'success' і 'processing' майже одночасно, і 'processing'
-- приїхав другим. Умова у apply_monobank_payment питала рівно одне — чи
-- ВІДРІЗНЯЄТЬСЯ пара (інвойс, статус) від збереженої:
--
--   and (monobank_invoice_id is null
--        or monobank_invoice_id <> p_invoice_id
--        or monobank_invoice_status is distinct from p_invoice_status)
--
-- Поняття «пізніше» там не було взагалі. 'processing' відрізняється від
-- 'success', умова проходить, і далі йде беззастережний запис
-- payment_status = p_payment_status, а у вебхуку 'processing' означає
-- 'pending'. Оплачене замовлення стає неоплаченим.
--
-- Слід лишається видимим через асиметрію в тій самій функції: paid_at
-- захищений виразом case when p_set_paid_at then now() else paid_at end і не
-- скидається ніколи, а payment_status не захищений нічим.
--
-- Масштаб на момент виправлення: гонка спрацювала на семи замовленнях,
-- чотири досі несуть чужу стадію інвойсу, одне з них — ще й чужий статус
-- оплати. Дані виправлені в кінці цього файла.

-- 1. Ранг стадії.
--
-- Числа з проміжками, щоб між ними можна було щось вставити, не переписуючи
-- решту. Невідомий статус і NULL дають 0, тобто нове значення застосовується:
-- краще записати незнайому стадію, ніж мовчки відкинути платіж.
--
-- 'reversed' стоїть ВИЩЕ за 'success' навмисно — повернення коштів законно
-- приходить після успішної оплати і мусить застосуватися.
--
-- 'failure' і 'expired' стоять НИЖЧЕ за 'success', а не поряд. Якби вони були
-- на одному ранзі, умова «не менший» пропустила б 'failure' після 'success' і
-- зробила б оплачене замовлення проваленим — той самий дефект дзеркально.
create or replace function public.mono_stage_rank(p_status text)
returns integer
language sql
immutable
as $$
    select case p_status
        when 'created'    then 10
        when 'processing' then 20
        when 'hold'       then 30
        when 'expired'    then 35
        when 'failure'    then 35
        when 'success'    then 40
        when 'reversed'   then 50
        else 0
    end;
$$;

comment on function public.mono_stage_rank(text) is
    'Порядок стадій інвойсу Monobank. Чим більше число, тим пізніша стадія. '
    'Використовує apply_monobank_payment, щоб подія, яка прийшла не в тому '
    'порядку, не відкотила оплату назад.';

-- 2. Функція оновлення з урахуванням порядку.
--
-- Змінилася ТІЛЬКИ умова where; тіло update лишилося як було.
--
-- Три гілки умови:
--
--   а) інвойса ще немає — застосувати;
--
--   б) інвойс ІНШИЙ — застосувати без перевірки рангу. Це нова спроба оплати:
--      перевиставлене посилання починається зі стадії 'created' з рангом 10, і
--      порівняння з попереднім 'success' відкинуло б її. Саме тому гілка
--      окрема, а не об'єднана з наступною;
--
--   в) той самий інвойс — застосувати, лише якщо стадія не ранішa за
--      збережену. Для 'success' діє окреме, суворіше правило: після успішної
--      оплати назад не відкочуємося нікуди, крім повернення коштів. Правило
--      явне, а не виведене з рангів, бо воно про гроші і має читатися з коду
--      без підрахунку чисел.
create or replace function public.apply_monobank_payment(
    p_order_id uuid,
    p_payment_status text,
    p_invoice_id text,
    p_invoice_status text,
    p_approval_code text default null,
    p_rrn text default null,
    p_set_paid_at boolean default false,
    p_paid_amount numeric default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  update public.orders
  set payment_status = p_payment_status,
      monobank_invoice_id = p_invoice_id,
      monobank_invoice_status = p_invoice_status,
      monobank_approval_code = coalesce(p_approval_code, monobank_approval_code),
      monobank_rrn = coalesce(p_rrn, monobank_rrn),
      paid_at = case when p_set_paid_at then now() else paid_at end,
      paid_amount = case when p_paid_amount is null then paid_amount else p_paid_amount end,
      updated_at = now()
  where id = p_order_id
    and (
      monobank_invoice_id is null
      or monobank_invoice_id <> p_invoice_id
      or (
        monobank_invoice_status is distinct from p_invoice_status
        and case
              when monobank_invoice_status = 'success'
                then p_invoice_status = 'reversed'
              else public.mono_stage_rank(p_invoice_status)
                   >= public.mono_stage_rank(monobank_invoice_status)
            end
      )
    )
  returning id into v_id;

  return v_id;
end;
$function$;

comment on function public.apply_monobank_payment is
    'Застосовує подію оплати Monobank до замовлення. Повертає id лише тому '
    'виклику, який виграв гонку; решта отримує NULL і виходить із '
    'idempotent. Подія, яка описує РАНІШУ стадію за вже збережену, не '
    'застосовується — саме так оплачене замовлення ставало неоплаченим.';

-- 3. Виправлення історичних рядків.
--
-- УВАГА: нижче РЕКОНСТРУКЦІЯ, а не зафіксовані дані. Оригінальні події
-- Monobank у нас не збережені, а дістати суму з їхнього API постфактум не
-- вдалося. Підстави для кожного значення названі окремо.
--
-- Стадія інвойсу. Чотирьом замовленням повертається 'success': кожне має в
-- історії подію «Оплата успішна через Monobank», після якої приїхала
-- 'processing' і перезаписала стадію. У трьох із них payment_status і
-- paid_amount не постраждали, тож виправляється лише стадія.
update public.orders
   set monobank_invoice_status = 'success',
       updated_at = now()
 where order_number in ('TM-001043', 'TM-001112', 'TM-001151')
   and monobank_invoice_status = 'processing'
   and paid_at is not null;

-- TM-001087 — єдине, де постраждав і статус оплати, і сума.
--
-- payment_status = 'paid': подія «Оплата успішна через Monobank» у історії є,
-- paid_at проставлений, замовлення підтверджене.
--
-- paid_amount = 2290.00, тобто total. Це НЕ довільний вибір і не «взяли
-- звідки було»:
--
--   * замовлення не 50/50 (payment_type порожній, prepaid_amount = 0,
--     cod_amount = 0), тож платіж міг бути лише на повну суму;
--   * вебхук відмовляє платежу, сума якого розходиться з очікуваною більш ніж
--     на одну копійку, і повертає 400, не торкаючись замовлення. Успішна
--     подія для цього інвойсу була ОПРАЦЬОВАНА, отже Monobank списав рівно
--     2290.00 ± 0.01;
--   * рівно за цим правилом (when payment_status = 'paid' then total)
--     заповнення з міграції 20260913_orders_paid_amount проставило суму всім
--     іншим повністю оплаченим сайтовим замовленням. Нуль тут стоїть саме
--     тому, що на момент заповнення статус був зіпсований цим дефектом.
update public.orders
   set payment_status = 'paid',
       monobank_invoice_status = 'success',
       paid_amount = total,
       updated_at = now()
 where order_number = 'TM-001087'
   and payment_status = 'pending'
   and paid_at is not null;

-- Слід у історії замовлення, щоб через півроку було видно, звідки взялися ці
-- значення і що вони реконструйовані.
insert into public.order_history (order_id, action, notes, added_by)
select id,
       'payment_status_changed',
       'Виправлено вручну міграцією 20260914_monobank_stage_order: подія '
       || 'Monobank «в обробці» прийшла після «успішно» і перезаписала стан. '
       || 'Статус і сума відновлені за фактом успішного платежу, сума — '
       || 'реконструкція за сумою замовлення.',
       null
  from public.orders
 where order_number in ('TM-001043', 'TM-001087', 'TM-001112', 'TM-001151');
