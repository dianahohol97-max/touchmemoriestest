import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendBrevoEmail, getBrevoApiKey } from '@/lib/email/brevo';
import { escapeHtml } from '@/lib/email/escape';
import { buildProposal, type BriefLine, type PriceTier } from '@/lib/corporate/quote';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const companyName = String(body?.companyName || '').trim();
        const contactName = String(body?.contactName || '').trim();
        const email = String(body?.email || '').trim().toLowerCase();
        const phone = body?.phone ? String(body.phone).trim() : null;
        const deadline = body?.deadline ? String(body.deadline).trim().slice(0, 200) : null;
        const message = body?.message ? String(body.message).trim().slice(0, 2000) : null;
        const rawBrief = Array.isArray(body?.brief) ? body.brief : [];

        if (!companyName || companyName.length > 200) {
            return NextResponse.json({ error: 'Вкажіть назву компанії' }, { status: 400 });
        }
        if (!EMAIL_RE.test(email)) {
            return NextResponse.json({ error: 'Невірний email' }, { status: 400 });
        }
        const brief: BriefLine[] = rawBrief
            .filter((l: any) => l && l.product && Number(l.qty) > 0)
            .slice(0, 30)
            .map((l: any) => ({
                product: String(l.product).slice(0, 200),
                slug: l.slug ? String(l.slug) : undefined,
                qty: Math.min(1_000_000, Math.round(Number(l.qty))),
                options: l.options && typeof l.options === 'object' ? l.options : undefined,
            }));
        if (brief.length === 0) {
            return NextResponse.json({ error: 'Додайте хоча б одну позицію до брифу' }, { status: 400 });
        }

        const admin = getAdminClient();

        // Rate limit: the confirmation/proposal email is sent to the client-supplied
        // `email`, so without a cap an attacker can mail-bomb any victim by submitting
        // their address over and over. Cap at 5 submissions per email per hour. This is
        // keyed on the recipient address (not a spoofable client IP), so it cannot be
        // bypassed by rotating the connection.
        const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
        const { count: recentForEmail } = await admin
            .from('corporate_requests')
            .select('id', { count: 'exact', head: true })
            .eq('email', email)
            .gt('created_at', oneHourAgo);
        if ((recentForEmail ?? 0) >= 5) {
            return NextResponse.json({ error: 'Забагато запитів. Спробуйте пізніше.' }, { status: 429 });
        }

        // Try to auto-price: load tiers for the requested product slugs.
        const slugs = Array.from(new Set(brief.map(b => b.slug).filter(Boolean))) as string[];
        const tiersBySlug = new Map<string, PriceTier[]>();
        if (slugs.length > 0) {
            const { data: prods } = await admin
                .from('corporate_products')
                .select('slug, price_tiers')
                .in('slug', slugs);
            (prods || []).forEach((p: any) => {
                if (Array.isArray(p.price_tiers)) tiersBySlug.set(p.slug, p.price_tiers);
            });
        }
        const proposal = buildProposal(brief, tiersBySlug);

        // Save request
        const { data: saved } = await admin.from('corporate_requests').insert({
            company_name: companyName,
            contact_name: contactName || null,
            email,
            phone,
            brief,
            deadline,
            message,
            proposal: proposal.complete ? proposal.lines : null,
            proposal_total: proposal.complete ? proposal.total : null,
            status: proposal.complete ? 'quoted' : 'new',
        }).select('id').maybeSingle();

        if (getBrevoApiKey()) {
            const briefRows = brief.map(b => {
                const opts = b.options ? Object.entries(b.options).map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(v)}`).join(', ') : '';
                return `<tr><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(b.product)}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${b.qty} шт</td><td style="padding:8px;border-bottom:1px solid #eee;color:#64748b;font-size:13px">${opts}</td></tr>`;
            }).join('');

            // Admin notification (always)
            await sendBrevoEmail({
                to: 'touch.memories3@gmail.com',
                toName: 'Touch.Memories',
                subject: `Корпоративний запит: ${companyName}`,
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
                      <div style="background:#263A99;padding:20px 28px"><span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:.08em">TOUCH.MEMORIES</span></div>
                      <div style="padding:28px;background:#fff;border:1px solid #e2e8f0">
                        <h2 style="color:#1e2d7d;font-size:20px;margin:0 0 16px">Новий корпоративний запит</h2>
                        <table style="width:100%;font-size:14px;border-collapse:collapse;margin-bottom:18px">
                          <tr><td style="padding:5px 0;color:#6b7280;width:120px">Компанія:</td><td style="padding:5px 0;font-weight:600">${escapeHtml(companyName)}</td></tr>
                          ${contactName ? `<tr><td style="padding:5px 0;color:#6b7280">Контакт:</td><td style="padding:5px 0">${escapeHtml(contactName)}</td></tr>` : ''}
                          <tr><td style="padding:5px 0;color:#6b7280">Email:</td><td style="padding:5px 0">${escapeHtml(email)}</td></tr>
                          ${phone ? `<tr><td style="padding:5px 0;color:#6b7280">Телефон:</td><td style="padding:5px 0">${escapeHtml(phone)}</td></tr>` : ''}
                          ${deadline ? `<tr><td style="padding:5px 0;color:#6b7280">Дедлайн:</td><td style="padding:5px 0">${escapeHtml(deadline)}</td></tr>` : ''}
                        </table>
                        <table style="width:100%;border-collapse:collapse;font-size:14px">
                          <thead><tr style="background:#f1f5f9"><th style="padding:8px;text-align:left">Товар</th><th style="padding:8px;text-align:center">Кількість</th><th style="padding:8px;text-align:left">Опції</th></tr></thead>
                          <tbody>${briefRows}</tbody>
                        </table>
                        ${proposal.complete
                          ? `<p style="font-size:14px;color:#16a34a;margin:16px 0 0">✅ Пропозицію сформовано автоматично на суму <strong>${proposal.total} грн</strong> і надіслано клієнту.</p>`
                          : `<p style="font-size:14px;color:#d97706;margin:16px 0 0">⏳ Ціни ще не задані для частини товарів — клієнту надіслано повідомлення, що прорахунок буде надіслано вручну.</p>`}
                        ${message ? `<p style="font-size:13px;color:#475569;margin:14px 0 0;background:#f8fafc;padding:10px 14px;border-radius:8px">${escapeHtml(message)}</p>` : ''}
                      </div>
                    </div>`,
                fromName: 'Touch.Memories',
                fromEmail: 'hello@touchmemories.com.ua',
            });

            // Client email — either the auto proposal or a "we'll calculate" note
            if (proposal.complete) {
                const proposalRows = proposal.lines.map(l => {
                    const opts = l.options ? Object.entries(l.options).map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(v)}`).join(', ') : '';
                    return `<tr>
                        <td style="padding:10px;border-bottom:1px solid #eee">${escapeHtml(l.product)}${opts ? `<br><span style="color:#94a3b8;font-size:12px">${opts}</span>` : ''}</td>
                        <td style="padding:10px;border-bottom:1px solid #eee;text-align:center">${l.qty} шт</td>
                        <td style="padding:10px;border-bottom:1px solid #eee;text-align:right">${l.unit_price} грн</td>
                        <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;font-weight:600">${l.line_total} грн</td>
                    </tr>`;
                }).join('');
                await sendBrevoEmail({
                    to: email,
                    toName: contactName || companyName,
                    subject: `Комерційна пропозиція для ${companyName}`,
                    html: `
                        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto">
                          <div style="background:#263A99;padding:24px 28px;text-align:center"><span style="color:#fff;font-size:20px;font-weight:900;letter-spacing:.1em">TOUCH.MEMORIES</span></div>
                          <div style="padding:32px 28px;background:#fff;border:1px solid #e2e8f0">
                            <h2 style="color:#1e2d7d;font-size:22px;margin:0 0 6px">Комерційна пропозиція</h2>
                            <p style="font-size:14px;color:#64748b;margin:0 0 24px">Для: ${escapeHtml(companyName)}</p>
                            <table style="width:100%;border-collapse:collapse;font-size:14px">
                              <thead><tr style="background:#f1f5f9">
                                <th style="padding:10px;text-align:left">Товар</th>
                                <th style="padding:10px;text-align:center">К-сть</th>
                                <th style="padding:10px;text-align:right">Ціна/од</th>
                                <th style="padding:10px;text-align:right">Сума</th>
                              </tr></thead>
                              <tbody>${proposalRows}</tbody>
                              <tfoot><tr>
                                <td colspan="3" style="padding:14px 10px;text-align:right;font-weight:700;font-size:16px">Разом:</td>
                                <td style="padding:14px 10px;text-align:right;font-weight:900;font-size:18px;color:#1e2d7d">${proposal.total} грн</td>
                              </tr></tfoot>
                            </table>
                            <p style="font-size:13px;line-height:1.7;color:#94a3b8;margin:20px 0 0">Це попередній розрахунок на основі вказаних параметрів. Фінальна ціна підтверджується після узгодження макету. Звʼяжіться з нами для оформлення: hello@touchmemories.com.ua</p>
                            <p style="font-size:13px;color:#475569;margin:18px 0 0">ФОП Гоголь Діана Іванівна · Touch.Memories</p>
                          </div>
                        </div>`,
                    fromName: 'Touch.Memories',
                    fromEmail: 'hello@touchmemories.com.ua',
                });
            } else {
                await sendBrevoEmail({
                    to: email,
                    toName: contactName || companyName,
                    subject: 'Дякуємо! Готуємо для вас пропозицію',
                    html: `
                        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
                          <div style="background:#263A99;padding:24px 28px;text-align:center"><span style="color:#fff;font-size:20px;font-weight:900;letter-spacing:.1em">TOUCH.MEMORIES</span></div>
                          <div style="padding:32px 28px;background:#fff;border:1px solid #e2e8f0">
                            <h2 style="color:#1e2d7d;font-size:22px;margin:0 0 12px">Дякуємо, ${escapeHtml(contactName || companyName)}!</h2>
                            <p style="font-size:15px;line-height:1.7;color:#475569;margin:0 0 14px">Ми отримали ваш запит і вже готуємо індивідуальну комерційну пропозицію. Надішлемо її на цю пошту протягом робочого дня.</p>
                            <p style="font-size:15px;line-height:1.7;color:#475569;margin:0">З повагою,<br>Команда Touch.Memories</p>
                          </div>
                        </div>`,
                    fromName: 'Touch.Memories',
                    fromEmail: 'hello@touchmemories.com.ua',
                });
            }
        }

        return NextResponse.json({ ok: true, auto: proposal.complete });
    } catch (err: any) {
        console.error('[corporate/request]', err);
        return NextResponse.json({ error: err.message || 'Помилка' }, { status: 500 });
    }
}
