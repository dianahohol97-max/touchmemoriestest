-- Зведення менеджера з продажів стає похідним від журналу (Діана, 16.09.2026).
--
-- Пара до recalc_agency_partner_totals із 20260916_agency_commission_integrity:
-- для партнерів ту саму ваду вилікували, для менеджерів вона лишалася.
--
-- ЩО БУЛО НЕ ТАК. `sales_managers.total_earned` оновлювався читанням і записом
-- назад у lib/sales/commission.ts: прочитали колонку, додали суму, записали
-- назад. Два вебхуки, що прийшли одночасно за різними замовленнями одного
-- менеджера, читали те саме значення і писали ту саму суму — одне нарахування
-- зникало з кабінету назовсім. Зійтися назад воно не могло ніяк, бо джерелом
-- правди була сама колонка, а не рядки журналу.
--
-- Друга половина тієї самої вади жила в адмінці: перемикач статусу рядка
-- правив `total_paid` тим самим читанням і записом, а `total_earned` не чіпав
-- ЗОВСІМ. Тобто рядок, знятий у 'cancelled', і далі рахувався заробленим.
--
-- ЯК ТЕПЕР. Обидві суми перераховуються з журналу одним оператором UPDATE із
-- підзапитами, тобто атомарно, і будь-який повторний виклик дає той самий
-- результат. Колонки стають похідними, а не окремою правдою.
--
-- 'cancelled' не потрапляє ні в 'зароблено', ні у 'виплачено': рядок лишається
-- у журналі видимим, бо менеджер має бачити, що нарахування було і що його
-- зняли, але в гроші він більше не входить. Точно та сама межа, що й у
-- партнерів.

create or replace function public.recalc_sales_manager_totals(p_manager_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update sales_managers m
     set total_earned = coalesce((
           select sum(c.amount)
             from sales_commissions c
            where c.manager_id = m.id
              and c.status <> 'cancelled'
         ), 0),
         total_paid = coalesce((
           select sum(c.amount)
             from sales_commissions c
            where c.manager_id = m.id
              and c.status = 'paid'
         ), 0),
         updated_at = now()
   where m.id = p_manager_id;
$$;

-- security definer, тож доступ звужений до службової ролі: заробітки менеджерів
-- не мають читатися чи правитися з браузера ні в якому вигляді.
revoke all on function public.recalc_sales_manager_totals(uuid) from public, anon, authenticated;
grant execute on function public.recalc_sales_manager_totals(uuid) to service_role;
