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
 * Generate certificate HTML — the brand gift certificate (1200×800, 3:2).
 * Mirrors the Canva design: #263A99 field, cream frame with a gift-icon tab,
 * "GIFT / certificate" lockup, amount, validity, vertical code on the right,
 * Instagram handle under the frame. Used for the admin preview and PNG export.
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
  // Fonts are self-hosted in public/certificate-fonts/ (downloaded from Google
  // Fonts' css2 API, latin for Bodoni Moda and Alex Brush, latin + cyrillic
  // for Montserrat 500/700; unicode-range kept from that output). The URLs are
  // ABSOLUTE because this HTML is opened as a blob / srcdoc, where a relative
  // path resolves against nothing. tests/editor-fonts-pack.test.ts forbids new
  // links to fonts.googleapis.com.
  const origin = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua');
  const esc = (v: unknown) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

  const d = new Date(certificate.valid_until);
  const validUntilDate = isNaN(d.getTime())
    ? '—'
    : `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

  const valueLine =
    certificate.certificate_type === 'money'
      ? `НА ${esc(certificate.amount)} ГРН`
      : esc(certificate.product_name || 'СЕРТИФІКАТ НА ПРОДУКТ').toUpperCase();

  return `
<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Подарунковий сертифікат touch.memories ${esc(certificate.code)}</title>
  <style>
    /* Bodoni Moda 400, latin */
    @font-face {
      font-family: 'Bodoni Moda';
      font-style: normal;
      font-weight: 400;
      font-display: swap;
      src: url(${origin}/certificate-fonts/bodoni-moda-400-latin.woff2) format('woff2');
      unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
    }
    /* Alex Brush 400, latin */
    @font-face {
      font-family: 'Alex Brush';
      font-style: normal;
      font-weight: 400;
      font-display: swap;
      src: url(${origin}/certificate-fonts/alex-brush-400-latin.woff2) format('woff2');
      unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
    }
    /* Montserrat 500, latin */
    @font-face {
      font-family: 'Montserrat';
      font-style: normal;
      font-weight: 500;
      font-display: swap;
      src: url(${origin}/certificate-fonts/montserrat-500-latin.woff2) format('woff2');
      unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
    }
    /* Montserrat 500, cyrillic */
    @font-face {
      font-family: 'Montserrat';
      font-style: normal;
      font-weight: 500;
      font-display: swap;
      src: url(${origin}/certificate-fonts/montserrat-500-cyrillic.woff2) format('woff2');
      unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
    }
    /* Montserrat 700, latin */
    @font-face {
      font-family: 'Montserrat';
      font-style: normal;
      font-weight: 700;
      font-display: swap;
      src: url(${origin}/certificate-fonts/montserrat-700-latin.woff2) format('woff2');
      unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
    }
    /* Montserrat 700, cyrillic */
    @font-face {
      font-family: 'Montserrat';
      font-style: normal;
      font-weight: 700;
      font-display: swap;
      src: url(${origin}/certificate-fonts/montserrat-700-cyrillic.woff2) format('woff2');
      unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
    }
  </style>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { background: #e9ebf3; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      font-family: 'Montserrat', Arial, Helvetica, sans-serif;
    }
    .certificate {
      position: relative;
      width: 1200px;
      height: 800px;
      background: #263A99;
      color: #F7F5EF;
      overflow: hidden;
      flex: none;
    }
    .frame {
      position: absolute;
      left: 140px; right: 140px; top: 92px; bottom: 105px;
      border: 5px solid #F7F5EF;
      border-radius: 18px;
    }
    .tab {
      position: absolute;
      left: 50%; top: 0;
      width: 192px; height: 230px;
      margin-left: -96px;
      background: #F7F5EF;
      border-radius: 0 0 96px 96px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding-top: 6px;
    }
    .tab svg { width: 112px; height: 112px; display: block; }
    .code-vertical {
      position: absolute;
      right: 82px; top: 128px;
      transform: rotate(-90deg);
      transform-origin: right top;
      font-weight: 700;
      font-size: 24px;
      letter-spacing: 3px;
      white-space: nowrap;
    }
    .lockup {
      position: absolute;
      left: 0; right: 0; top: 246px;
      text-align: center;
      height: 200px;
    }
    .gift {
      font-family: 'Bodoni Moda', 'Didot', 'Playfair Display', 'Times New Roman', serif;
      font-weight: 400;
      font-size: 190px;
      line-height: 1;
      letter-spacing: 14px;
      color: #F7F5EF;
    }
    .script {
      position: absolute;
      left: 0; right: 0; top: 56px;
      font-family: 'Alex Brush', 'Brush Script MT', cursive;
      font-size: 84px;
      line-height: 1;
      color: #0f1a4d;
      transform: rotate(-4deg);
    }
    .value {
      position: absolute;
      left: 0; right: 0; top: 486px;
      text-align: center;
      font-weight: 700;
      font-size: 34px;
      letter-spacing: 6px;
    }
    .dots {
      position: absolute;
      left: 50%; top: 536px;
      width: 370px; margin-left: -185px;
      border-top: 5px dotted #F7F5EF;
      opacity: .95;
    }
    .validity {
      position: absolute;
      left: 0; right: 0; top: 556px;
      text-align: center;
      font-weight: 500;
      font-size: 22px;
      letter-spacing: 2px;
    }
    .validity .date {
      display: inline-block;
      font-weight: 700;
      font-size: 30px;
      letter-spacing: 3px;
      border-bottom: 5px dotted #F7F5EF;
      padding: 0 22px 2px;
      margin-left: 6px;
      vertical-align: -6px;
    }
    .handle {
      position: absolute;
      left: 0; right: 0; bottom: 34px;
      text-align: center;
      color: #0f1a4d;
      font-weight: 700;
      font-size: 24px;
      letter-spacing: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
    }
    .handle svg { width: 34px; height: 34px; }
    @media print {
      html, body { background: white; padding: 0; }
      .certificate { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="frame"></div>
    <div class="tab">
      <svg viewBox="0 0 64 64" fill="none" stroke="#263A99" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="8" y="26" width="48" height="10" rx="1.5"/>
        <path d="M12 36v20a2 2 0 0 0 2 2h36a2 2 0 0 0 2-2V36"/>
        <path d="M32 26v32"/>
        <path d="M32 26c-6 0-14-1-14-8 0-4 3-6 6-6 5 0 8 9 8 14z"/>
        <path d="M32 26c6 0 14-1 14-8 0-4-3-6-6-6-5 0-8 9-8 14z"/>
      </svg>
    </div>
    <div class="code-vertical">${esc(certificate.code)}</div>
    <div class="lockup">
      <div class="gift">GIFT</div>
      <div class="script">certificate</div>
    </div>
    <div class="value">${valueLine}</div>
    <div class="dots"></div>
    <div class="validity">дійсний до<span class="date">${validUntilDate}</span></div>
    <div class="handle">
      <svg viewBox="0 0 24 24" fill="none" stroke="#0f1a4d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2.5" y="2.5" width="19" height="19" rx="5"/>
        <circle cx="12" cy="12" r="4.2"/>
        <circle cx="17.3" cy="6.7" r="1" fill="#0f1a4d" stroke="none"/>
      </svg>
      TOUCH.MEMORIES
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
