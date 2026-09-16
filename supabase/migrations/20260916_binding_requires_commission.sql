-- Привʼязка клієнта не існує окремо від нарахування (Діана, 16.09.2026).
--
-- ЩО БУЛО НЕ ТАК. У processAgencyCommission привʼязка в partner_client_bindings
-- створювалася РАНІШЕ, ніж перевірялося `totalCommission > 0`, і між цими двома
-- діями не було нічого спільного: ні транзакції, ні спільної умови. Тому будь-
-- який потік із незнайомою формою позиції, де сума позицій зчитується як нуль,
-- лишав по собі напівстан — клієнт закріплений за партнером НАЗАВЖДИ, а
-- нарахування немає ні партнеру, ні його менеджеру, ні рядком у журналі.
--
-- Це не теорія. 16.09.2026 потік «з дизайнером» писав ціну позиції в полі
-- `price`, якого читач не знав, і замовлення TM-001326 дало б рівно такий
-- напівстан, якби ваду не знайшли до кліку. Латка тоді навчила читача третій
-- назві ціни, але сама пастка лишилася: наступна незнайома форма позиції
-- відтворила б усе те саме.
--
-- ЧОМУ ФУНКЦІЯ В БАЗІ, А НЕ ПОСЛІДОВНІСТЬ ВИКЛИКІВ У КОДІ. Дві вставки в різні
-- таблиці з клієнта не можуть бути атомарними: процес помирає між ними, мережа
-- рве другий запит, PostgREST відповідає помилкою — і привʼязка лишається без
-- пари. Тіло функції виконується в одній транзакції, тож якщо вставка
-- нарахування впаде з будь-якої причини, вставка привʼязки відкотиться разом із
-- нею. Іншого способу отримати цю гарантію через PostgREST немає.
--
-- ДЕ ПРОХОДИТЬ МЕЖА. Функція НЕ вирішує, чи партнер має право на комісію —
-- самореферал і неактивний партнер відсіюються в коді ще до виклику, і туди
-- справа просто не доходить. Не вирішує вона й того, чи сума позицій
-- достовірна: це теж робить код, бо тільки він бачить сирі позиції. Функція
-- відповідає рівно за одне — за те, щоб привʼязка і нарахування або зʼявилися
-- разом, або не зʼявилися зовсім.
--
-- ЗАКОННИЙ НУЛЬ — ОКРЕМИЙ ВИПАДОК, і він тут дозволений свідомо. Партнер зі
-- ставками 0% або замовлення на нульову суму дають нуль не через ваду, а по
-- суті. Клієнт при цьому справжній, і наступні його замовлення мають приносити
-- комісію, тож привʼязка створюється, а рядка нарахування немає. Код передає
-- сюди нуль тільки тоді, коли впевнений, що нуль законний.

create or replace function public.record_agency_commission(
  p_agency_id            uuid,
  p_order_id             uuid,
  p_email                text,
  p_travelbook_subtotal  numeric,
  p_other_subtotal       numeric,
  p_travelbook_commission numeric,
  p_other_commission     numeric,
  p_total_commission     numeric
)
returns table (bound_now boolean, commission_inserted boolean, kind text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows     integer;
  v_bound    boolean := false;
  v_inserted boolean := false;
  v_kind     text;
begin
  -- Привʼязка. Первинний ключ по пошті і є правилом «створюється один раз»:
  -- пізніший перехід за чужим посиланням нічого не перезаписує, і перевірка
  -- перед вставкою для цього не потрібна — вона програла б гонці двох
  -- одночасних оплат, а ключ ні.
  if p_email is not null and p_email <> '' then
    insert into partner_client_bindings (email, partner_id, first_order_id)
    values (p_email, p_agency_id, p_order_id)
    on conflict (email) do nothing;
    get diagnostics v_rows = row_count;
    v_bound := v_rows > 0;
  end if;

  -- «Новий клієнт» — це замовлення, яке щойно створило привʼязку. Усе інше
  -- приходить від клієнта, якого партнер привів раніше: привести людину і
  -- отримати від неї повторне замовлення — різна робота, і в кабінеті це
  -- різні рядки.
  v_kind := case when v_bound then 'new_client' else 'repeat' end;

  if p_total_commission > 0 then
    insert into agency_commissions (
      agency_id, order_id,
      travelbook_subtotal, other_subtotal,
      travelbook_commission, other_commission, total_commission,
      payout_status, kind
    )
    values (
      p_agency_id, p_order_id,
      p_travelbook_subtotal, p_other_subtotal,
      p_travelbook_commission, p_other_commission, p_total_commission,
      'pending', v_kind
    )
    on conflict (order_id) do nothing;
    get diagnostics v_rows = row_count;
    v_inserted := v_rows > 0;

    -- Конфлікт по UNIQUE(order_id) означає, що це замовлення вже зараховане
    -- іншим викликом — тобто нарахування існує, просто не наше. Привʼязку в
    -- цьому разі лишаємо: вона парна до того, вже наявного рядка. А от
    -- справжня помилка вставки сюди не дійде — вона підніме виняток і відкотить
    -- транзакцію разом із привʼязкою, заради чого функція й написана.
  end if;

  -- Зведення партнера похідне від журналу, тож перераховуємо його в тій самій
  -- транзакції: інакше процес, що помер між вставкою і перерахунком, лишив би
  -- в кабінеті суму меншу за фактичну.
  if v_inserted then
    perform recalc_agency_partner_totals(p_agency_id);
  end if;

  return query select v_bound, v_inserted, v_kind;
end;
$$;

-- security definer, тож доступ звужений до службової ролі: ні анонім, ні
-- залогінений клієнт не мають діставати нічого, що пише в журнал комісій.
revoke all on function public.record_agency_commission(uuid, uuid, text, numeric, numeric, numeric, numeric, numeric) from public, anon, authenticated;
grant execute on function public.record_agency_commission(uuid, uuid, text, numeric, numeric, numeric, numeric, numeric) to service_role;
