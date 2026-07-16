import type { Metadata } from 'next';
import { getAdminClient } from '@/lib/supabase/admin';
import { getCanonicalUrl, getAlternateLanguages, getBaseUrl, OG_LOCALE_MAP, type Locale } from '@/lib/seo/locales';
import { getLandingTheme } from '@/lib/photographers/themes';

export const revalidate = 300;

interface Props {
  params: Promise<{ slug: string; locale: string }>;
}

async function getPhotographer(slug: string) {
  const admin = getAdminClient();
  const { data } = await admin
    .from('photographers')
    .select('name, bio, phone, instagram, website, email, logo_url, avatar_url, pricing, portfolio, city, specialization, landing_enabled, landing_theme, is_active')
    .eq('slug', slug)
    .maybeSingle();
  if (!data || !data.is_active || !data.landing_enabled) return null;
  return data;
}

/** "Олена Коваленко — весільний фотограф у Києві" — the exact shape people
 *  search for ("фотограф київ", "весільний фотограф"). */
function seoTitle(p: { name: string; specialization?: string | null; city?: string | null }) {
  const spec = (p.specialization || 'Фотограф').trim();
  const city = (p.city || '').trim();
  return `${p.name} — ${spec.toLowerCase()}${city ? ` у ${city}` : ''}`;
}

function seoDescription(p: { name: string; bio?: string | null; specialization?: string | null; city?: string | null; pricing?: any }) {
  if (p.bio) return p.bio.replace(/\s+/g, ' ').trim().slice(0, 158);
  const spec = (p.specialization || 'фотограф').toLowerCase();
  const city = p.city ? ` у місті ${p.city}` : '';
  const hasPrices = Array.isArray(p.pricing) && p.pricing.length > 0;
  return `${p.name} — ${spec}${city}. Портфоліо, контакти${hasPrices ? ', актуальний прайс на фотозйомку' : ''}. Замовляйте зйомку онлайн.`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale: rawLocale } = await params;
  const locale = (rawLocale || 'uk') as Locale;
  const p = await getPhotographer(slug);
  if (!p) return { title: 'Touch.Memories' };

  const title = seoTitle(p);
  const description = seoDescription(p);
  const portfolio: string[] = Array.isArray(p.portfolio) ? p.portfolio : [];
  const ogImage = p.logo_url || p.avatar_url || portfolio[0] || `${getBaseUrl()}/og-image.jpg`;
  const path = `/photographer/${slug}`;

  return {
    title: `${title} | Touch.Memories`,
    description,
    alternates: {
      canonical: getCanonicalUrl(locale, path),
      languages: getAlternateLanguages(path),
    },
    openGraph: {
      title,
      description,
      url: getCanonicalUrl(locale, path),
      siteName: 'Touch.Memories',
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      locale: OG_LOCALE_MAP[locale],
      type: 'profile',
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  };
}

export default async function PhotographerLandingPage({ params }: Props) {
  const { slug, locale: rawLocale } = await params;
  const locale = (rawLocale || 'uk') as Locale;
  const p = await getPhotographer(slug);

  if (!p) {
    return (
      <div className="container" style={{ padding: '100px 0', textAlign: 'center' }}>
        <h1>Сторінку не знайдено</h1>
      </div>
    );
  }

  const t = getLandingTheme(p.landing_theme);
  const pricing: { title?: string; price?: string; description?: string }[] =
    (Array.isArray(p.pricing) ? p.pricing : []).filter(i => (i?.title || '').trim());
  const portfolio: string[] = Array.isArray(p.portfolio) ? p.portfolio : [];
  const pageUrl = getCanonicalUrl(locale, `/photographer/${slug}`);
  const spec = (p.specialization || 'Фотограф').trim();
  const avatar = p.avatar_url || p.logo_url;
  const instagramHandle = p.instagram ? p.instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '') : null;
  const phoneHref = p.phone ? `tel:${p.phone.replace(/[^\d+]/g, '')}` : null;
  const primaryHref = phoneHref || (p.email ? `mailto:${p.email}` : null);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': pageUrl,
    name: seoTitle(p),
    description: seoDescription(p),
    url: pageUrl,
    ...(p.logo_url || p.avatar_url ? { image: p.logo_url || p.avatar_url } : {}),
    ...(p.phone ? { telephone: p.phone } : {}),
    ...(p.email ? { email: p.email } : {}),
    ...(p.city ? { address: { '@type': 'PostalAddress', addressLocality: p.city, addressCountry: 'UA' } } : {}),
    ...(portfolio.length ? { photo: portfolio.map(u => ({ '@type': 'ImageObject', contentUrl: u })) } : {}),
    founder: { '@type': 'Person', name: p.name, jobTitle: spec },
    ...(pricing.length
      ? {
          makesOffer: pricing.map(i => ({
            '@type': 'Offer',
            name: i.title,
            ...(i.description ? { description: i.description } : {}),
            ...(i.price ? { priceSpecification: { '@type': 'PriceSpecification', price: i.price } } : {}),
          })),
        }
      : {}),
  };

  const centered = t.heroAlign === 'center';
  const btnRadius = t.pill ? 999 : Math.max(t.radius, 2);
  const h1Style: React.CSSProperties = {
    fontFamily: t.headingFont,
    fontWeight: t.headingWeight,
    textTransform: t.headingTransform,
    letterSpacing: t.headingSpacing,
    color: t.ink,
  };
  const kickerStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: t.labelSpacing,
    color: t.faint,
  };
  const sectionH2 = (text: string, kicker: string) => (
    <div style={{ textAlign: centered ? 'center' : 'left', marginBottom: 30 }}>
      <div style={kickerStyle}>{kicker}</div>
      <h2 style={{ ...h1Style, fontSize: 28, margin: '4px 0 0' }}>{text}</h2>
    </div>
  );

  // Portfolio grid presets — genuinely different rhythm per theme.
  const gridStyle: React.CSSProperties =
    t.grid === 'portrait'
      ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }
      : { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 };
  const tileAspect = t.grid === 'portrait' ? '4 / 5' : '1 / 1';

  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.ink }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <header style={{ position: 'relative', overflow: 'hidden' }}>
        {t.heroBackdrop && portfolio[0] && (
          <div aria-hidden style={{ position: 'absolute', inset: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={portfolio[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: t.dark ? 0.22 : 0.14, filter: 'blur(28px)', transform: 'scale(1.1)' }} />
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, ${t.bg}99, ${t.bg}d9 55%, ${t.bg})` }} />
          </div>
        )}

        <div style={{ position: 'relative', maxWidth: 780, margin: '0 auto', padding: '80px 20px 56px', textAlign: centered ? 'center' : 'left' }}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt={seoTitle(p)}
              style={{ width: 120, height: 120, borderRadius: t.pill ? '50%' : t.radius, objectFit: 'cover', margin: centered ? '0 auto' : 0, display: 'block', boxShadow: '0 18px 44px rgba(0,0,0,0.18)', border: `4px solid ${t.card}` }} />
          ) : (
            <div style={{ width: 120, height: 120, borderRadius: t.pill ? '50%' : t.radius, background: t.accent, color: t.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, fontFamily: t.headingFont, fontWeight: t.headingWeight, margin: centered ? '0 auto' : 0, boxShadow: '0 18px 44px rgba(0,0,0,0.18)' }}>
              {p.name.trim().charAt(0).toUpperCase()}
            </div>
          )}

          <div style={{ ...kickerStyle, marginTop: 26 }}>
            {spec}{p.city ? ` · ${p.city}` : ''}
          </div>
          <h1 style={{ ...h1Style, fontSize: 44, lineHeight: 1.12, margin: '8px 0 0' }}>
            {p.name}
          </h1>

          {p.bio && (
            <p style={{ marginTop: 20, fontSize: 16, lineHeight: 1.7, color: t.muted, maxWidth: 560, marginLeft: centered ? 'auto' : 0, marginRight: centered ? 'auto' : 0, whiteSpace: 'pre-wrap' }}>
              {p.bio}
            </p>
          )}

          <div style={{ marginTop: 32, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: centered ? 'center' : 'flex-start' }}>
            {primaryHref && (
              <a href={primaryHref}
                style={{ background: t.accent, color: t.accentInk, borderRadius: btnRadius, padding: '13px 26px', fontSize: 14, fontWeight: 700, textDecoration: 'none', boxShadow: '0 10px 26px rgba(0,0,0,0.14)' }}>
                Забронювати зйомку
              </a>
            )}
            {instagramHandle && (
              <a href={`https://instagram.com/${instagramHandle}`} target="_blank" rel="noopener noreferrer"
                style={{ border: `1px solid ${t.chipBorder}`, background: t.chipBg, color: t.muted, borderRadius: btnRadius, padding: '13px 22px', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                Instagram <span style={{ color: t.faint }}>@{instagramHandle}</span>
              </a>
            )}
            {p.website && (
              <a href={p.website.startsWith('http') ? p.website : `https://${p.website}`} target="_blank" rel="noopener noreferrer"
                style={{ border: `1px solid ${t.chipBorder}`, background: t.chipBg, color: t.muted, borderRadius: btnRadius, padding: '13px 22px', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                Сайт
              </a>
            )}
          </div>

          {(p.phone || p.email) && (
            <div style={{ marginTop: 18, fontSize: 13, color: t.faint }}>
              {p.phone && <a href={phoneHref!} style={{ color: t.faint, textDecoration: 'none' }}>{p.phone}</a>}
              {p.phone && p.email && <span style={{ margin: '0 8px' }}>·</span>}
              {p.email && <a href={`mailto:${p.email}`} style={{ color: t.faint, textDecoration: 'none' }}>{p.email}</a>}
            </div>
          )}
        </div>
      </header>

      {/* ── Portfolio ────────────────────────────────────────── */}
      {portfolio.length > 0 && (
        <section style={{ maxWidth: 1000, margin: '0 auto', padding: '8px 16px 16px' }}>
          {sectionH2('Портфоліо', 'Роботи')}
          <div style={t.grid === 'portrait' ? gridStyle : { ...gridStyle, gridTemplateColumns: 'repeat(auto-fill, minmax(min(240px, 45%), 1fr))' }}>
            {portfolio.map((url, i) => {
              const feature = t.grid === 'feature' && i === 0 && portfolio.length >= 3;
              return (
                <div key={url} style={{
                  position: 'relative', overflow: 'hidden', borderRadius: t.radius, background: t.tileBg,
                  ...(feature ? { gridColumn: 'span 2', gridRow: 'span 2' } : {}),
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`${p.name} — портфоліо, фото ${i + 1}`} loading={i < 3 ? 'eager' : 'lazy'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', aspectRatio: tileAspect, display: 'block', transition: 'transform .5s' }} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Pricing ──────────────────────────────────────────── */}
      {pricing.length > 0 && (
        <section style={{ maxWidth: 660, margin: '0 auto', padding: '48px 20px 8px' }}>
          {sectionH2('Прайс на фотозйомку', 'Вартість')}
          <div style={{ background: t.card, borderRadius: Math.max(t.radius, 4), border: `1px solid ${t.border}`, boxShadow: t.dark ? 'none' : '0 2px 10px rgba(0,0,0,0.04)' }}>
            {pricing.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, padding: '20px 24px', borderTop: i > 0 ? `1px solid ${t.divider}` : 'none' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{item.title}</div>
                  {item.description && <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.6, color: t.muted }}>{item.description}</div>}
                </div>
                {item.price && (
                  <div style={{ flexShrink: 0, fontFamily: t.headingFont, fontWeight: 800, fontSize: 17, whiteSpace: 'nowrap' }}>{item.price}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── CTA band ─────────────────────────────────────────── */}
      {(primaryHref || instagramHandle) && (
        <section style={{ maxWidth: 780, margin: '0 auto', padding: '56px 20px 64px' }}>
          <div style={{ background: t.ctaBandBg, color: t.ctaBandInk, borderRadius: Math.max(t.radius * 2, 4), padding: '48px 32px', textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,0.22)' }}>
            <h2 style={{ ...h1Style, color: t.ctaBandInk, fontSize: 28, margin: 0 }}>Сподобались роботи?</h2>
            <p style={{ marginTop: 8, fontSize: 15, color: t.ctaBandMuted }}>
              Напишіть — обговоримо вашу зйомку{p.city ? ` у місті ${p.city}` : ''}.
            </p>
            <div style={{ marginTop: 26, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
              {phoneHref && (
                <a href={phoneHref} style={{ background: t.ctaBandInk, color: t.ctaBandBg, borderRadius: btnRadius, padding: '12px 24px', fontSize: 14, fontWeight: 800, textDecoration: 'none' }}>
                  Зателефонувати
                </a>
              )}
              {instagramHandle && (
                <a href={`https://instagram.com/${instagramHandle}`} target="_blank" rel="noopener noreferrer"
                  style={{ border: `1px solid ${t.ctaBandMuted}`, color: t.ctaBandInk, borderRadius: btnRadius, padding: '12px 24px', fontSize: 14, fontWeight: 800, textDecoration: 'none' }}>
                  Написати в Instagram
                </a>
              )}
              {p.email && (
                <a href={`mailto:${p.email}`}
                  style={{ border: `1px solid ${t.ctaBandMuted}`, color: t.ctaBandInk, borderRadius: btnRadius, padding: '12px 24px', fontSize: 14, fontWeight: 800, textDecoration: 'none' }}>
                  Email
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Footer note ──────────────────────────────────────── */}
      <footer style={{ paddingBottom: 40, textAlign: 'center' }}>
        <a href={`/${locale}/gallery-for-photographers`} style={{ fontSize: 12, color: t.faint, textDecoration: 'none' }}>
          Сторінку створено на Touch.Memories — галереї та візитки для фотографів
        </a>
      </footer>
    </div>
  );
}
