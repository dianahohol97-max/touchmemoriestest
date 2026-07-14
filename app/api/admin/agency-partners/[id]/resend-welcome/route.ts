import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth/guards';
import { sendBrevoEmail, getBrevoApiKey } from '@/lib/email/brevo';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/agency-partners/[id]/resend-welcome
 *
 * (Re)sends the partner welcome email — code, commission terms, referral link
 * and the cabinet link — via Brevo. Used when a partner never got (or lost) the
 * email sent at approval. Staff-guarded.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const admin = getAdminClient();
  const { data: p } = await admin
    .from('agency_partners')
    .select('agency_name, email, referral_code, travelbook_rate, other_rate, partner_kind, cabinet_token')
    .eq('id', id)
    .maybeSingle();
  if (!p) return NextResponse.json({ error: 'Партнера не знайдено' }, { status: 404 });
  if (!p.email) return NextResponse.json({ error: 'У партнера немає email' }, { status: 400 });
  if (!getBrevoApiKey()) return NextResponse.json({ error: 'Brevo не налаштовано' }, { status: 500 });

  const clientDiscount = 5;
  const code = p.referral_code;
  const refLink = `https://touchmemories.com.ua/?ref=${code}`;
  const cabinetLink = `https://touchmemories.com.ua/uk/partner/${p.cabinet_token}`;
  const kindWord = p.partner_kind === 'travel_blogger' ? 'блогером' : 'агенцією';

  try {
    await sendBrevoEmail({
      to: p.email,
      toName: p.agency_name,
      subject: `Вітаємо! Ваш партнерський код touch.memories: ${code}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
          <div style="background:#263A99;padding:20px 28px"><span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:.08em">TOUCH.MEMORIES</span></div>
          <div style="padding:28px;background:#fff;border:1px solid #e2e8f0">
            <h2 style="color:#1e2d7d;font-size:20px;margin:0 0 12px">Вітаємо, ${p.agency_name}!</h2>
            <p style="font-size:14px;color:#334155;margin:0 0 16px">Ви стали партнером-${kindWord} touch.memories. Ось ваш персональний промокод:</p>
            <div style="text-align:center;margin:18px 0"><span style="display:inline-block;font-size:22px;font-weight:800;letter-spacing:.12em;color:#1e2d7d;background:#eef2ff;border:1px dashed #a5b4fc;border-radius:10px;padding:12px 22px">${code}</span></div>
            <table style="width:100%;font-size:14px;border-collapse:collapse;margin:8px 0 16px">
              <tr><td style="padding:6px 0;color:#6b7280">Комісія з тревелбуків:</td><td style="padding:6px 0;font-weight:700;text-align:right">${p.travelbook_rate}%</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280">Комісія з решти товарів:</td><td style="padding:6px 0;font-weight:700;text-align:right">${p.other_rate}%</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280">Знижка клієнту за кодом:</td><td style="padding:6px 0;font-weight:700;text-align:right">${clientDiscount}%</td></tr>
            </table>
            <p style="font-size:14px;color:#334155;margin:0 0 16px">Клієнт вводить код при оформленні й отримує знижку, а вам нараховується комісія — <b>автоматично після оплати замовлення</b>. Можна ділитися і прямим посиланням:</p>
            <p style="font-size:14px;margin:0 0 16px"><a href="${refLink}" style="color:#263A99">${refLink}</a></p>
            <div style="text-align:center;margin:18px 0"><a href="${cabinetLink}" style="display:inline-block;background:#263A99;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px">Відкрити партнерський кабінет</a></div>
            <p style="font-size:13px;color:#64748b;margin:0 0 16px">У кабінеті ви бачите свої нарахування й можете вказати рахунок для виведення коштів. Мінімальна сума виведення — 500 грн.</p>
            <p style="font-size:13px;color:#94a3b8;margin:0">Дякуємо за співпрацю! Якщо виникнуть питання — просто відповідайте на цей лист.</p>
          </div>
        </div>`,
    });
    return NextResponse.json({ ok: true, sentTo: p.email });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Не вдалося надіслати лист' }, { status: 502 });
  }
}
