import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/resend';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// One-off apology to owners of "ghost" drafts (photos uploaded but every page
// slot lost its placement in the pre-fix editor bug). Excludes Maryana
// Vasilieva (already in a DM conversation) and anyone with a PAID order
// (handled personally). Protected by a one-time key; safe to re-run — it
// records sent addresses in one_off_log and skips them.
const KEY = 'tm-ghost-apology-2026-07-03-x9k2';
const EXCLUDE = new Set(['vasilevamaryana0717@gmail.com']);

function emailHtml(name: string | null): string {
    const hi = name ? `Вітаємо, ${name.split(' ')[0]}!` : 'Вітаємо!';
    return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;line-height:1.65;font-size:15px;">
  <div style="background:#263A99;color:#fff;padding:22px 26px;border-radius:12px 12px 0 0;">
    <div style="font-size:19px;font-weight:800;">Ваша фотокнига чекає 💙</div>
  </div>
  <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;padding:26px;border-radius:0 0 12px 12px;">
    <p style="margin:0 0 14px;">${hi}</p>
    <p style="margin:0 0 14px;">Ви нещодавно почали створювати фотокнигу на touchmemories.com.ua — і ми хочемо чесно вибачитись. Через технічну помилку на нашому боці розставлені фото могли зникнути зі сторінок вашого макета, хоча самі знімки нікуди не поділись. Розуміємо, як прикро вкласти час у дизайн і побачити порожні сторінки.</p>
    <p style="margin:0 0 14px;">Ми вже все виправили, і тепер редактор надійно зберігає кожен крок. Ваші фото в безпеці — вони чекають у вашому кабінеті.</p>
    <p style="margin:0 0 14px;">Щоб продовжити з того місця, де зупинились: зайдіть у свій акаунт на сайті, відкрийте розділ «Мої дизайни» та оберіть свою фотокнигу. Усі завантажені фото будуть у панелі — натисніть «Магічна збірка», і вони самі стануть на сторінки, або розставте їх вручну як до вподоби.</p>
    <p style="margin:0 0 18px;">Маленьке прохання: відкривайте редактор у Safari чи Chrome, а не всередині Instagram — вбудований браузер не завжди справляється з великими макетами.</p>
    <div style="text-align:center;margin:0 0 18px;">
      <a href="https://touchmemories.com.ua/account" style="display:inline-block;background:#263A99;color:#fff;text-decoration:none;font-weight:700;padding:13px 28px;border-radius:8px;">Відкрити мій дизайн</a>
    </div>
    <p style="margin:0 0 14px;">Якщо щось не виходить — просто дайте відповідь на цей лист або напишіть нам в Instagram <a href="https://instagram.com/touch.memories" style="color:#263A99;">@touch.memories</a>, допоможемо за кілька хвилин.</p>
    <p style="margin:0;">Дякуємо за розуміння і за те, що обрали нас для збереження ваших спогадів 💙<br/>Команда Touch.Memories</p>
  </div>
</div>`;
}

export async function GET(req: Request) {
    const url = new URL(req.url);
    if (url.searchParams.get('key') !== KEY) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const dryRun = url.searchParams.get('dry') === '1';
    const admin = getAdminClient();

    // Ghost drafts: photos uploaded, zero placed slots.
    const { data: drafts } = await admin
        .from('projects')
        .select('user_id, uploaded_photos, pages_data')
        .eq('status', 'draft');
    const ghostUserIds = new Set<string>();
    for (const p of drafts || []) {
        const photos = Array.isArray(p.uploaded_photos) ? p.uploaded_photos.length : 0;
        const pd = JSON.stringify(p.pages_data || []);
        if (photos > 0 && pd.includes('"photoId":null') && !pd.includes('"photoId":"')) {
            if (p.user_id) ghostUserIds.add(p.user_id);
        }
    }

    // Owners' emails + names.
    const results: { email: string; name: string | null }[] = [];
    for (const uid of ghostUserIds) {
        const { data: u } = await admin.auth.admin.getUserById(uid);
        const email = u?.user?.email?.toLowerCase();
        if (!email || EXCLUDE.has(email)) continue;
        const { data: c } = await admin.from('customers').select('name').eq('auth_user_id', uid).maybeSingle();
        results.push({ email, name: c?.name || (u?.user?.user_metadata as any)?.name || null });
    }

    // Exclude anyone with a PAID order (personal handling).
    const { data: paidOrders } = await admin
        .from('orders')
        .select('customer_email')
        .eq('payment_status', 'paid');
    const paidEmails = new Set((paidOrders || []).map(o => String(o.customer_email || '').toLowerCase()).filter(Boolean));

    // Already-sent log (idempotent re-runs).
    const { data: logRows } = await admin.from('one_off_log').select('key_value').eq('log_key', 'ghost-apology-2026-07-03');
    const alreadySent = new Set((logRows || []).map((r: any) => r.key_value));

    const recipients = results.filter(r => !paidEmails.has(r.email) && !alreadySent.has(r.email));

    if (dryRun) {
        return NextResponse.json({ dryRun: true, wouldSend: recipients.length, recipients: recipients.map(r => r.email) });
    }

    let sent = 0; const errors: string[] = [];
    for (const r of recipients) {
        try {
            await sendEmail({
                to: r.email,
                subject: 'Ваша фотокнига чекає — ми виправили технічну помилку 💙',
                html: emailHtml(r.name),
            });
            await admin.from('one_off_log').insert({ log_key: 'ghost-apology-2026-07-03', key_value: r.email });
            sent++;
        } catch (e: any) {
            errors.push(`${r.email}: ${e?.message || 'fail'}`);
        }
    }
    return NextResponse.json({ sent, excluded: results.length - recipients.length, errors });
}
