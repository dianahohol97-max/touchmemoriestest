-- orders.paid_amount — скільки грошей за замовлення реально отримано.
--
-- Проблема: такої величини в схемі не було взагалі, і кожен, кому вона була
-- потрібна, виводив її по-своєму. `prepaid_amount` на цю роль не годиться, бо
-- означає різне залежно від походження замовлення:
--
--   * source='site' — це ПЛАНОВА передоплата. Чекаут пише туди суму в мить
--     створення рахунку Monobank, ще до того, як клієнт відкрив сторінку
--     оплати. На 52 несплачених сайтових замовленнях там нуль, на оплачених
--     повна сума, і жодне з цих чисел не є квитанцією.
--   * source='keycrm' — це РЕАЛЬНО отримані гроші: дзеркало пише туди
--     payments_total із CRM (lib/automation/keycrm-mirror.ts). Саме тому 234
--     дзеркалених замовлення зі статусом pending мають там суму між нулем і
--     total — це справжні часткові оплати.
--
-- Наслідок: статус оплати в адмінці був двостанним, бо порахувати «оплачено
-- частково» не було звідки. lib/automation/keycrm-money.ts уже містить чесне
-- правило, але воно живе лише в мосту до KeyCRM і на часткових оплатах
-- CRM-замовлень віддає нуль, бо в них cod_amount порожній.
--
-- Рішення: окрема колонка, яку пишуть усі шляхи надходження грошей, і з якої
-- рахується бейдж. payment_status лишається як є — його читає надто багато
-- місць, щоб міняти семантику разом із цим.

alter table public.orders
    add column if not exists paid_amount numeric not null default 0;

comment on column public.orders.paid_amount is
    'Реально отримані гроші за замовлення, у гривні. Пишуть: вебхук Monobank, '
    'дзеркало KeyCRM, ручне редагування в адмінці. НЕ плутати з prepaid_amount — '
    'той на сайтових замовленнях є планом, а не квитанцією.';

-- Заповнення наявних рядків за тим самим правилом, яке описує keycrm-money.ts.
-- Скасовані замовлення навмисно НЕ обнуляються: гроші, які колись надійшли,
-- лишаються фактом, а бейдж і так покаже «Скасовано». Обнуляється тільки
-- повернення, бо там гроші фізично пішли назад.
update public.orders
   set paid_amount = case
        when payment_status = 'refunded' then 0
        -- Дзеркало CRM: prepaid_amount тут і є отримана сума.
        when source = 'keycrm' then greatest(0, coalesce(prepaid_amount, 0))
        -- Сайт, 50/50: передоплата зараховується лише коли вона справді
        -- пройшла, накладений — лише коли кур'єр розрахувався.
        when payment_type = 'split' then
             (case when payment_status = 'paid' then coalesce(prepaid_amount, 0) else 0 end)
           + (case when cod_received_at is not null then coalesce(cod_amount, 0) else 0 end)
        -- Сайт, звичайна оплата: або все, або нічого.
        when payment_status = 'paid' then coalesce(total, 0)
        else 0
   end;

create index if not exists orders_paid_amount_idx
    on public.orders (paid_amount);

-- Вебхук Monobank оновлює замовлення через цю функцію, а не прямим update:
-- кеш схеми PostgREST періодично протухає і тоді ламає ВСІ підтвердження
-- оплат. Сума тепер їде сюди параметром, а не рахується в SQL, бо правило
-- «скільки саме списали» живе в маршруті (split платить prepaid_amount, решта
-- повну суму) і дублювати його в базі означало б дати йому розійтися.
--
-- p_paid_amount = NULL лишає paid_amount без змін. Це навмисно: старий код із
-- сімома аргументами далі резолвиться в цю ж функцію через DEFAULT, тож між
-- міграцією і деплоєм нічого не падає.
drop function if exists public.apply_monobank_payment(uuid, text, text, text, text, text, boolean);

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
      or monobank_invoice_status is distinct from p_invoice_status
    )
  returning id into v_id;

  return v_id;
end;
$function$;
