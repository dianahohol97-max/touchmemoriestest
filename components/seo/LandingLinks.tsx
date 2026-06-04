import Link from 'next/link';
import { getAdminClient } from '@/lib/supabase/admin';
import { toPublicCategorySlug } from '@/lib/seo/categorySlugs';
import { geoCityLabel, clusterLabel } from '@/lib/seo/landingLabels';

interface Row {
    category_slug: string;
    occasion: string;
    kind: string;
    h1: string | null;
}

// Server component. Renders an internal-links section so crawlers can reach the
// landing pages from the homepage (discovery + internal link equity). Pure
// links, no client JS.
export default async function LandingLinks({ locale }: { locale: string }) {
    const supabase = getAdminClient();
    if (!supabase) return null;

    const { data } = await supabase
        .from('landing_pages')
        .select('category_slug, occasion, kind, h1')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    const rows = (data as Row[]) || [];
    if (!rows.length) return null;

    const geo = rows.filter(r => r.kind === 'geo');
    const others = rows.filter(r => r.kind !== 'geo');

    const href = (r: Row) => `/${locale}/category/${toPublicCategorySlug(r.category_slug)}/${r.occasion}`;
    const cityLabel = (r: Row) => geoCityLabel(r.occasion, r.h1);
    const otherLabel = (r: Row) => clusterLabel(r.h1, r.occasion);

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

    return (
        <section aria-label="Популярні сторінки" style={sectionStyle}>
            <div style={wrapStyle}>
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
        </section>
    );
}
