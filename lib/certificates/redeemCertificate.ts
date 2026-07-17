import type { SupabaseClient } from '@supabase/supabase-js';

export interface CertCheck {
    valid: boolean;
    reason?: string;
    id?: string;
    amount?: number;
}

/**
 * A certificate applied at checkout stays "reserved" for this long. Within the
 * window no other order can apply the same code; after it, an unpaid order
 * silently loses its hold (Monobank payment links expire within 24h anyway).
 */
export const CERT_RESERVATION_TTL_MS = 24 * 60 * 60 * 1000;

export function certReservationCutoffISO(): string {
    return new Date(Date.now() - CERT_RESERVATION_TTL_MS).toISOString();
}

/**
 * Validate a certificate code for use as payment, server-side.
 * Checks existence, not-redeemed, not-expired, not actively reserved by
 * another pending order. Returns the cert id + amount.
 */
export async function checkCertificateForPayment(
    admin: SupabaseClient,
    code: string,
    forOrderId?: string,
): Promise<CertCheck> {
    const clean = (code || '').trim().toUpperCase();
    if (!clean || !/^[A-Z0-9]{4,16}$/.test(clean)) return { valid: false, reason: 'invalid_format' };

    const { data: cert, error } = await admin
        .from('certificates')
        .select('id, amount, valid_until, redeemed, reserved_order_id, reserved_at')
        .eq('code', clean)
        .maybeSingle();

    if (error) return { valid: false, reason: 'server_error' };
    if (!cert) return { valid: false, reason: 'not_found' };
    if (cert.redeemed) return { valid: false, reason: 'redeemed' };
    if (cert.valid_until && new Date(cert.valid_until) < new Date()) {
        return { valid: false, reason: 'expired' };
    }
    const activelyReserved = cert.reserved_order_id
        && cert.reserved_order_id !== forOrderId
        && cert.reserved_at
        && new Date(cert.reserved_at).toISOString() >= certReservationCutoffISO();
    if (activelyReserved) return { valid: false, reason: 'reserved' };
    return { valid: true, id: cert.id, amount: Number(cert.amount) || 0 };
}

/**
 * Atomically reserve a certificate for one order. This is the race guard the
 * plain check above cannot provide: the UPDATE only succeeds when the cert is
 * still unredeemed AND not held by another live reservation, so two parallel
 * checkouts with the same code can never both get the discount.
 *
 * Returns true when this order now holds the reservation.
 */
export async function reserveCertificateForOrder(
    admin: SupabaseClient,
    certId: string,
    orderId: string,
): Promise<boolean> {
    const cutoff = certReservationCutoffISO();
    const { data, error } = await admin
        .from('certificates')
        .update({ reserved_order_id: orderId, reserved_at: new Date().toISOString() })
        .eq('id', certId)
        .eq('redeemed', false)
        .or(`reserved_order_id.is.null,reserved_order_id.eq.${orderId},reserved_at.is.null,reserved_at.lt.${cutoff}`)
        .select('id');
    if (error) {
        console.error('reserveCertificateForOrder failed:', error);
        return false;
    }
    return !!data && data.length > 0;
}

/**
 * Best-effort release of a reservation (used when order creation fails after
 * the cert was already reserved). Only touches rows this order actually holds.
 */
export async function releaseCertificateReservation(
    admin: SupabaseClient,
    orderId: string,
): Promise<void> {
    await admin
        .from('certificates')
        .update({ reserved_order_id: null, reserved_at: null })
        .eq('reserved_order_id', orderId)
        .eq('redeemed', false);
}

/**
 * How much of an order a certificate covers, and the leftover.
 * The certificate is single-use: any leftover goes to the buyer's bonus balance.
 */
export function computeCertificateCoverage(certAmount: number, orderTotal: number) {
    const applied = Math.min(certAmount, orderTotal);   // covers up to the total
    const leftover = Math.max(0, certAmount - orderTotal); // remainder → bonuses
    const remainingToPay = Math.max(0, orderTotal - applied);
    return { applied, leftover, remainingToPay };
}

/**
 * Redeem a certificate for a paid order: mark it redeemed and credit any
 * leftover (cert amount − applied) to the buyer's bonus balance.
 *
 * Idempotent and safe under webhook retries:
 *  - atomically flips certificates.redeemed false→true (race guard)
 *  - only the call that wins the flip credits the leftover + flags the order
 *  - leftover bonus requires a logged-in customer_id (guests have no balance)
 */
export async function redeemOrderCertificate(
    admin: SupabaseClient,
    opts: { orderId: string; code: string; applied: number; customerId: string | null },
): Promise<void> {
    const { orderId, code, applied, customerId } = opts;
    const clean = (code || '').trim().toUpperCase();
    if (!clean) return;

    // Load the certificate's full amount to compute leftover.
    const { data: cert } = await admin
        .from('certificates')
        .select('id, amount, redeemed')
        .eq('code', clean)
        .maybeSingle();
    if (!cert || cert.redeemed) {
        // Already redeemed (or gone). Still flag the order so we don't retry.
        await admin.from('orders').update({ certificate_redeemed: true }).eq('id', orderId);
        return;
    }

    // Atomic flip: only succeeds if still not redeemed.
    const { data: flipped } = await admin
        .from('certificates')
        .update({ redeemed: true, redeemed_at: new Date().toISOString() })
        .eq('id', cert.id)
        .eq('redeemed', false)
        .select('id');
    if (!flipped || flipped.length === 0) {
        await admin.from('orders').update({ certificate_redeemed: true }).eq('id', orderId);
        return;
    }

    // Mark the order's certificate as redeemed.
    await admin.from('orders').update({ certificate_redeemed: true }).eq('id', orderId);

    // Leftover → bonus balance (only for a known customer).
    const leftover = Math.max(0, (Number(cert.amount) || 0) - (Number(applied) || 0));
    if (leftover > 0 && customerId) {
        const { data: customer } = await admin
            .from('customers')
            .select('bonus_balance')
            .eq('id', customerId)
            .maybeSingle();
        const newBalance = Number(customer?.bonus_balance || 0) + leftover;
        await admin.from('customers').update({ bonus_balance: newBalance }).eq('id', customerId);
        await admin.from('bonus_transactions').insert({
            customer_id: customerId,
            amount: leftover,
            kind: 'adjustment',
            order_id: orderId,
            note: `Залишок сертифіката ${clean} зараховано на бонусний рахунок`,
        });
    }
}
