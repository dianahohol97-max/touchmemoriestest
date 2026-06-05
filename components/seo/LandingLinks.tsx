import Link from 'next/link';
import { getAdminClient } from '@/lib/supabase/admin';
import { toPublicCategorySlug } from '@/lib/seo/categorySlugs';
import { geoCityLabel, clusterLabel } from '@/lib/seo/landingLabels';
import { getLocalized } from '@/lib/i18n/localize';

interface Row {
    category_slug: string;
    occasion: string;
    kind: string;
    h1: string | null;
    translations?: any;
}

// Server component. Renders an internal-links section so crawlers can reach the
// landing pages from the homepage (discovery + internal link equity). Pure
// links, no client JS.
export default async function LandingLinks({ locale }: { locale: string }) {
    const supabase = getAdminClient();
    if (!supabase) return null;

    const { data } = await supabase
        .from('landing_pages')
        .select('category_slug, occasion, kind, h1, translations')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    const rows = (data as Row[]) || [];
    if (!rows.length) return null;

    const geo = rows.filter(r => r.kind === 'geo');
    const others = rows.filter(r => r.kind !== 'geo');

    const href = (r: Row) => `/${locale}/category/${toPublicCategorySlug(r.category_slug)}/${r.occasion}`;
    const cityLabel = (r: Row) => geoCityLabel(r.occasion, r.h1);
    const otherLabel = (r: Row) => clusterLabel(getLocalized(r, locale, 'h1'), r.occasion);

    const sectionStyle: React.CSSProperties = {
        background: '#fafafa',
        borderTop: '1px solid #eee',
        padding: '40px 20px',
    };
    const wrapStyle: React.CSSProperties = {
        maxWidth: 1100,
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 28,
    };
    const headingStyle: React.CSSProperties = {
        fontSize: 14,
        fontWeight: 800,
        color: '#263A99',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        margin: '0 0 12px',
    };
    const listStyle: React.CSSProperties = {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px 18px',
        listStyle: 'none',
        padding: 0,
        margin: 0,
    };
    const linkStyle: React.CSSProperties = {
        fontSize: 14,
        color: '#475569',
        textDecoration: 'none',
    };
    const summaryStyle: React.CSSProperties = {
        maxWidth: 1100,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 800,
        color: '#263A99',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    };

    return (
        <section aria-label="Популярні сторінки" style={sectionStyle}>
            <style>{`
                .ll-details > summary { list-style: none; }
                .ll-details > summary::-webkit-details-marker { display: none; }
                .ll-details > summary .ll-chev { transition: transform .2s ease; display: inline-block; font-size: 12px; }
                .ll-details[open] > summary .ll-chev { transform: rotate(180deg); }
                .ll-body { margin-top: 24px; }
            `}</style>
            <details className="ll-details">
                <summary style={summaryStyle}>
                    <span>Популярні сторінки та запити</span>
                    <span className="ll-chev" aria-hidden="true">▾</span>
                </summary>
                <div className="ll-body" style={wrapStyle}>
                {geo.length > 0 && (
                    <div>
                        <h2 style={headingStyle}>Фотокниги з доставкою в містах</h2>
                        <ul style={listStyle}>
                            {geo.map(r => (
                                <li key={`${r.category_slug}-${r.occasion}`}>
                                    <Link href={href(r)} style={linkStyle}>{cityLabel(r)}</Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {others.length > 0 && (
                    <div>
                        <h2 style={headingStyle}>Популярні запити</h2>
                        <ul style={listStyle}>
                            {others.map(r => (
                                <li key={`${r.category_slug}-${r.occasion}`}>
                                    <Link href={href(r)} style={linkStyle}>{otherLabel(r)}</Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                </div>
            </details>
        </section>
    );
}
