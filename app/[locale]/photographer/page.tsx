import type { Metadata } from 'next';
import { getAdminClient } from '@/lib/supabase/admin';
import { getCanonicalUrl, getAlternateLanguages, OG_LOCALE_MAP, type Locale } from '@/lib/seo/locales';

export const revalidate = 600;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = (rawLocale || 'uk') as Locale;
  const title = 'Фотографи — каталог перевірених фотографів';
  const description = 'Каталог фотографів Touch.Memories: весільні, сімейні та портретні фотографи з портфоліо, прайсом і контактами. Оберіть фотографа у своєму місті.';
  const path = '/photographer';
  return {
    title: `${title} | Touch.Memories`,
    description,
    alternates: { canonical: getCanonicalUrl(locale, path), languages: getAlternateLanguages(path) },
    openGraph: {
      title, description,
      url: getCanonicalUrl(locale, path),
      siteName: 'Touch.Memories',
      locale: OG_LOCALE_MAP[locale],
      type: 'website',
    },
  };
}

export default async function PhotographersCatalogPage({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = (rawLocale || 'uk') as Locale;
  const admin = getAdminClient();
  const { data: photographers } = await admin
    .from('photographers')
    .select('slug, name, city, specialization, logo_url, avatar_url, bio')
    .eq('is_active', true)
    .eq('landing_enabled', true)
    .order('created_at', { ascending: true });

  const list = photographers || [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Каталог фотографів Touch.Memories',
    itemListElement: list.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: p.name,
      url: getCanonicalUrl(locale, `/photographer/${p.slug}`),
    })),
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 20px 80px', fontFamily: 'Arial, sans-serif', color: '#1f2937' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 style={{ fontSize: 30, fontWeight: 800, color: '#1e2d7d', marginBottom: 8 }}>Фотографи</h1>
      <p style={{ color: '#64748b', marginTop: 0, marginBottom: 28, maxWidth: 640 }}>
        Перевірені фотографи, що працюють із Touch.Memories: портфоліо, прайс і контакти на сторінці кожного фотографа.
      </p>

      <a href={`/${locale}/gallery-for-photographers`}
        style={{ display: 'block', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 14, padding: '16px 20px', marginBottom: 28, textDecoration: 'none', color: '#1e2d7d', fontWeight: 700 }}>
        📷 Ви фотограф? Отримайте безкоштовну галерею для клієнтів і власну сторінку-візитку →
      </a>

      {list.length === 0 && <div style={{ color: '#94a3b8' }}>Каталог наповнюється — завітайте пізніше.</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {list.map(p => (
          <a key={p.slug} href={`/${locale}/photographer/${p.slug}`}
            style={{ display: 'flex', gap: 14, alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: 14, padding: 16, textDecoration: 'none', color: '#1f2937' }}>
            {(p.logo_url || p.avatar_url) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.logo_url || p.avatar_url!} alt={p.name} style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: 12, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>📷</div>
            )}
            <div>
              <div style={{ fontWeight: 800, color: '#1e2d7d' }}>{p.name}</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                {[p.specialization || 'Фотограф', p.city].filter(Boolean).join(' • ')}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
