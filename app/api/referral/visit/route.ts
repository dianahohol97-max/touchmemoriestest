import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { likeEscape } from '@/lib/supabase/like-escape';
import { isVisitCodeShaped, normalizeLandingPath, VISIT_DEDUP_WINDOW_MS } from '@/lib/referral/visit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/referral/visit  { code, path }
 *
 * Записує ОДИН перехід за партнерським посиланням. Викликається з
 * ReferralCapture тоді, і тільки тоді, коли код прийшов параметром `?ref=` —
 * тобто людина справді клацнула посилання, а не просто ходить сайтом.
 *
 * Що лягає в таблицю: код, час і шлях сторінки входу. Ні IP, ні User-Agent, ні
 * будь-який ідентифікатор відвідувача — пояснення в міграції
 * 20260916_referral_visits.sql і в lib/referral/visit.ts.
 *
 * Відповідь завжди 200 (крім явного перевищення частоти). Це не роут, за
 * відповіддю якого клієнт щось вирішує, і повідомляти назовні, існує код чи
 * ні, він не має: інакше це стає оракулом на перелік партнерських кодів.
 */

/**
 * Другий рівень відсіву, у памʼяті процесу.
 *
 * Перший рівень — localStorage самого відвідувача, і заголовний браузер його
 * не має. Тут тримається коротка памʼять «ця адреса вже приносила перехід за
 * цим кодом», і ВОНА НІКУДИ НЕ ЗАПИСУЄТЬСЯ: Map живе в памʼяті, помирає з
 * холодним стартом і не потрапляє ні в таблицю, ні в журнал. IP тут
 * використовується транзитно, як у решти обмежувачів частоти в цьому
 * репозиторії, і саме тому обіцянка «без персональних даних» стосується
 * збереженого, а не побаченого.
 *
 * Мапа чиститься від протухлих записів на кожному виклику, інакше на довгому
 * процесі вона росла б без межі.
 */
const seen = new Map<string, number>();
const MAX_SEEN = 5000;

function alreadySeen(ip: string, code: string, now: number): boolean {
    for (const [key, ts] of seen) {
        if (now - ts >= VISIT_DEDUP_WINDOW_MS) seen.delete(key);
    }
    const key = `${ip}|${code}`;
    const ts = seen.get(key);
    if (ts !== undefined && now - ts < VISIT_DEDUP_WINDOW_MS) return true;
    // Запобіжник від необмеженого росту: якщо мапа переповнилась, найстаріше
    // йде геть. Втрата відсіву тут означає щонайбільше зайвий рядок.
    if (seen.size >= MAX_SEEN) {
        const oldest = seen.keys().next();
        if (!oldest.done) seen.delete(oldest.value);
    }
    seen.set(key, now);
    return false;
}

export async function POST(request: Request) {
    const body = await request.json().catch(() => ({}));
    const code = String(body?.code || '').trim().toUpperCase();
    if (!isVisitCodeShaped(code)) return NextResponse.json({ ok: true, recorded: false });

    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const now = Date.now();
    if (alreadySeen(ip, code, now)) return NextResponse.json({ ok: true, recorded: false });

    const admin = getAdminClient();

    // Код має належати ЖИВОМУ партнеру. Без цієї перевірки будь-хто наповнив
    // би таблицю переходами за вигаданими кодами, і вона перестала б щось
    // означати. Неактивний партнер теж не рахується: його посилання більше не
    // приносить ні знижки, ні комісії, тож і перехід за ним нічого не важить.
    const { data: partner } = await admin
        .from('agency_partners')
        .select('id, status')
        .ilike('referral_code', likeEscape(code))
        .maybeSingle();
    if (!partner || partner.status !== 'active') {
        return NextResponse.json({ ok: true, recorded: false });
    }

    const { error } = await admin.from('referral_visits').insert({
        referral_code: code,
        landing_path: normalizeLandingPath(body?.path),
    });
    if (error) {
        // Перехід — це статистика, а не гроші. Збій запису не має ставати
        // помилкою на сторінці, яку людина щойно відкрила.
        console.error('[referral-visit] insert failed:', error.message);
        return NextResponse.json({ ok: true, recorded: false });
    }

    return NextResponse.json({ ok: true, recorded: true });
}
