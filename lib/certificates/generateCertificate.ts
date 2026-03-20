/**
 * Certificate Generation Utilities
 * Handles certificate code generation, validity calculation, and database storage
 */

import { createClient } from '@/lib/supabase/client';

/**
 * Generate a unique 8-character alphanumeric certificate code
 * Format: XXXXXXXX (uppercase letters and numbers, excluding ambiguous chars)
 */
export function generateCertificateCode(): string {
  // Exclude ambiguous characters: 0, O, I, 1, L
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Calculate certificate validity end date
 * Money certificates: 1 year
 * Product certificates: 3 months
 */
export function calculateValidityDate(certificateType: 'money' | 'product'): Date {
  const validUntil = new Date();
  if (certificateType === 'money') {
    validUntil.setFullYear(validUntil.getFullYear() + 1);
  } else {
    validUntil.setMonth(validUntil.getMonth() + 3);
  }
  return validUntil;
}

/**
 * Create certificate record in database
 */
export async function createCertificate(params: {
  certificateType: 'money' | 'product';
  amount?: number;
  productId?: string;
  productName?: string;
  format: 'electronic' | 'printed';
  recipientName?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  deliveryAddress?: any;
  orderId?: string;
  purchaserName?: string;
  purchaserEmail?: string;
  message?: string;
}) {
  const supabase = createClient();

  // Generate unique code
  let code = generateCertificateCode();
  let attempts = 0;
  const maxAttempts = 10;

  // Ensure code is unique
  while (attempts < maxAttempts) {
    const { data: existing } = await supabase
      .from('certificates')
      .select('id')
      .eq('code', code)
      .single();

    if (!existing) break;

    code = generateCertificateCode();
    attempts++;
  }

  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique certificate code');
  }

  // Calculate validity
  const validUntil = calculateValidityDate(params.certificateType);

  // Insert certificate
  const { data, error } = await supabase
    .from('certificates')
    .insert({
      code,
      certificate_type: params.certificateType,
      amount: params.amount,
      product_id: params.productId,
      product_name: params.productName,
      format: params.format,
      recipient_name: params.recipientName,
      recipient_email: params.recipientEmail,
      recipient_phone: params.recipientPhone,
      delivery_address: params.deliveryAddress,
      valid_until: validUntil.toISOString(),
      order_id: params.orderId,
      purchaser_name: params.purchaserName,
      purchaser_email: params.purchaserEmail,
      message: params.message,
      redeemed: false,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating certificate:', error);
    throw new Error('Failed to create certificate');
  }

  return data;
}

/**
 * Generate certificate HTML for email or PDF
 */
export function generateCertificateHTML(certificate: {
  code: string;
  certificate_type: 'money' | 'product';
  amount?: number;
  product_name?: string;
  recipient_name?: string;
  message?: string;
  valid_until: string;
}): string {
  const validUntilDate = new Date(certificate.valid_until).toLocaleDateString('uk-UA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Подарунковий сертифікат Touch.Memories</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #fef3c7 0%, #fff 50%, #fed7aa 100%);
      padding: 40px 20px;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .certificate {
      max-width: 800px;
      background: white;
      border: 3px solid #f59e0b;
      border-radius: 16px;
      padding: 60px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
      position: relative;
      overflow: hidden;
    }
    .certificate::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -50%;
      width: 100%;
      height: 100%;
      background: radial-gradient(circle, rgba(251, 191, 36, 0.1) 0%, transparent 70%);
      pointer-events: none;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      position: relative;
      z-index: 1;
    }
    .logo {
      font-size: 14px;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: #f59e0b;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .title {
      font-size: 36px;
      font-weight: 700;
      color: #1c1917;
      margin-bottom: 8px;
    }
    .subtitle {
      font-size: 18px;
      color: #78716c;
    }
    .content {
      text-align: center;
      margin: 40px 0;
      position: relative;
      z-index: 1;
    }
    .value {
      font-size: 64px;
      font-weight: 800;
      color: #f59e0b;
      margin: 20px 0;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .product-name {
      font-size: 28px;
      font-weight: 700;
      color: #1c1917;
      margin: 20px 0;
    }
    .code-section {
      background: linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%);
      border-radius: 12px;
      padding: 24px;
      margin: 40px 0;
      position: relative;
      z-index: 1;
    }
    .code-label {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #78716c;
      margin-bottom: 8px;
    }
    .code {
      font-size: 32px;
      font-weight: 800;
      color: #1c1917;
      letter-spacing: 6px;
      font-family: 'Courier New', monospace;
    }
    .recipient {
      text-align: center;
      margin: 30px 0;
      font-size: 18px;
      color: #57534e;
      position: relative;
      z-index: 1;
    }
    .recipient strong {
      color: #1c1917;
      font-weight: 600;
    }
    .message {
      background: #fafaf9;
      border-left: 4px solid #f59e0b;
      padding: 20px;
      margin: 30px 0;
      font-style: italic;
      color: #57534e;
      border-radius: 8px;
      position: relative;
      z-index: 1;
    }
    .footer {
      border-top: 2px solid #f5f5f4;
      padding-top: 30px;
      margin-top: 40px;
      text-align: center;
      position: relative;
      z-index: 1;
    }
    .validity {
      font-size: 14px;
      color: #78716c;
      margin-bottom: 16px;
    }
    .instructions {
      font-size: 14px;
      color: #a8a29e;
      line-height: 1.6;
    }
    .contact {
      margin-top: 20px;
      font-size: 13px;
      color: #a8a29e;
    }
    .contact a {
      color: #f59e0b;
      text-decoration: none;
    }
    @media print {
      body { background: white; padding: 0; }
      .certificate { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="header">
      <div class="logo">Touch.Memories · Тернопіль</div>
      <h1 class="title">Подарунковий сертифікат</h1>
      <p class="subtitle">Збережіть найкращі моменти назавжди</p>
    </div>

    <div class="content">
      ${
        certificate.certificate_type === 'money'
          ? `<div class="value">${certificate.amount} ₴</div>`
          : `
            <div class="product-name">${certificate.product_name}</div>
            <p style="color: #78716c; margin-top: 8px;">Сертифікат на продукт</p>
          `
      }
    </div>

    ${
      certificate.recipient_name
        ? `<div class="recipient">Для: <strong>${certificate.recipient_name}</strong></div>`
        : ''
    }

    ${certificate.message ? `<div class="message">${certificate.message}</div>` : ''}

    <div class="code-section">
      <div class="code-label">Код сертифікату</div>
      <div class="code">${certificate.code}</div>
    </div>

    <div class="footer">
      <div class="validity">
        Дійсний до: <strong>${validUntilDate}</strong>
      </div>
      <div class="instructions">
        Використайте цей код при оформленні замовлення на сайті touchmemories.com.ua<br>
        або зв'яжіться з нами для активації сертифікату
      </div>
      <div class="contact">
        <strong>Touch.Memories</strong><br>
        Тернопіль, вул. Січових Стрільців, 22<br>
        Telegram: <a href="https://t.me/touchmemories">@touchmemories</a> ·
        Instagram: <a href="https://instagram.com/touchmemories.te">@touchmemories.te</a><br>
        Тел: +380 67 123 4567
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Validate certificate code and check if it's redeemable
 */
export async function validateCertificate(code: string) {
  const supabase = createClient();

  const { data: certificate, error } = await supabase
    .from('certificates')
    .select('*')
    .eq('code', code.toUpperCase())
    .single();

  if (error || !certificate) {
    return {
      valid: false,
      error: 'Сертифікат не знайдено',
    };
  }

  // Check if already redeemed
  if (certificate.redeemed) {
    return {
      valid: false,
      error: 'Сертифікат вже використано',
      certificate,
    };
  }

  // Check if expired
  const validUntil = new Date(certificate.valid_until);
  if (validUntil < new Date()) {
    return {
      valid: false,
      error: 'Термін дії сертифікату закінчився',
      certificate,
    };
  }

  return {
    valid: true,
    certificate,
  };
}

/**
 * Redeem certificate
 */
export async function redeemCertificate(code: string, orderId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('certificates')
    .update({
      redeemed: true,
      redeemed_at: new Date().toISOString(),
      redeemed_order_id: orderId,
    })
    .eq('code', code.toUpperCase())
    .select()
    .single();

  if (error) {
    throw new Error('Failed to redeem certificate');
  }

  return data;
}
