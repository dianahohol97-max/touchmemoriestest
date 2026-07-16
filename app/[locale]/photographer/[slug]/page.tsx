import type { Metadata } from 'next';
import { getAdminClient } from '@/lib/supabase/admin';
import { getCanonicalUrl, getAlternateLanguages, getBaseUrl, OG_LOCALE_MAP, type Locale } from '@/lib/seo/locales';

export const revalidate = 300;

interface Props {
  params: Promise<{ slug: string; locale: string }>;
}

async function getPhotographer(slug: string) {
  const admin = getAdminClient();
  const { data } = await admin
    .from('photographers')
    .select('name, bio, phone, instagram, website, email, logo_url, avatar_url, pricing, portfolio, city, specialization, landing_enabled, is_active')
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

  const pricing: { title?: string; price?: string; description?: string }[] =
    (Array.isArray(p.pricing) ? p.pricing : []).filter(i => (i?.title || '').trim());
  const portfolio: string[] = Array.isArray(p.portfolio) ? p.portfolio : [];
  const pageUrl = getCanonicalUrl(locale, `/photographer/${slug}`);
  const spec = (p.specialization || 'Фотограф').trim();
  const avatar = p.avatar_url || p.logo_url;
  const instagramHandle = p.instagram ? p.instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '') : null;
  const phoneHref = p.phone ? `tel:${p.phone.replace(/[^\d+]/g, '')}` : null;

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

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#1c1917]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <header className="relative overflow-hidden">
        {/* Soft backdrop from the first portfolio shot */}
        {portfolio[0] && (
          <div aria-hidden className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={portfolio[0]} alt="" className="w-full h-full object-cover opacity-[0.14] blur-2xl scale-110" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#faf8f5]/60 via-[#faf8f5]/85 to-[#faf8f5]" />
          </div>
        )}

        <div className="relative max-w-3xl mx-auto px-5 pt-20 pb-14 text-center">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt={seoTitle(p)}
              className="w-28 h-28 md:w-32 md:h-32 rounded-full object-cover mx-auto shadow-xl ring-4 ring-white" />
          ) : (
            <div className="w-28 h-28 rounded-full mx-auto bg-[#1c1917] text-[#faf8f5] flex items-center justify-center text-4xl font-heading font-bold shadow-xl ring-4 ring-white">
              {p.name.trim().charAt(0).toUpperCase()}
            </div>
          )}

          <div className="mt-6 text-[11px] md:text-xs font-semibold uppercase tracking-[0.28em] text-[#a8a29e]">
            {spec}{p.city ? ` · ${p.city}` : ''}
          </div>
          <h1 className="mt-2 font-heading font-extrabold tracking-tight text-4xl md:text-5xl leading-tight">
            {p.name}
          </h1>

          {p.bio && (
            <p className="mt-5 text-[15px] md:text-base leading-relaxed text-[#57534e] max-w-xl mx-auto whitespace-pre-wrap">
              {p.bio}
            </p>
          )}

          {/* Contact actions */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {phoneHref && (
              <a href={phoneHref}
                className="inline-flex items-center gap-2 bg-[#1c1917] text-[#faf8f5] rounded-full px-6 py-3 text-sm font-semibold shadow-lg shadow-black/10 hover:bg-black transition-colors">
                Забронювати зйомку
              </a>
            )}
            {!phoneHref && p.email && (
              <a href={`mailto:${p.email}`}
                className="inline-flex items-center gap-2 bg-[#1c1917] text-[#faf8f5] rounded-full px-6 py-3 text-sm font-semibold shadow-lg shadow-black/10 hover:bg-black transition-colors">
                Забронювати зйомку
              </a>
            )}
            {instagramHandle && (
              <a href={`https://instagram.com/${instagramHandle}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold border border-[#d6d3d1] text-[#44403c] hover:border-[#1c1917] hover:text-[#1c1917] transition-colors bg-white/70">
                Instagram <span className="text-[#a8a29e]">@{instagramHandle}</span>
              </a>
            )}
            {p.website && (
              <a href={p.website.startsWith('http') ? p.website : `https://${p.website}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold border border-[#d6d3d1] text-[#44403c] hover:border-[#1c1917] hover:text-[#1c1917] transition-colors bg-white/70">
                Сайт
              </a>
            )}
          </div>

          {(p.phone || p.email) && (
            <div className="mt-4 text-[13px] text-[#a8a29e]">
              {p.phone && <a href={phoneHref!} className="hover:text-[#57534e]">{p.phone}</a>}
              {p.phone && p.email && <span className="mx-2">·</span>}
              {p.email && <a href={`mailto:${p.email}`} className="hover:text-[#57534e]">{p.email}</a>}
            </div>
          )}
        </div>
      </header>

      {/* ── Portfolio ────────────────────────────────────────── */}
      {portfolio.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 md:px-6 pb-4">
          <div className="text-center mb-8">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#a8a29e]">Роботи</div>
            <h2 className="mt-1 font-heading font-extrabold tracking-tight text-2xl md:text-3xl">Портфоліо</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 [grid-auto-rows:1fr]">
            {portfolio.map((url, i) => (
              <div key={url}
                className={`relative overflow-hidden rounded-xl bg-[#e7e5e4] ${i === 0 && portfolio.length >= 3 ? 'col-span-2 row-span-2' : ''}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`${p.name} — портфоліо, фото ${i + 1}`} loading={i < 3 ? 'eager' : 'lazy'}
                  className="w-full h-full object-cover aspect-square transition-transform duration-500 hover:scale-[1.03]" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Pricing ──────────────────────────────────────────── */}
      {pricing.length > 0 && (
        <section className="max-w-2xl mx-auto px-5 pt-14 pb-4">
          <div className="text-center mb-8">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#a8a29e]">Вартість</div>
            <h2 className="mt-1 font-heading font-extrabold tracking-tight text-2xl md:text-3xl">Прайс на фотозйомку</h2>
          </div>

          <div className="bg-white rounded-2xl border border-[#e7e5e4] shadow-sm divide-y divide-[#f5f5f4]">
            {pricing.map((item, i) => (
              <div key={i} className="flex items-baseline justify-between gap-4 px-6 py-5">
                <div className="min-w-0">
                  <div className="font-semibold text-[15px]">{item.title}</div>
                  {item.description && <div className="mt-1 text-[13px] leading-relaxed text-[#78716c]">{item.description}</div>}
                </div>
                {item.price && (
                  <div className="shrink-0 font-heading font-extrabold text-[17px] whitespace-nowrap">{item.price}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── CTA band ─────────────────────────────────────────── */}
      {(phoneHref || p.email || instagramHandle) && (
        <section className="max-w-3xl mx-auto px-5 py-16">
          <div className="bg-[#1c1917] text-[#faf8f5] rounded-3xl px-8 py-12 text-center shadow-2xl shadow-black/20">
            <h2 className="font-heading font-extrabold tracking-tight text-2xl md:text-3xl">
              Сподобались роботи?
            </h2>
            <p className="mt-2 text-[15px] text-[#d6d3d1]">
              Напишіть — обговоримо вашу зйомку{p.city ? ` у місті ${p.city}` : ''}.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              {phoneHref && (
                <a href={phoneHref} className="bg-[#faf8f5] text-[#1c1917] rounded-full px-6 py-3 text-sm font-bold hover:bg-white transition-colors">
                  Зателефонувати
                </a>
              )}
              {instagramHandle && (
                <a href={`https://instagram.com/${instagramHandle}`} target="_blank" rel="noopener noreferrer"
                  className="rounded-full px-6 py-3 text-sm font-bold border border-[#57534e] hover:border-[#faf8f5] transition-colors">
                  Написати в Instagram
                </a>
              )}
              {p.email && (
                <a href={`mailto:${p.email}`}
                  className="rounded-full px-6 py-3 text-sm font-bold border border-[#57534e] hover:border-[#faf8f5] transition-colors">
                  Email
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Footer note ──────────────────────────────────────── */}
      <footer className="pb-10 text-center">
        <a href={`/${locale}/gallery-for-photographers`} className="text-[12px] text-[#a8a29e] hover:text-[#57534e] transition-colors">
          Сторінку створено на Touch.Memories — галереї та візитки для фотографів
        </a>
      </footer>
    </div>
  );
}
