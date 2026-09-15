import { createClient } from '@supabase/supabase-js';
import { startOfDay, endOfDay, isWithinInterval } from 'date-fns';

import { getAdminClient } from '@/lib/supabase/admin';
import { countedRevenue } from '@/lib/orders/payment-state';
import { REVENUE_DATE_COLUMN } from '@/lib/orders/revenue-period';
import { resolvePlanBonus } from '@/lib/salary/plan-bonus';
import { fetchAllRows } from '@/lib/supabase/paginate';

export async function calculateSalary(staffId: string, fromDate: string, toDate: string) {
    const supabase = getAdminClient();
    // 1. Fetch Staff Data
    const { data: staff } = await supabase.from('staff').select('*').eq('id', staffId).single();
    if (!staff) throw new Error('Staff not found');

    const startDate = startOfDay(new Date(fromDate));
    // Include the whole final day — a bare `new Date(toDate)` is midnight, so
    // `.lte(REVENUE_DATE_COLUMN, endDate)` would drop everything after 00:00
    // on toDate.
    const endDate = endOfDay(new Date(toDate));

    // 2. Fetch Common Data
    // - Shifts
    const { data: shifts } = await supabase
        .from('staff_shifts')
        .select('*')
        .eq('staff_id', staffId)
        .gte('work_date', fromDate)
        .lte('work_date', toDate);
    const workedShifts = shifts?.length || 0;

    // - QC Log
    const { data: qcLogs } = await supabase
        .from('qc_error_log')
        .select('points')
        .eq('staff_id', staffId)
        .gte('error_date', fromDate)
        .lte('error_date', toDate);
    const totalQCPoints = qcLogs?.reduce((sum: number, log: any) => sum + (Number(log.points) || 0), 0) || 0;

    // - Orders for the period.
    //
    // Вікно — по даті замовлення, для всіх ролей однаково, тим самим стовпцем,
    // яким рахує дохід уся звітність (REVENUE_DATE_COLUMN).
    //
    // Було: менеджерам вікно бралося по `paid_at`. Цей стовпець заповнюється
    // лише тоді, коли оплату провів наш власний обробник платежу, а таких
    // замовлень три на всю базу. У дзеркалених із KeyCRM і в тих, де оплату
    // проставив адміністратор руками, він порожній завжди. Через це вибірка
    // менеджера була порожня, обіг виходив нуль, а разом із ним нуль давали
    // комісія півтора відсотка і комісія за «Пісню». Заміряно 15.09.2026: за
    // серпень жодне з вісімнадцяти замовлень із менеджером не мало `paid_at`,
    // за вересень — три з двохсот сорока, і всі три чужі. Помилка мовчазна:
    // екран показував охайний нуль, а не відмову.
    //
    // Сторінками, бо період задається ззовні і може бути довшим за місяць.
    // Місяць — це щонайбільше 703 замовлення (серпень 2026), а от два місяці
    // поспіль дають 1 083, тобто вже за межею PostgREST. Зарплата, порахована
    // з обрізаної вибірки, виглядала б просто меншою, без жодної ознаки
    // помилки — і сперечатися з нею довелося б людині.
    const orders = await fetchAllRows<any>((from, to) => supabase
        .from('orders')
        .select('*')
        .gte(REVENUE_DATE_COLUMN, startDate.toISOString())
        .lte(REVENUE_DATE_COLUMN, endDate.toISOString())
        .order(REVENUE_DATE_COLUMN, { ascending: false })
        .range(from, to), { label: 'замовлення для зарплати' });

    const breakdown: any = {};
    let total = 0;

    // 3. Role-Specific Logic
    if (staff.role === 'manager' || (staff.role === 'admin' && staff.name.toLowerCase() !== 'андрій')) {
        // --- MANAGERS ---
        // Обіг менеджера — гроші, які НАДІЙШЛИ по його замовленнях, а не сума
        // виставлених рахунків.
        //
        // Було `payment_status === 'paid'` і сума `total`. Обидва хибні в той
        // самий бік. Статус 'paid' ставиться лише на повністю оплачених, а
        // більшість замовлень із KeyCRM живе на передоплаті п'ятдесят
        // відсотків і лишається в 'pending' — гроші в касі є, для комісії їх
        // наче немає. Сума рахунку ж зараховувала б менеджеру й ту половину,
        // якої ще не внесли. Скасовані дають нуль: countedRevenue.
        //
        // Різниця на вересні 2026: у Катерини Івашиної надійшло 157 604 ₴, а
        // під старим фільтром «оплачених» видно 119 064 ₴ — 38 540 ₴ живих
        // грошей не рахувалися б людині в обіг.
        const managerOrders = orders?.filter((o: any) => o.manager_id === staffId) || [];
        const totalRevenue = managerOrders.reduce((sum: number, o: any) => sum + countedRevenue(o), 0);

        // 1. Commission (1.5%)
        const commission = totalRevenue * 0.015;
        breakdown.commission = {
            label: 'Комісія (1.5%)',
            value: commission,
            // Підпис каже, з чого рахували: обіг тут — отримані гроші за
            // датою замовлення, і саме так його звірятимуть із банком.
            details: `${Math.round(totalRevenue).toLocaleString('uk-UA')} ₴ обігу — гроші, що надійшли, за датою замовлення`,
        };

        // 2. Shift Rate (400 per shift)
        const shiftRate = workedShifts * 400;
        breakdown.shifts = { label: `Зміни (${workedShifts} × 400)`, value: shiftRate };

        // 3. Plan Bonus
        //
        // Правило в lib/salary/plan-bonus.ts: немає плану — немає бонусу.
        // Раніше було навпаки, бо порожній `manager_plan_target` через `|| 0`
        // ставав планом «нуль», і тисяча нараховувалася всім, у тому числі за
        // місяць без жодного замовлення. Стовпець додала міграція
        // 20260915_manager_plan_target.sql, значення в ньому ставить Діана.
        const plan = resolvePlanBonus(totalRevenue, staff.manager_plan_target);
        const planBonus = plan.value;
        breakdown.plan_bonus = {
            label: 'Бонус за план',
            value: plan.value,
            status: plan.status,
            note: plan.note,
        };

        // 4. Quality Bonus (75 per shift if QC < 30)
        const qualityBonus = totalQCPoints < 30 ? workedShifts * 75 : 0;
        breakdown.quality_bonus = { label: 'Бонус за якість', value: qualityBonus, points: totalQCPoints };

        // 5. "Пісня" Commission (10%)
        //
        // Лише по замовленнях, де гроші вже надійшли: до цього фільтром був
        // статус 'paid', і прибрати його зовсім означало б платити відсоток за
        // пісню, яку ще не оплатили.
        let pesnyaCommission = 0;
        managerOrders.filter((o: any) => countedRevenue(o) > 0).forEach((o: any) => {
            const items = (o.items || []) as any[];
            items.forEach((item: any) => {
                const name = (item.product_name || item.name || '').toLowerCase();
                if (name.includes('пісня')) {
                    const qty = item.quantity || item.qty || 1;
                    const subtotal = Number(item.total_price) || (Number(item.unit_price ?? item.price) || 0) * qty;
                    pesnyaCommission += subtotal * 0.1;
                }
            });
        });
        breakdown.pesnya = { label: 'Комісія "Пісня" (10%)', value: pesnyaCommission };

        // 6. Top Orders logic (Placeholder/Manual)
        // Since we don't know who else is top, we'll mark it as manual for now or logic can be added
        breakdown.top_bonus = { label: 'Топ-менеджер (частка)', value: 0, note: 'Нараховується вручну' };

        total = commission + shiftRate + planBonus + qualityBonus + pesnyaCommission;
    }
    else if (staff.role === 'designer') {
        // --- DESIGNERS ---
        const designerOrders = orders?.filter((o: any) => o.designer_id === staffId) || [];

        // 1 & 2. Product-based commission (7% and 5%)
        let comm7 = 0;
        let comm5 = 0;
        let designerWorkFixed = 0;

        const cat7 = ['фотокнига', 'журнал', 'тревел-бук', 'ламінація', 'покращення', 'qr', 'текст', 'форзац', 'калька', 'обкладинка', 'календар а3', 'календар а4', 'зоряне небо'];
        const cat5 = ['альбом', 'книга побажань', 'постер', 'фотодрук', 'магніт', 'календар'];

        designerOrders.forEach((o: any) => {
            const items = (o.items || []) as any[];
            items.forEach((item: any) => {
                const name = (item.product_name || item.name || '').toLowerCase();
                const qty = item.quantity || item.qty || 1;
                const unitPrice = Number(item.unit_price ?? item.price) || 0;
                const subtotal = Number(item.total_price) || unitPrice * qty;

                if (name.includes('робота дизайнера')) {
                    designerWorkFixed += qty * 100;
                } else if (cat7.some(keyword => name.includes(keyword))) {
                    comm7 += subtotal * 0.07;
                } else if (cat5.some(keyword => name.includes(keyword))) {
                    comm5 += subtotal * 0.05;
                }
            });
        });

        breakdown.commission_7 = { label: 'Комісія 7%', value: comm7 };
        breakdown.commission_5 = { label: 'Комісія 5%', value: comm5 };
        breakdown.designer_task = { label: 'Робота дизайнера (100/шт)', value: designerWorkFixed };

        // 4. Shift Rate (250)
        const shiftRate = workedShifts * 250;
        breakdown.shifts = { label: `Зміни (${workedShifts} × 250)`, value: shiftRate };

        // 5. Error Penalties (Deducted from QC log)
        const errorPenalty = totalQCPoints * 10; // Assuming 10 per point for designers? Or just show it.
        breakdown.errors = { label: 'Штрафи за помилки', value: -errorPenalty, points: totalQCPoints };

        total = comm7 + comm5 + designerWorkFixed + shiftRate - errorPenalty;
    }
    else if (staff.name.toLowerCase().includes('андрій')) {
        // --- PRODUCTION (ANDRIY) ---
        // 1. Finishing (Manual Qty)
        breakdown.finishing = { label: 'Оздоблення (85/од)', value: 0, note: 'Введіть к-ть вручну' };

        // 2. Magnets
        let magnetsCount = 0;
        orders?.forEach((o: any) => {
            const items = (o.items || []) as any[];
            items.forEach((item: any) => {
                if ((item.product_name || item.name || '').toLowerCase().includes('магніт')) {
                    magnetsCount += (item.qty || item.quantity || 1) * 10; // sets to units
                }
            });
        });
        const magnetsValue = magnetsCount * 1.5;
        breakdown.magnets = { label: `Магніти (${magnetsCount} шт × 1.5)`, value: magnetsValue };

        // 3. Photos/Polaroid
        let photoCount = 0;
        orders?.forEach((o: any) => {
            const items = (o.items || []) as any[];
            items.forEach((item: any) => {
                const name = (item.product_name || item.name || '').toLowerCase();
                if (name.includes('фото') || name.includes('polaroid')) {
                    photoCount += (item.qty || item.quantity || 1);
                }
            });
        });
        const photosValue = photoCount * 1;
        breakdown.photos = { label: `Фото/Polaroid (${photoCount} шт × 1)`, value: photosValue };

        // 4. Cutting fee
        breakdown.cutting = { label: 'Порізка', value: 0, note: 'Сума від Томи' };

        total = magnetsValue + photosValue;
    }

    return { total, breakdown };
}
