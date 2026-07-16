import crypto from 'crypto';

/**
 * Direct-to-photographer payment integrations. The photographer stores THEIR
 * OWN credentials (Monobank acquiring X-Token / WayForPay merchant account +
 * secret) in their cabinet; invoices are created on their behalf, money lands
 * on their account, and the provider's webhook flips the booking to 'paid'
 * automatically. The platform never holds the funds.
 */

const MONO_API = 'https://api.monobank.ua/api/merchant';
const WFP_API = 'https://api.wayforpay.com/api';

/** Parse "2500 грн" / "2 500грн" / "2500" → integer UAH, or null. */
export function parsePriceUah(price: string | null | undefined): number | null {
  const digits = String(price || '').replace(/[^\d]/g, '');
  const n = parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Create a Monobank acquiring invoice with the photographer's own token. */
export async function monoCreateInvoice(opts: {
  token: string; amountUah: number; reference: string; destination: string;
  redirectUrl: string; webHookUrl: string;
}): Promise<{ invoiceId: string; pageUrl: string }> {
  const res = await fetch(`${MONO_API}/invoice/create`, {
    method: 'POST',
    headers: { 'X-Token': opts.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: Math.round(opts.amountUah * 100),
      ccy: 980,
      merchantPaymInfo: { reference: opts.reference, destination: opts.destination.slice(0, 280) },
      redirectUrl: opts.redirectUrl,
      webHookUrl: opts.webHookUrl,
      validity: 86400,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.invoiceId) {
    throw new Error(json?.errText || json?.errorDescription || `Monobank: помилка створення рахунку (${res.status})`);
  }
  return { invoiceId: json.invoiceId, pageUrl: json.pageUrl };
}

/** Check invoice status with the photographer's token — the webhook handler
 *  re-verifies against this instead of trusting the webhook body. */
export async function monoInvoiceStatus(token: string, invoiceId: string): Promise<string | null> {
  const res = await fetch(`${MONO_API}/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`, {
    headers: { 'X-Token': token },
  });
  const json = await res.json().catch(() => ({}));
  return res.ok ? (json?.status || null) : null;
}

const hmacMd5 = (secret: string, data: string) =>
  crypto.createHmac('md5', secret).update(data, 'utf8').digest('hex');

/** Create a WayForPay invoice (CREATE_INVOICE API) with the photographer's
 *  own merchant credentials. */
export async function wfpCreateInvoice(opts: {
  merchantAccount: string; merchantSecret: string; domain: string;
  amountUah: number; reference: string; productName: string;
  serviceUrl: string; returnUrl: string;
}): Promise<{ invoiceUrl: string }> {
  const orderDate = Math.floor(Date.now() / 1000);
  const amount = opts.amountUah.toFixed(2);
  const signSource = [
    opts.merchantAccount, opts.domain, opts.reference, String(orderDate),
    amount, 'UAH', opts.productName, '1', amount,
  ].join(';');
  const res = await fetch(WFP_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transactionType: 'CREATE_INVOICE',
      merchantAccount: opts.merchantAccount,
      merchantAuthType: 'SimpleSignature',
      merchantDomainName: opts.domain,
      merchantSignature: hmacMd5(opts.merchantSecret, signSource),
      apiVersion: 1,
      orderReference: opts.reference,
      orderDate,
      amount: Number(amount),
      currency: 'UAH',
      productName: [opts.productName],
      productPrice: [Number(amount)],
      productCount: [1],
      serviceUrl: opts.serviceUrl,
      returnUrl: opts.returnUrl,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!json?.invoiceUrl) {
    throw new Error(json?.reason || `WayForPay: помилка створення рахунку (${json?.reasonCode || res.status})`);
  }
  return { invoiceUrl: json.invoiceUrl };
}

/** Verify a WayForPay serviceUrl callback signature. */
export function wfpVerifyCallback(secret: string, body: any): boolean {
  const source = [
    body?.merchantAccount, body?.orderReference, body?.amount, body?.currency,
    body?.authCode, body?.cardPan, body?.transactionStatus, body?.reasonCode,
  ].join(';');
  return hmacMd5(secret, source) === String(body?.merchantSignature || '');
}

/** Build the accept response WayForPay expects from serviceUrl. */
export function wfpAcceptResponse(secret: string, orderReference: string) {
  const time = Math.floor(Date.now() / 1000);
  return {
    orderReference,
    status: 'accept',
    time,
    signature: hmacMd5(secret, [orderReference, 'accept', String(time)].join(';')),
  };
}
