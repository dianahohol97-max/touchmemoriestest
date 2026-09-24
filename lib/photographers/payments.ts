/**
 * Monobank acquiring for the photographers' storage plans: the invoice is
 * created on the PLATFORM account (see app/api/photographers/subscription).
 *
 * This file used to carry the direct-to-photographer payments of the landing
 * booking too (the photographer's own Monobank token or WayForPay merchant),
 * with a WayForPay client and a price parser. Those went with the landing and
 * its booking (Diana, 2026-09-24).
 */

const MONO_API = 'https://api.monobank.ua/api/merchant';

/** Create a Monobank acquiring invoice with the given merchant token. */
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

/** Check invoice status with the merchant token — the webhook handler
 *  re-verifies against this instead of trusting the webhook body. */
export async function monoInvoiceStatus(token: string, invoiceId: string): Promise<string | null> {
  const res = await fetch(`${MONO_API}/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`, {
    headers: { 'X-Token': token },
  });
  const json = await res.json().catch(() => ({}));
  return res.ok ? (json?.status || null) : null;
}
