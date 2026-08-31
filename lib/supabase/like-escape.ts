/**
 * Escape LIKE/ILIKE wildcards in a value that must be matched EXACTLY.
 *
 * Postgres reads `%` as "any run of characters" and `_` as "any one
 * character". PostgREST's `.ilike(column, value)` passes the value straight
 * through as a pattern, so any caller-supplied string reaching it is not a
 * value being matched — it is a pattern describing a SET of rows.
 *
 * That has bitten this codebase in three different shapes:
 *   · privilege checks — `_iana@gmail.com` is a pattern matching
 *     `diana@gmail.com`, so a self-registered address could match a
 *     privileged row it does not own;
 *   · secret lookup — `.ilike('code', '_______')` matched every 7-character
 *     promo code and returned a live one;
 *   · mass mutation — `update(...).ilike('email', '%')` matches every row.
 *
 * Escaping the three metacharacters (`\` first, so the escapes themselves are
 * not re-escaped — the regex handles all three in one pass) turns the pattern
 * back into a literal, case-insensitive equality. A normal value containing
 * none of them is returned unchanged, so real logins, emails and codes are
 * unaffected.
 *
 * This lives in its own module — rather than in lib/auth/guards.ts, where it
 * started — so that plain data modules can import it without pulling in
 * next/server and the Supabase server client. guards.ts re-exports it, so
 * existing imports keep working.
 *
 * Prefer `.eq()` where the comparison is genuinely case-sensitive equality;
 * reach for this when case-insensitive matching is the intended behaviour.
 */
export function likeEscape(value: string): string {
    return String(value ?? '').replace(/[\\%_]/g, '\\$&');
}
