import type { Metadata } from 'next';
import UnsubscribeForm from './UnsubscribeForm';

export const dynamic = 'force-dynamic';

// Never index or follow: this page exists only for people arriving from a
// letter, and a crawler walking it would be pointless traffic.
export const metadata: Metadata = {
    title: 'Відписатися від розсилки | Touch.Memories',
    robots: { index: false, follow: false },
};

/**
 * Landing page for the "Відписатися від розсилки" link in every newsletter.
 *
 * Until now that link pointed at /unsubscribe, which did not exist — the
 * recipient got a 404 and had no way to leave the list except by marking the
 * letter as spam, which damages the sending domain for everyone.
 *
 * The link carries no locale prefix, so the middleware redirects it to
 * /{locale}/unsubscribe and the query string survives that hop.
 */
export default async function UnsubscribePage({
    searchParams,
}: {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ token?: string; email?: string; c?: string }>;
}) {
    const sp = await searchParams;

    return (
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 20px' }}>
            <div
                style={{
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20,
                    padding: 40, maxWidth: 560, width: '100%',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.06)',
                }}
            >
                <UnsubscribeForm
                    token={String(sp?.token || '')}
                    email={String(sp?.email || '')}
                    campaignId={String(sp?.c || '')}
                />
            </div>
        </div>
    );
}
