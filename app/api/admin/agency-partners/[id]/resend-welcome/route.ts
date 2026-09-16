import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth/guards';
import { getBrevoApiKey } from '@/lib/email/brevo';
import { sendPartnerWelcomeEmail } from '@/lib/agency/welcome-email';
import { DEFAULT_PARTNER_TERMS } from '@/lib/agency/create-partner';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/agency-partners/[id]/resend-welcome
 *
 * Надсилає партнеру вітальний лист ще раз — коли перший не дійшов або загубився.
 * Під охороною співробітника.
 *
 * ЛИСТ БУДУЄТЬСЯ КАНОНІЧНОЮ ФУНКЦІЄЮ, і це не косметика. До 16.09.2026 весь
 * лист був вписаний прямо в цей роут другою копією того, що робить
 * lib/agency/welcome-email.ts, і копія встигла розійтися з оригіналом за
 * чотирма пунктами одразу. Вона вела КОДОМ, а не посиланням, хоча посилання
 * стало головним інструментом партнера саме тому, що за ним знижка
 * застосовується сама. Знижку клієнта вона мала зашитою числом 5 замість того,
 * щоб читати з промокоду партнера, — тобто показувала б 5% навіть партнеру з
 * іншими умовами. Вона знала два види партнера з чотирьох і називала фотографа
 * «агенцією». І про довічну привʼязку не згадувала зовсім, хоча це головна
 * умова партнерства.
 *
 * Кнопка «Надіслати лист» в адмінці спирається саме на цей роут, тож розбіжність
 * була не теоретичною: партнер, якому лист надсилали вдруге, отримував інші
 * умови, ніж партнер, якому він пішов при оформленні.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const admin = getAdminClient();
  const { data: p } = await admin
    .from('agency_partners')
    .select('agency_name, email, referral_code, travelbook_rate, other_rate, partner_kind, cabinet_token, promo_code_id')
    .eq('id', id)
    .maybeSingle();
  if (!p) return NextResponse.json({ error: 'Партнера не знайдено' }, { status: 404 });
  if (!p.email) return NextResponse.json({ error: 'У партнера немає email' }, { status: 400 });
  if (!getBrevoApiKey()) return NextResponse.json({ error: 'Brevo не налаштовано' }, { status: 500 });

  /**
   * Знижка клієнта живе в промокоді партнера, а не в самому партнері. Читаємо
   * саме звідти, щоб у листі не зʼявилося число, якого насправді немає в
   * чекауті; вимкнений промокод знижки не дає, тож і обіцяти її не можна.
   */
  let clientDiscount: number = DEFAULT_PARTNER_TERMS.clientDiscount;
  if (p.promo_code_id) {
    const { data: promo } = await admin
      .from('promo_codes')
      .select('type, value, is_active')
      .eq('id', p.promo_code_id)
      .maybeSingle();
    if (promo?.is_active && promo.type === 'percent') clientDiscount = Number(promo.value) || 0;
    else if (promo && !promo.is_active) clientDiscount = 0;
  }

  const result = await sendPartnerWelcomeEmail({
    email: p.email,
    name: p.agency_name,
    code: p.referral_code,
    cabinetToken: p.cabinet_token,
    partnerKind: p.partner_kind,
    clientDiscount,
    travelbookRate: Number(p.travelbook_rate) || 0,
    otherRate: Number(p.other_rate) || 0,
  });

  // sendPartnerWelcomeEmail ніколи не кидає — вона писалася для шляху, де
  // партнер уже створений і збій пошти не має ламати оформлення. Тут партнер
  // існує давно, а надсилання листа і є вся дія, тож про відмову треба сказати.
  if (!result.sent) {
    return NextResponse.json({ error: 'Не вдалося надіслати лист' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, sentTo: p.email });
}
