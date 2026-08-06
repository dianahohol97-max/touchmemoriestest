const SITE_URL = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://touchmemories.com.ua'
).replace(/\/$/, '');

export interface UnsubscribeTarget {
    /** Recipient address. Used as the link identity when no token exists. */
    email: string;
    /** subscribers.unsubscribe_token, when the recipient is on the list. */
    token?: string | null;
    /** email_campaigns.id, so a departure can be attributed to a letter. */
    campaignId?: string | null;
}

function escapeHtml(s: string): string {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Build the unsubscribe URL for one recipient.
 *
 * The token is preferred because it identifies the person without putting
 * their address in a link anyone could edit. Imported CRM contacts have no
 * token — they were never subscribers — so those fall back to the address, and
 * the unsubscribe route creates a suppression entry for them.
 */
export function buildUnsubscribeUrl({ email, token, campaignId }: UnsubscribeTarget): string {
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    else params.set('email', email);
    if (campaignId) params.set('c', campaignId);
    return `${SITE_URL}/unsubscribe?${params.toString()}`;
}

/**
 * Footer appended to every MARKETING email. Deliberately not applied to
 * transactional mail (order placed, paid, shipped) — those are not something a
 * customer opts out of, and offering it there would be misleading.
 */
export function buildUnsubscribeFooter(target: UnsubscribeTarget): string {
    const url = escapeHtml(buildUnsubscribeUrl(target));
    return `
<div style="margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#9ca3af;font-family:sans-serif;line-height:1.6;">
  Ви отримали цей лист, бо замовляли у Touch.Memories.<br/>
  <a href="${url}" style="color:#9ca3af;text-decoration:underline;">Відписатися від розсилки</a>
</div>`;
}

/** Insert the footer inside &lt;body&gt; when there is one, otherwise append. */
export function withUnsubscribeFooter(html: string, target: UnsubscribeTarget): string {
    const footer = buildUnsubscribeFooter(target);
    return html.includes('</body>') ? html.replace('</body>', `${footer}</body>`) : html + footer;
}
