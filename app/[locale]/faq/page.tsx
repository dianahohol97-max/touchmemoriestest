import type { Metadata } from 'next';
import FAQClient from './FAQClient';
import { FAQ_ITEMS } from '@/lib/faq';
import { getCanonicalUrl, getAlternateLanguages, OG_LOCALE_MAP, type Locale } from '@/lib/seo/locales';
import { serializeJsonLd } from '@/lib/seo/jsonld';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = (rawLocale || 'uk') as Locale;
  const title = 'Питання та відповіді | Touch.Memories';
  const description = 'Відповіді на найпопулярніші питання про замовлення фотокниг, доставку та оплату.';
  return {
    title,
    description,
    alternates: {
      canonical: getCanonicalUrl(locale, '/faq'),
      languages: getAlternateLanguages('/faq'),
    },
    openGraph: {
      title,
      description,
      url: getCanonicalUrl(locale, '/faq'),
      siteName: 'Touch.Memories',
      locale: OG_LOCALE_MAP[locale],
      type: 'website',
    },
  };
}

export default function FAQPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((it) => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a },
    })),
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <FAQClient />
    </>
  );
}
