-- Цілісність партнерських нарахувань (Діана, 16.09.2026).
--
-- Таблиці agency_partners і agency_commissions свого часу створили руками в
-- Supabase, тож у репозиторії міграції на них немає. Ця міграція нічого в них
-- не переписує — вона додає дві функції, які прибирають два дефекти в коді.
--
-- 1. agency_partners.total_earned оновлювався читанням і записом назад
--    (lib/agency/commission.ts). Два вебхуки, що прийшли одночасно за різними
--    замовленнями одного партнера, давали втрачене оновлення: у кабінеті
--    партнер бачив менше, ніж заробив, і сходити ці числа назад не могли ніяк,
--    бо джерелом правди була сама колонка. Тепер обидві суми перераховуються з
--    журналу agency_commissions одним оператором UPDATE, тобто атомарно, і
--    колонка стає похідною, а не окремою правдою.
--
-- 2. Зведення в кабінеті партнера й у списку адмінки читали весь журнал
--    вибіркою без ліміту. PostgREST віддає щонайбільше тисячу рядків і мовчить
--    про це, тож сума до виплати просто занижувалася б без жодної помилки (та
--    сама пастка, що 14.09 поклала список клієнтів і аналітику). Підрахунок
--    переїхав у Postgres, де ліміту немає.
--
-- Статус 'cancelled' у payout_status — для нарахувань за скасованими
-- замовленнями: рядок лишається в журналі видимим, але не потрапляє ні в
-- «нараховано», ні в «до виплати».

create or replace function public.recalc_agency_partner_totals(p_agency_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update agency_partners p
     set total_earned = coalesce((
           select sum(c.total_commission)
             from agency_commissions c
            where c.agency_id = p.id
              and c.payout_status <> 'cancelled'
         ), 0),
         total_paid_out = coalesce((
           select sum(c.total_commission)
             from agency_commissions c
            where c.agency_id = p.id
              and c.payout_status = 'paid'
         ), 0)
   where p.id = p_agency_id;
$$;

create or replace function public.agency_commission_stats()
returns table (
  agency_id     uuid,
  orders_count  bigint,
  revenue       numeric,
  pending_sum   numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select c.agency_id,
         count(*) filter (where c.payout_status <> 'cancelled'),
         coalesce(sum(c.travelbook_subtotal + c.other_subtotal)
                  filter (where c.payout_status <> 'cancelled'), 0),
         coalesce(sum(c.total_commission)
                  filter (where c.payout_status = 'pending'), 0)
    from agency_commissions c
   group by c.agency_id;
$$;

-- Обидві функції security definer, тож доступ до них звужений до службової
-- ролі: партнерські суми не мають читатися з браузера ні в якому вигляді.
revoke all on function public.recalc_agency_partner_totals(uuid) from public, anon, authenticated;
revoke all on function public.agency_commission_stats() from public, anon, authenticated;
grant execute on function public.recalc_agency_partner_totals(uuid) to service_role;
grant execute on function public.agency_commission_stats() to service_role;
