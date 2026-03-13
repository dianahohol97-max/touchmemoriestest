import { createClient } from '@supabase/supabase-js';
import { startOfDay, endOfDay, isWithinInterval } from 'date-fns';

import { getAdminClient } from '@/lib/supabase/admin';

export async function calculateSalary(staffId: string, fromDate: string, toDate: string) {
    const supabase = getAdminClient();
    // 1. Fetch Staff Data
    const { data: staff } = await supabase.from('staff').select('*').eq('id', staffId).single();
    if (!staff) throw new Error('Staff not found');

    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);

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
    const totalQCPoints = qcLogs?.reduce((sum, log) => sum + log.points, 0) || 0;

    // - Orders (Based on paid_at for managers, or relevant IDs for others)
    // We fetch all orders that might be relevant to this person
    let query = supabase.from('orders').select('*');
    if (staff.role === 'manager') {
        query = query.gte('paid_at', startDate.toISOString()).lte('paid_at', endDate.toISOString());
    } else {
        query = query.gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString());
    }
    const { data: orders } = await query;

    const breakdown: any = {};
    let total = 0;

    // 3. Role-Specific Logic
    if (staff.role === 'manager' || (staff.role === 'admin' && staff.name.toLowerCase() !== 'андрій')) {
        // --- MANAGERS ---
        const managerOrders = orders?.filter(o => o.manager_id === staffId && o.payment_status === 'paid') || [];
        const totalRevenue = managerOrders.reduce((sum, o) => sum + Number(o.total), 0);

        // 1. Commission (1.5%)
        const commission = totalRevenue * 0.015;
        breakdown.commission = { label: 'Комісія (1.5%)', value: commission, details: `${totalRevenue.toLocaleString()} ₴ turnover` };

        // 2. Shift Rate (400 per shift)
        const shiftRate = workedShifts * 400;
        breakdown.shifts = { label: `Зміни (${workedShifts} × 400)`, value: shiftRate };

        // 3. Plan Bonus (1000)
        const planReached = totalRevenue >= (staff.manager_plan_target || 0);
        const planBonus = planReached ? 1000 : 0;
        breakdown.plan_bonus = { label: 'Бонус за план', value: planBonus, status: planReached ? 'ok' : 'missed' };

        // 4. Quality Bonus (75 per shift if QC < 30)
        const qualityBonus = totalQCPoints < 30 ? workedShifts * 75 : 0;
        breakdown.quality_bonus = { label: 'Бонус за якість', value: qualityBonus, points: totalQCPoints };

        // 5. "Пісня" Commission (10%)
        let pesnyaCommission = 0;
        managerOrders.forEach(o => {
            const items = (o.items || []) as any[];
            items.forEach(item => {
                const name = (item.name || '').toLowerCase();
                if (name.includes('пісня')) {
                    pesnyaCommission += (Number(item.price) * (item.qty || item.quantity || 1)) * 0.1;
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
        const designerOrders = orders?.filter(o => o.designer_id === staffId) || [];

        // 1 & 2. Product-based commission (7% and 5%)
        let comm7 = 0;
        let comm5 = 0;
        let designerWorkFixed = 0;

        const cat7 = ['фотокнига', 'журнал', 'тревел-бук', 'ламінація', 'покращення', 'qr', 'текст', 'форзац', 'калька', 'обкладинка', 'календар а3', 'календар а4', 'зоряне небо'];
        const cat5 = ['альбом', 'книга побажань', 'постер', 'фотодрук', 'магніт', 'календар'];

        designerOrders.forEach(o => {
            const items = (o.items || []) as any[];
            items.forEach(item => {
                const name = (item.name || '').toLowerCase();
                const price = Number(item.price) || 0;
                const qty = item.qty || item.quantity || 1;
                const subtotal = price * qty;

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
        orders?.forEach(o => {
            const items = (o.items || []) as any[];
            items.forEach(item => {
                if ((item.name || '').toLowerCase().includes('магніт')) {
                    magnetsCount += (item.qty || item.quantity || 1) * 10; // sets to units
                }
            });
        });
        const magnetsValue = magnetsCount * 1.5;
        breakdown.magnets = { label: `Магніти (${magnetsCount} шт × 1.5)`, value: magnetsValue };

        // 3. Photos/Polaroid
        let photoCount = 0;
        orders?.forEach(o => {
            const items = (o.items || []) as any[];
            items.forEach(item => {
                const name = (item.name || '').toLowerCase();
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
