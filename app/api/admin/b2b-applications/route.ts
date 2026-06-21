import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendBrevoEmail, getBrevoApiKey } from '@/lib/email/brevo';
import { getRoleConfig } from '@/lib/b2b/config';

export const dynamic = 'force-dynamic';

// GET /api/admin/b2b-applications?status=pending
export async function GET(request: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const admin = getAdminClient();
    let q = admin.from('b2b_applications').select('*').order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ applications: data || [] });
}

// PATCH /api/admin/b2b-applications  { id, action: 'approve'|'reject', note? }
export async function PATCH(request: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const { id, action, note } = await request.json();
    if (!id || !['approve', 'reject'].includes(action)) {
        return NextResponse.json({ error: 'Невірні параметри' }, { status: 400 });
    }

    const admin = getAdminClient();
    const { data: app } = await admin
        .from('b2b_applications')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    if (!app) return NextResponse.json({ error: 'Заявку не знайдено' }, { status: 404 });

    const newStatus = action === 'approve' ? 'verified' : 'rejected';

    // Update the application
    await admin.from('b2b_applications')
        .update({ status: newStatus, admin_note: note || null, reviewed_at: new Date().toISOString() })
        .eq('id', id);

    // Update the customer's B2B status
    if (app.customer_id) {
        await admin.from('customers')
            .update({
                b2b_status: newStatus,
                b2b_verified_at: action === 'approve' ? new Date().toISOString() : null,
            })
            .eq('id', app.customer_id);
    }

    // Notify the applicant
    if (getBrevoApiKey()) {
        const cfg = getRoleConfig(app.role);
        const roleLabel = app.role === 'photographer' ? 'фотографів' : 'весільних агенцій';
        if (action === 'approve') {
            await sendBrevoEmail({
                to: app.email,
                toName: app.name || app.email,
                subject: 'Вітаємо! Вашу заявку підтверджено 🎉',
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
                      <div style="background:#263A99;padding:24px 28px;text-align:center"><span style="color:#fff;font-size:20px;font-weight:900;letter-spacing:.1em">TOUCH.MEMORIES</span></div>
                      <div style="padding:32px 28px;background:#fff;border:1px solid #e2e8f0">
                        <h2 style="color:#1e2d7d;font-size:22px;margin:0 0 12px">Вітаємо, ${app.name || ''}!</h2>
                        <p style="font-size:15px;line-height:1.7;color:#475569;margin:0 0 14px">Вашу заявку на партнерську програму для ${roleLabel} підтверджено. Тепер вам доступна постійна знижка <strong>${cfg?.discountPercent ?? 10}%</strong>.</p>
                        <p style="font-size:15px;line-height:1.7;color:#475569;margin:0">Просто увійдіть у свій акаунт — знижка враховуватиметься автоматично на відповідних товарах у каталозі та кошику.</p>
                      </div>
                    </div>`,
                fromName: 'Touch.Memories',
                fromEmail: 'hello@touchmemories.com.ua',
            });
        } else {
            await sendBrevoEmail({
                to: app.email,
                toName: app.name || app.email,
                subject: 'Щодо вашої заявки на партнерство',
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
                      <div style="background:#263A99;padding:24px 28px;text-align:center"><span style="color:#fff;font-size:20px;font-weight:900;letter-spacing:.1em">TOUCH.MEMORIES</span></div>
                      <div style="padding:32px 28px;background:#fff;border:1px solid #e2e8f0">
                        <h2 style="color:#1e2d7d;font-size:20px;margin:0 0 12px">Дякуємо за інтерес</h2>
                        <p style="font-size:15px;line-height:1.7;color:#475569;margin:0">На жаль, наразі ми не можемо підтвердити вашу заявку. Якщо вважаєте, що сталася помилка, або хочете надати додаткову інформацію — напишіть нам на hello@touchmemories.com.ua.</p>
                      </div>
                    </div>`,
                fromName: 'Touch.Memories',
                fromEmail: 'hello@touchmemories.com.ua',
            });
        }
    }

    return NextResponse.json({ ok: true, status: newStatus });
}
