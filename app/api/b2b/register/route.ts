import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendBrevoEmail, getBrevoApiKey } from '@/lib/email/brevo';
import { escapeHtml } from '@/lib/email/escape';
import { getRoleConfig, type B2bRole } from '@/lib/b2b/config';

export const dynamic = 'force-dynamic';

// Excludes comma and parentheses: this email is later interpolated into a
// PostgREST `.or()` filter string (photographer cabinet lookup), where those
// characters would let a crafted address inject extra filter terms.
const EMAIL_RE = /^[^\s@,()]+@[^\s@,()]+\.[^\s@,()]+$/;
const URL_RE = /^https?:\/\/.+/i;

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const role = String(body?.role || '') as B2bRole;
        const name = String(body?.name || '').trim();
        const email = String(body?.email || '').trim().toLowerCase();
        const password = String(body?.password || '');
        const phone = body?.phone ? String(body.phone).trim() : null;
        const portfolioUrl = String(body?.portfolioUrl || '').trim();

        const cfg = getRoleConfig(role);
        if (!cfg) return NextResponse.json({ error: 'Невідома роль' }, { status: 400 });
        if (!name || name.length > 200) return NextResponse.json({ error: 'Вкажіть імʼя' }, { status: 400 });
        if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Невірний email' }, { status: 400 });
        if (password.length < 8) return NextResponse.json({ error: 'Пароль мінімум 8 символів' }, { status: 400 });
        if (!URL_RE.test(portfolioUrl)) {
            return NextResponse.json({ error: 'Вкажіть коректне посилання (починається з http)' }, { status: 400 });
        }

        const admin = getAdminClient();

        // Block duplicate application for the same email + role still pending/verified
        const { data: existingApp } = await admin
            .from('b2b_applications')
            .select('id, status')
            .eq('email', email)
            .eq('role', role)
            .in('status', ['pending', 'verified'])
            .maybeSingle();
        if (existingApp) {
            return NextResponse.json({
                error: existingApp.status === 'verified'
                    ? 'Цей акаунт уже підтверджено. Увійдіть у свій профіль.'
                    : 'Заявка з цією поштою вже на розгляді.',
            }, { status: 409 });
        }

        // 1. Create auth user (auto-confirmed so they can log in immediately;
        //    the discount only activates once we verify, so this is safe).
        const { data: authData, error: authError } = await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        });
        if (authError || !authData?.user) {
            // If the user already exists, fall through to attaching an application
            const msg = authError?.message || '';
            if (!/already been registered|already exists/i.test(msg)) {
                return NextResponse.json({ error: msg || 'Не вдалося створити акаунт' }, { status: 400 });
            }
        }

        const userId = authData?.user?.id;

        // 2. Upsert the customer record with B2B fields = pending
        let customerId: string | null = null;
        if (userId) {
            const { data: cust } = await admin
                .from('customers')
                .upsert({
                    id: userId,
                    auth_user_id: userId,
                    email,
                    name,
                    phone,
                    b2b_role: role,
                    b2b_status: 'pending',
                    b2b_portfolio_url: portfolioUrl,
                }, { onConflict: 'id' })
                .select('id')
                .maybeSingle();
            customerId = cust?.id ?? userId;
        } else {
            // Account already existed (they signed up before as a normal
            // customer). createUser failed so we have no userId — still attach
            // the B2B role/status to their existing customer row, otherwise
            // b2b_role stays null and the discount never applies even after we
            // verify the application (approval only flips b2b_status).
            const { data: cust } = await admin
                .from('customers')
                .update({
                    b2b_role: role,
                    b2b_status: 'pending',
                    b2b_portfolio_url: portfolioUrl,
                })
                .ilike('email', email)
                .select('id')
                .maybeSingle();
            customerId = cust?.id ?? null;
        }

        // 3. Create the application row for the admin review queue
        await admin.from('b2b_applications').insert({
            customer_id: customerId,
            role,
            name,
            email,
            phone,
            portfolio_url: portfolioUrl,
            status: 'pending',
        });

        // 3.5. Photographers get their gallery cabinet + landing IMMEDIATELY —
        // that part is free self-service; only the 10% discount waits for the
        // application to be approved. Idempotent per customer/email.
        let cabinetToken: string | null = null;
        if (role === 'photographer') {
            try {
                const { data: existing } = await admin
                    .from('photographers')
                    .select('id, cabinet_token, customer_id')
                    .or(`${customerId ? `customer_id.eq.${customerId},` : ''}email.ilike.${email}`)
                    .maybeSingle();
                if (existing) {
                    cabinetToken = existing.cabinet_token;
                    if (!existing.customer_id && customerId) {
                        await admin.from('photographers').update({ customer_id: customerId }).eq('id', existing.id);
                    }
                } else {
                    const baseSlug = name.toLowerCase()
                        .replace(/[^a-z0-9а-яіїєґ]+/gi, '-')
                        .replace(/^-+|-+$/g, '')
                        .replace(/[а-яіїєґ]/gi, '')
                        .replace(/^-+|-+$/g, '') || 'photographer';
                    const { data: created } = await admin
                        .from('photographers')
                        .insert({
                            name, email,
                            slug: `${baseSlug}-${String(Date.now()).slice(-5)}`,
                            customer_id: customerId,
                            website: portfolioUrl || null,
                        })
                        .select('cabinet_token')
                        .single();
                    cabinetToken = created?.cabinet_token || null;
                }
            } catch (e) {
                console.error('[b2b/register] cabinet creation failed:', e);
            }
        }
        const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua').replace(/\/$/, '');

        // 4. Emails (best-effort)
        if (getBrevoApiKey()) {
            const roleLabel = role === 'photographer' ? 'Фотограф' : 'Весільна агенція';
            // Notify admin
            await sendBrevoEmail({
                to: 'touch.memories3@gmail.com',
                toName: 'Touch.Memories',
                subject: `Нова B2B-заявка: ${roleLabel} — ${name}`,
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
                      <div style="background:#263A99;padding:20px 28px"><span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:.08em">TOUCH.MEMORIES</span></div>
                      <div style="padding:28px;background:#fff;border:1px solid #e2e8f0">
                        <h2 style="color:#1e2d7d;font-size:20px;margin:0 0 16px">Нова заявка на партнерство</h2>
                        <table style="width:100%;font-size:14px;border-collapse:collapse">
                          <tr><td style="padding:6px 0;color:#6b7280;width:110px">Тип:</td><td style="padding:6px 0;font-weight:600">${roleLabel}</td></tr>
                          <tr><td style="padding:6px 0;color:#6b7280">Імʼя:</td><td style="padding:6px 0;font-weight:600">${escapeHtml(name)}</td></tr>
                          <tr><td style="padding:6px 0;color:#6b7280">Email:</td><td style="padding:6px 0">${escapeHtml(email)}</td></tr>
                          ${phone ? `<tr><td style="padding:6px 0;color:#6b7280">Телефон:</td><td style="padding:6px 0">${escapeHtml(phone)}</td></tr>` : ''}
                          <tr><td style="padding:6px 0;color:#6b7280">Портфоліо:</td><td style="padding:6px 0"><a href="${escapeHtml(portfolioUrl)}" style="color:#1e2d7d">${escapeHtml(portfolioUrl)}</a></td></tr>
                        </table>
                        <p style="font-size:13px;color:#64748b;margin:18px 0 0">Підтвердити або відхилити можна в адмінці → Заявки B2B.</p>
                      </div>
                    </div>`,
                fromName: 'Touch.Memories B2B',
                fromEmail: 'hello@touchmemories.com.ua',
            });
            // Confirm to applicant
            await sendBrevoEmail({
                to: email,
                toName: name,
                subject: 'Дякуємо! Вашу заявку отримано',
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
                      <div style="background:#263A99;padding:24px 28px;text-align:center"><span style="color:#fff;font-size:20px;font-weight:900;letter-spacing:.1em">TOUCH.MEMORIES</span></div>
                      <div style="padding:32px 28px;background:#fff;border:1px solid #e2e8f0">
                        <h2 style="color:#1e2d7d;font-size:22px;margin:0 0 12px">Привіт, ${escapeHtml(name)}!</h2>
                        <p style="font-size:15px;line-height:1.7;color:#475569;margin:0 0 14px">Дякуємо за заявку на партнерську програму TouchMemories. Ми переглянемо ваше портфоліо протягом 1–2 робочих днів і повідомимо про підтвердження на цю пошту.</p>
                        <p style="font-size:15px;line-height:1.7;color:#475569;margin:0">Після підтвердження вам автоматично відкриється постійна знижка ${cfg.discountPercent}% — нічого вводити не доведеться, ціна враховуватиметься щойно ви увійдете у свій акаунт.</p>${cabinetToken ? `
                        <p style="font-size:15px;line-height:1.7;color:#475569;margin:14px 0 0">А <strong>кабінет фотографа</strong> доступний уже зараз: галереї для передачі фото клієнтам (зберігання 30 днів) і ваша сторінка-візитка з портфоліо та прайсом.</p>
                        <p style="margin:16px 0 0"><a href="${siteUrl}/uk/photographer/cabinet/${cabinetToken}" style="background:#1e2d7d;color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">Відкрити кабінет фотографа</a></p>` : ''}
                      </div>
                    </div>`,
                fromName: 'Touch.Memories',
                fromEmail: 'hello@touchmemories.com.ua',
            });
        }

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error('[b2b/register]', err);
        return NextResponse.json({ error: err.message || 'Помилка' }, { status: 500 });
    }
}
