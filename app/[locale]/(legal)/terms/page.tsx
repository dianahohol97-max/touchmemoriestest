import type { Metadata } from 'next';
import { fetchLegalPage } from '@/lib/legal/fetch';
import { LegalContent } from '@/components/legal/LegalContent';
import { getCanonicalUrl, getAlternateLanguages, type Locale } from '@/lib/seo/locales';

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const docType = locale === 'uk' ? 'offer' : 'terms';
  const page = await fetchLegalPage(docType, locale);
  const title = page?.title || (locale === 'uk' ? 'Публічна оферта' : 'Terms of Service');
  return {
    title: `${title} | Touch.Memories`,
    alternates: {
      canonical: getCanonicalUrl(locale as Locale, '/terms'),
      languages: getAlternateLanguages('/terms'),
    },
  };
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const docType = locale === 'uk' ? 'offer' : 'terms';
  let page = await fetchLegalPage(docType, locale);

  if (!page && locale !== 'uk') {
    page = await fetchLegalPage('offer', 'uk');
  }

  if (!page) {
    return <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>Document not found</div>;
  }

  return (
    <LegalContent
      title={page.title}
      content={page.content_md}
      showFallbackNotice={page.locale !== locale}
    />
  );
}
