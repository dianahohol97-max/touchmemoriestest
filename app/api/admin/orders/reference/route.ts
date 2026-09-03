import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/orders/reference — довідники, з яких живе картка замовлення:
 * реквізити продавця, рахунки для оплати, відділення Нової пошти, шаблони
 * відповідей і профілі друку.
 *
 * Усе це картка читала прямими запитами з браузера, і майже все закрите RLS на
 * is_admin_user() — тобто «email є в admin_users». З чотирнадцяти активних
 * співробітників туди входять четверо. Решті десятьом запити мовчки повертали
 * нуль рядків, і картка виглядала так:
 *   • у «Реквізити для оплати» жодного рахунку, тож рахунок на замовлення не
 *     поставиш і посилання на оплату не сформуєш;
 *   • у Новій пошті жодного відправника, тож ТТН не створиш;
 *   • у листі клієнту порожній список шаблонів, усе пишеться руками;
 *   • комерційний інвойс без реквізитів продавця, з вічним попередженням про
 *     відсутній податковий номер.
 * Жодного повідомлення про помилку при цьому не було: RLS не помилка, а просто
 * порожня вибірка.
 *
 * Профілі друку читаються публічно і працювали в усіх, але тримати їх окремим
 * запитом більше немає сенсу — картка й так робить один виклик замість пʼяти.
 *
 * ОКРЕМО ПРО КЛЮЧІ. bank_accounts і np_accounts мають колонку api_key, і
 * попередній select('*') віддавав ці ключі в браузер кожному, хто відкривав
 * замовлення. Тут перелічені лише ті поля, які картка справді малює: підпис,
 * назва банку та id. Ключі лишаються на сервері, де ними користуються роути
 * створення ТТН і рахунку.
 */
export async function GET() {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const admin = getAdminClient();
    const [sellerRes, banksRes, npRes, templatesRes, profilesRes] = await Promise.all([
        admin.from('settings').select('value').eq('key', 'seller_legal').maybeSingle(),
        admin.from('bank_accounts').select('id, label, bank_name, currency').eq('is_active', true).order('bank_name'),
        admin.from('np_accounts').select('id, label, is_default').eq('is_active', true).order('label'),
        admin.from('reply_templates').select('id, name, subject, body, category').order('sort_order', { ascending: true }),
        admin.from('print_profiles').select('id, name').order('name'),
    ]);

    // Жоден із довідників не є критичним для показу картки: без шаблонів лист
    // просто пишеться руками, без профілів друку не вибереш профіль. Тому збій
    // одного не має валити всю відповідь — логуємо і віддаємо порожній список.
    const problems: string[] = [];
    const take = (res: { data: any; error: { message: string } | null }, name: string, fallback: any): any => {
        if (res.error) {
            console.error(`[orders/reference] ${name} failed`, res.error.message);
            problems.push(name);
            return fallback;
        }
        return res.data ?? fallback;
    };

    return NextResponse.json({
        sellerLegal: take(sellerRes, 'seller_legal', null)?.value ?? {},
        bankAccounts: take(banksRes, 'bank_accounts', []),
        npAccounts: take(npRes, 'np_accounts', []),
        replyTemplates: take(templatesRes, 'reply_templates', []),
        printProfiles: take(profilesRes, 'print_profiles', []),
        problems,
    });
}
