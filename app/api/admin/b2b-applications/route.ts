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

    // Update the customer's B2B status. Match by the linked customer_id when we
    // have it, otherwise fall back to the application email — otherwise an
    // approved partner whose application was never linked to a customer would
    // stay without the discount (b2b_status never flips to verified).
    const custPatch = {
        b2b_status: newStatus,
        b2b_verified_at: action === 'approve' ? new Date().toISOString() : null,
    };
    if (app.customer_id) {
        await admin.from('customers').update(custPatch).eq('id', app.customer_id);
    } else if (app.email) {
        await admin.from('customers').update(custPatch).ilike('email', app.email);
    }

    // Approved photographers also get a gallery cabinet + public landing
    // (photographers table) — one B2B registration covers the 10% discount
    // AND the client-gallery/landing toolkit. Idempotent: reuse an existing
    // row (matched by customer or email) and just make sure it's linked.
    let cabinetToken: string | null = null;
    let landingSlug: string | null = null;
    if (action === 'approve' && app.role === 'photographer') {
        try {
            // Match by customer link OR email. Guard the customer_id condition:
            // a null app.customer_id would render `customer_id.eq.null`, which
            // errors as an invalid-uuid cast, the lookup finds nothing, and a
            // duplicate photographer row (new slug) gets inserted.
            const conds = [
                app.customer_id ? `customer_id.eq.${app.customer_id}` : '',
                app.email ? `email.ilike.${app.email}` : '',
            ].filter(Boolean);
            const { data: existing } = conds.length
                ? await admin
                    .from('photographers')
                    .select('id, cabinet_token, slug, customer_id')
                    .or(conds.join(','))
                    .maybeSingle()
                : { data: null };

            if (existing) {
                cabinetToken = existing.cabinet_token;
                landingSlug = existing.slug;
                if (!existing.customer_id && app.customer_id) {
                    await admin.from('photographers')
                        .update({ customer_id: app.customer_id })
                        .eq('id', existing.id);
                }
            } else {
                const baseSlug = (app.name || 'photographer')
                    .toLowerCase()
                    .replace(/[^a-z0-9а-яіїєґ]+/gi, '-')
                    .replace(/^-+|-+$/g, '')
                    .replace(/[а-яіїєґ]/gi, '') // slugs stay latin; cyrillic names fall back to suffix
                    .replace(/^-+|-+$/g, '') || 'photographer';
                const slug = `${baseSlug}-${String(Date.now()).slice(-5)}`;
                const { data: created } = await admin
                    .from('photographers')
                    .insert({
                        name: app.name || app.email,
                        email: app.email,
                        slug,
                        customer_id: app.customer_id || null,
                        website: app.portfolio_url || null,
                    })
                    .select('cabinet_token, slug')
                    .single();
                cabinetToken = created?.cabinet_token || null;
                landingSlug = created?.slug || null;
            }
        } catch (e) {
            console.error('[b2b-approve] photographer cabinet creation failed:', e);
            // Approval itself must not fail because of the cabinet — admin can
            // create it later from /admin/photographers.
        }
    }

    // Notify the applicant
    if (getBrevoApiKey()) {
        const cfg = getRoleConfig(app.role);
        const roleLabel = app.role === 'photographer' ? 'фотографів' : 'весільних агенцій';
        if (action === 'approve') {
            const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua').replace(/\/$/, '');
            const photographerBlock = cabinetToken
                ? `
                        <p style="font-size:15px;line-height:1.7;color:#475569;margin:14px 0 0">Також вам доступний <strong>кабінет фотографа</strong>: галереї для передачі фото клієнтам (зберігання 30 днів) і власна сторінка-візитка з портфоліо та прайсом.</p>
                        <p style="margin:16px 0 0">
                          <a href="${site}/uk/photographer/cabinet/${cabinetToken}" style="background:#1e2d7d;color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">Відкрити кабінет фотографа</a>
                        </p>
                        ${landingSlug ? `<p style="font-size:13px;color:#94a3b8;margin:12px 0 0">Ваша публічна сторінка: <a href="${site}/uk/photographer/${landingSlug}">${site}/uk/photographer/${landingSlug}</a></p>` : ''}`
                : '';
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
                        <p style="font-size:15px;line-height:1.7;color:#475569;margin:0">Просто увійдіть у свій акаунт — знижка враховуватиметься автоматично на відповідних товарах у каталозі та кошику.</p>${photographerBlock}
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
