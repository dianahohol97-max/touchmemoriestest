/**
 * Browser-side access to the referral code a visitor arrived with.
 *
 * ReferralCapture stashes ?ref=CODE here on landing; the signup forms read it
 * back so the code can travel into Supabase auth user_metadata as well. Two
 * independent carriers on purpose: localStorage dies if the friend confirms
 * their email on a different device (phone vs desktop), and the metadata copy
 * is what lets /api/referral/capture still link them there.
 *
 * Kept in one module so the register page and AuthModal cannot drift apart.
 */
export const REF_STORAGE_KEY = 'tm_ref_code';

/** The stored code, normalised, or null outside the browser / when unset. */
export function readPendingReferralCode(): string | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(REF_STORAGE_KEY);
        if (!raw) return null;
        const code = raw.trim().toUpperCase();
        return code.length >= 4 && code.length <= 16 ? code : null;
    } catch {
        return null;
    }
}
