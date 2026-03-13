import { Resend } from 'resend';
import DesignerBriefEmail from '@/emails/DesignerBriefEmail';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send email with brief link to customer after payment
 */
export async function sendBriefLinkEmail({
  customerEmail,
  customerName,
  orderNumber,
  token,
}: {
  customerEmail: string;
  customerName: string;
  orderNumber: string;
  token: string;
}) {
  const briefUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/brief/${token}`;

  try {
    const { data, error } = await resend.emails.send({
      from: 'TOUCH MEMORIES <noreply@touchmemories.com.ua>',
      to: [customerEmail],
      subject: `Заповніть бриф для вашого фотоальбому — Замовлення ${orderNumber}`,
      react: DesignerBriefEmail({
        customerName,
        orderNumber,
        briefUrl,
      }),
    });

    if (error) {
      console.error('Error sending brief link email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Error sending brief link email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send notification that design is ready for review
 */
export async function sendDesignReadyEmail({
  customerEmail,
  customerName,
  orderNumber,
  reviewToken,
}: {
  customerEmail: string;
  customerName: string;
  orderNumber: string;
  reviewToken: string;
}) {
  const reviewUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/review/${reviewToken}`;

  try {
    const { data, error } = await resend.emails.send({
      from: 'TOUCH MEMORIES <noreply@touchmemories.com.ua>',
      to: [customerEmail],
      subject: `Ваш дизайн готовий! 🎉 Замовлення ${orderNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 32px;">TOUCH MEMORIES</h1>
          </div>

          <div style="padding: 40px; background: #ffffff;">
            <h2 style="color: #333;">Вітаємо, ${customerName}!</h2>

            <p style="font-size: 16px; line-height: 1.6; color: #555;">
              Ваш дизайн фотоальбому готовий! 🎉
            </p>

            <p style="font-size: 16px; line-height: 1.6; color: #555;">
              Наш дизайнер створив макет на основі ваших фото та побажань.
              Тепер ви можете переглянути його та залишити коментарі, якщо потрібні правки.
            </p>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${reviewUrl}" style="background: #667eea; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold; display: inline-block;">
                Переглянути дизайн
              </a>
            </div>

            <p style="font-size: 14px; color: #666;">
              Або скопіюйте посилання: <br/>
              <a href="${reviewUrl}" style="color: #667eea;">${reviewUrl}</a>
            </p>

            <hr style="border: none; border-top: 1px solid #e6ebf1; margin: 32px 0;" />

            <h3 style="color: #333;">Що далі?</h3>

            <p style="font-size: 16px; line-height: 1.6; color: #555;">
              ✅ Перегляньте макет<br/>
              💬 Залишіть коментарі на конкретних сторінках (якщо потрібно)<br/>
              ✏️ Запросіть правки або затвердіть дизайн<br/>
              🖨️ Після затвердження — друк та доставка!
            </p>

            <p style="font-size: 14px; color: #666; text-align: center; margin-top: 32px;">
              Потрібна допомога?<br/>
              📧 <a href="mailto:info@touchmemories.com.ua" style="color: #667eea;">info@touchmemories.com.ua</a><br/>
              📱 <a href="https://t.me/touchmemories" style="color: #667eea;">@touchmemories</a>
            </p>
          </div>

          <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
            © 2026 TOUCH MEMORIES. Створюємо спогади, що залишаються назавжди.
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('Error sending design ready email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Error sending design ready email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send notification that revisions are complete
 */
export async function sendRevisionsCompleteEmail({
  customerEmail,
  customerName,
  orderNumber,
  reviewToken,
}: {
  customerEmail: string;
  customerName: string;
  orderNumber: string;
  reviewToken: string;
}) {
  const reviewUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/review/${reviewToken}`;

  try {
    const { data, error } = await resend.emails.send({
      from: 'TOUCH MEMORIES <noreply@touchmemories.com.ua>',
      to: [customerEmail],
      subject: `Правки виконано ✅ Замовлення ${orderNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 32px;">TOUCH MEMORIES</h1>
          </div>

          <div style="padding: 40px; background: #ffffff;">
            <h2 style="color: #333;">Вітаємо, ${customerName}!</h2>

            <p style="font-size: 16px; line-height: 1.6; color: #555;">
              Дизайнер виконав всі правки, які ви запросили! ✅
            </p>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${reviewUrl}" style="background: #667eea; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold; display: inline-block;">
                Переглянути оновлений дизайн
              </a>
            </div>

            <p style="font-size: 14px; color: #666; text-align: center;">
              Або скопіюйте посилання: <br/>
              <a href="${reviewUrl}" style="color: #667eea;">${reviewUrl}</a>
            </p>
          </div>

          <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
            © 2026 TOUCH MEMORIES
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('Error sending revisions complete email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Error sending revisions complete email:', error);
    return { success: false, error: error.message };
  }
}
