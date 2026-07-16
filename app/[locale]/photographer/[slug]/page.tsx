import type { Metadata } from 'next';
import { getAdminClient } from '@/lib/supabase/admin';

export const revalidate = 300;

interface Props {
  params: Promise<{ slug: string; locale: string }>;
}

async function getPhotographer(slug: string) {
  const admin = getAdminClient();
  const { data } = await admin
    .from('photographers')
    .select('name, bio, phone, instagram, website, email, logo_url, avatar_url, pricing, portfolio, landing_enabled, is_active')
    .eq('slug', slug)
    .maybeSingle();
  if (!data || !data.is_active || !data.landing_enabled) return null;
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPhotographer(slug);
  if (!p) return { title: 'Touch.Memories' };
  return {
    title: `${p.name} — фотограф | Touch.Memories`,
    description: (p.bio || `Фотограф ${p.name}: портфоліо, прайс і контакти.`).slice(0, 160),
  };
}

export default async function PhotographerLandingPage({ params }: Props) {
  const { slug } = await params;
  const p = await getPhotographer(slug);

  if (!p) {
    return (
      <div className="container" style={{ padding: '100px 0', textAlign: 'center' }}>
        <h1>Сторінку не знайдено</h1>
      </div>
    );
  }

  const pricing: { title?: string; price?: string; description?: string }[] = Array.isArray(p.pricing) ? p.pricing : [];
  const portfolio: string[] = Array.isArray(p.portfolio) ? p.portfolio : [];
  const contacts = [
    p.phone && { label: '📞', value: p.phone, href: `tel:${p.phone.replace(/[^\d+]/g, '')}` },
    p.email && { label: '✉️', value: p.email, href: `mailto:${p.email}` },
    p.instagram && { label: '📷', value: p.instagram.replace(/^@/, ''), href: `https://instagram.com/${p.instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '')}` },
    p.website && { label: '🌐', value: p.website.replace(/^https?:\/\//, ''), href: p.website.startsWith('http') ? p.website : `https://${p.website}` },
  ].filter(Boolean) as { label: string; value: string; href: string }[];

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '48px 20px 80px', fontFamily: 'Arial, sans-serif', color: '#1f2937' }}>
      {/* Business card header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', marginBottom: 28 }}>
        {(p.logo_url || p.avatar_url) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.logo_url || p.avatar_url!} alt={p.name} style={{ width: 96, height: 96, borderRadius: 16, objectFit: 'cover', border: '1px solid #e5e7eb' }} />
        )}
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, color: '#1e2d7d' }}>{p.name}</h1>
          <div style={{ color: '#64748b', marginTop: 4 }}>Фотограф</div>
        </div>
      </div>

      {p.bio && <p style={{ fontSize: 16, lineHeight: 1.65, marginBottom: 28, whiteSpace: 'pre-wrap' }}>{p.bio}</p>}

      {contacts.length > 0 && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 40 }}>
          {contacts.map(c => (
            <a key={c.href} href={c.href} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#f1f5f9', borderRadius: 999, padding: '9px 16px', textDecoration: 'none', color: '#1e2d7d', fontWeight: 600, fontSize: 14 }}>
              <span>{c.label}</span><span>{c.value}</span>
            </a>
          ))}
        </div>
      )}

      {/* Portfolio */}
      {portfolio.length > 0 && (
        <section style={{ marginBottom: 44 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1e2d7d', marginBottom: 16 }}>Портфоліо</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {portfolio.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="" loading="lazy"
                style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 10, background: '#f1f5f9' }} />
            ))}
          </div>
        </section>
      )}

      {/* Pricing */}
      {pricing.length > 0 && (
        <section>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1e2d7d', marginBottom: 16 }}>Прайс</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {pricing.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'baseline', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 18px', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 200 }}>
                  <div style={{ fontWeight: 700 }}>{item.title}</div>
                  {item.description && <div style={{ color: '#64748b', fontSize: 14, marginTop: 2 }}>{item.description}</div>}
                </div>
                <div style={{ fontWeight: 800, color: '#1e2d7d', whiteSpace: 'nowrap' }}>{item.price}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
