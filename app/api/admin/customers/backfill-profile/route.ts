import { NextResponse } from 'next/server';
import { requireSection } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { profilePatchFromMetadata } from '@/lib/customers/profile-from-metadata';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Скільки рядків PostgREST віддає за один запит. Те саме число, що в /api/admin/clients. */
const PAGE = 1000;

/**
 * Разовий прохід: імена й дати народження, які лишилися в метаданих реєстрації.
 *
 * Те, що auth callback тепер робить для кожного, хто входить, тут робиться для
 * всіх одразу і ТИМ САМИМ правилом — lib/customers/profile-from-metadata.ts.
 * Двох копій бути не має.
 *
 * Стан на 14.09.2026: 310 карток без імені, з них 297 мають ім'я в метаданих
 * (288 під ключем first_name, який тригер не читає, і 31 під name або
 * full_name, які він читає, але не в тій гілці). Плюс 35 дат народження, яких
 * у customers немає жодної.
 *
 * ЗА ЗАМОВЧУВАННЯМ НІЧОГО НЕ ПИШЕ. Запис відбувається, лише якщо в тілі стоїть
 * рівно `dryRun: false`.
 *
 * Заповнене не перезаписується ніколи — правило в самій функції, тут лише
 * обхід.
 */

interface Plan {
    customerId: string;
    email: string | null;
    nameBefore: string | null;
    nameAfter?: string;
    birthdayBefore: string | null;
    birthdayAfter?: string;
}

export async function POST(req: Request) {
    // Право те саме, що на решту записів у картки клієнтів.
    const guard = await requireSection('customers', 'edit');
    if (!guard.ok) return guard.response;

    let body: { dryRun?: unknown } = {};
    try { body = await req.json(); } catch { /* порожнє тіло — холостий прохід */ }
    const dryRun = body?.dryRun !== false;

    const admin = getAdminClient();

    try {
        // Метадані лежать в auth.users, а PostgREST до схеми auth не пускає,
        // тож користувачі беруться через admin-API. Він теж сторінковий.
        const users: any[] = [];
        for (let page = 1; ; page++) {
            const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE });
            if (error) throw new Error(`auth.listUsers: ${error.message}`);
            const batch = data?.users || [];
            users.push(...batch);
            if (batch.length < PAGE) break;
        }
        const metaById = new Map<string, any>();
        for (const u of users) metaById.set(u.id, u.user_metadata ?? {});

        const customers: any[] = [];
        for (let from = 0; ; from += PAGE) {
            const { data, error } = await admin
                .from('customers')
                .select('id, auth_user_id, email, name, birthday')
                .is('deleted_at', null)
                .order('created_at', { ascending: true })
                .range(from, from + PAGE - 1);
            if (error) throw new Error(`customers: ${error.message}`);
            customers.push(...(data || []));
            if (!data || data.length < PAGE) break;
        }

        const plans: Plan[] = [];
        let noMetadata = 0;

        for (const c of customers) {
            const meta = metaById.get(c.auth_user_id || c.id);
            if (!meta) { noMetadata++; continue; }

            const patch = profilePatchFromMetadata(c, meta);
            if (!patch.name && !patch.birthday) continue;

            plans.push({
                customerId: c.id,
                email: c.email ?? null,
                nameBefore: c.name ?? null,
                nameAfter: patch.name,
                birthdayBefore: c.birthday ?? null,
                birthdayAfter: patch.birthday,
            });
        }

        const summary = {
            dryRun,
            scannedCustomers: customers.length,
            noMetadata,
            wouldFillName: plans.filter((p) => p.nameAfter).length,
            wouldFillBirthday: plans.filter((p) => p.birthdayAfter).length,
            wouldTouchRows: plans.length,
        };

        if (dryRun) {
            return NextResponse.json({
                ...summary,
                note: 'Холостий прохід: у базі нічого не змінено. Щоб застосувати, надішліть {"dryRun": false}.',
                sample: plans.slice(0, 20),
            });
        }

        let filled = 0;
        for (const p of plans) {
            const patch: Record<string, any> = {};
            if (p.nameAfter) patch.name = p.nameAfter;
            if (p.birthdayAfter) patch.birthday = p.birthdayAfter;

            // Умови «досі порожньо» стоять у WHERE, а не перевіркою вище: між
            // читанням і записом людина могла зайти в кабінет і вписати ім'я
            // сама, і перезаписувати її введене не можна.
            let q = admin.from('customers').update(patch).eq('id', p.customerId);
            if (p.nameAfter) q = q.is('name', null);
            if (p.birthdayAfter) q = q.is('birthday', null);

            const { data: updated } = await q.select('id').maybeSingle();
            if (updated) filled++;
        }

        console.log('[backfill-profile] applied', { filled, ...summary });

        return NextResponse.json({ ...summary, applied: true, filled });
    } catch (e: any) {
        console.error('[backfill-profile] failed', e?.message || e);
        return NextResponse.json({ error: e?.message || 'Прохід не вдався' }, { status: 500 });
    }
}
