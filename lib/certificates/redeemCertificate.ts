import type { SupabaseClient } from '@supabase/supabase-js';

export interface CertCheck {
    valid: boolean;
    reason?: string;
    id?: string;
    amount?: number;
}

/**
 * Validate a certificate code for use as payment, server-side.
 * Checks existence, not-redeemed, not-expired. Returns the cert id + amount.
 */
export async function checkCertificateForPayment(
    admin: SupabaseClient,
    code: string,
): Promise<CertCheck> {
    const clean = (code || '').trim().toUpperCase();
    if (!clean || !/^[A-Z0-9]{4,16}$/.test(clean)) return { valid: false, reason: 'invalid_format' };

    const { data: cert, error } = await admin
        .from('certificates')
        .select('id, amount, valid_until, redeemed')
        .eq('code', clean)
        .maybeSingle();

    if (error) return { valid: false, reason: 'server_error' };
    if (!cert) return { valid: false, reason: 'not_found' };
    if (cert.redeemed) return { valid: false, reason: 'redeemed' };
    if (cert.valid_until && new Date(cert.valid_until) < new Date()) {
        return { valid: false, reason: 'expired' };
    }
    return { valid: true, id: cert.id, amount: Number(cert.amount) || 0 };
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
