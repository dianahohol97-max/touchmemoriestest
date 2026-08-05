import { sendBrevoEmail, getBrevoApiKey } from '@/lib/email/brevo';

/**
 * Вітальний лист новому партнеру: його код, умови й посилання на кабінет.
 *
 * Жив усередині /api/admin/agency-partners. Винесений сюди, бо тепер партнера
 * створює ще й підтвердження заявки менеджера (/api/admin/partner-requests) —
 * а два однакові листи в двох роутах розʼїжджаються з першою ж правкою умов.
 *
 * Ніколи не кидає помилку: партнер на цей момент уже створений, і збій пошти
 * не має ламати оформлення. Повертає subject і текст, щоб роут заявок міг
 * покласти той самий лист у переписку з лідом.
 */

const SITE = 'https://touchmemories.com.ua';

export interface PartnerWelcomeInput {
  email: string;
  name: string;
  code: string;
  cabinetToken: string;
  partnerKind: string;
  clientDiscount: number;
  travelbookRate: number;
  otherRate: number;
}

export function buildPartnerWelcomeEmail(input: PartnerWelcomeInput) {
  const { email, name, code, cabinetToken, partnerKind, clientDiscount, travelbookRate, otherRate } = input;
  const kindWord = partnerKind === 'travel_blogger' ? 'блогером'
    : partnerKind === 'photographer' ? 'фотографом'
    : 'агенцією';
  const refLink = `${SITE}/?ref=${code}`;
  const cabinetLink = `${SITE}/uk/partner/${cabinetToken}`;

  const subject = `Вітаємо! Ваш партнерський код touch.memories: ${code}`;

  const html = `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
            <div style="background:#263A99;padding:20px 28px"><span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:.08em">TOUCH.MEMORIES</span></div>
            <div style="padding:28px;background:#fff;border:1px solid #e2e8f0">
              <h2 style="color:#1e2d7d;font-size:20px;margin:0 0 12px">Вітаємо, ${name}!</h2>
              <p style="font-size:14px;color:#334155;margin:0 0 16px">Ви стали партнером-${kindWord} touch.memories. Ось ваш персональний промокод:</p>
              <div style="text-align:center;margin:18px 0"><span style="display:inline-block;font-size:22px;font-weight:800;letter-spacing:.12em;color:#1e2d7d;background:#eef2ff;border:1px dashed #a5b4fc;border-radius:10px;padding:12px 22px">${code}</span></div>
              <table style="width:100%;font-size:14px;border-collapse:collapse;margin:8px 0 16px">
                <tr><td style="padding:6px 0;color:#6b7280">Комісія з тревелбуків:</td><td style="padding:6px 0;font-weight:700;text-align:right">${travelbookRate}%</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280">Комісія з решти товарів:</td><td style="padding:6px 0;font-weight:700;text-align:right">${otherRate}%</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280">Знижка клієнту за кодом:</td><td style="padding:6px 0;font-weight:700;text-align:right">${clientDiscount}%</td></tr>
              </table>
              <p style="font-size:14px;color:#334155;margin:0 0 8px">Клієнт вводить код при оформленні й отримує знижку, а вам нараховується комісія — <b>автоматично після оплати замовлення</b>. Можна ділитися і прямим посиланням:</p>
              <p style="font-size:14px;margin:0 0 16px"><a href="${refLink}" style="color:#263A99">${refLink}</a></p>
              <div style="text-align:center;margin:18px 0"><a href="${cabinetLink}" style="display:inline-block;background:#263A99;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px">Відкрити партнерський кабінет</a></div>
              <p style="font-size:13px;color:#64748b;margin:0 0 16px">Щоб заходити в кабінет будь-коли, навіть без цього листа — <a href="${SITE}/uk/register" style="color:#263A99">створіть акаунт</a> на цю саму пошту (${email}), і далі входьте через <a href="${SITE}/uk/partner/cabinet" style="color:#263A99">touchmemories.com.ua/uk/partner/cabinet</a> — кабінет прив'яжеться автоматично.</p>
              <p style="font-size:13px;color:#64748b;margin:0 0 16px">У кабінеті ви бачите свої нарахування й можете вказати рахунок для виведення коштів. Мінімальна сума виведення — 500 грн; нарахування відбувається автоматично після оплати замовлень.</p>
              <p style="font-size:13px;color:#94a3b8;margin:0">Дякуємо за співпрацю! Якщо виникнуть питання — просто відповідайте на цей лист.</p>
            </div>
          </div>`;

  const text = [
    `Вітаємо, ${name}! Ви стали партнером-${kindWord} touch.memories.`,
    `Ваш персональний промокод: ${code}`,
    `Знижка клієнту за кодом ${clientDiscount}%, ваша комісія ${travelbookRate}% з тревелбуків і ${otherRate}% з решти товарів.`,
    `Реферальне посилання: ${refLink}`,
    `Партнерський кабінет: ${cabinetLink}`,
  ].join('\n\n');

  return { subject, html, text };
}

export async function sendPartnerWelcomeEmail(input: PartnerWelcomeInput) {
  const built = buildPartnerWelcomeEmail(input);
  if (!getBrevoApiKey() || !input.email) return { ...built, sent: false };
  try {
    await sendBrevoEmail({
      to: input.email,
      toName: input.name,
      subject: built.subject,
      html: built.html,
    });
    return { ...built, sent: true };
  } catch (e) {
    console.error('partner welcome email failed (partner still created):', e);
    return { ...built, sent: false };
  }
}
