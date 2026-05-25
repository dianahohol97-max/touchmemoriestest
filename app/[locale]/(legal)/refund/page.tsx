import type { Metadata } from 'next';
import { fetchLegalPage } from '@/lib/legal/fetch';
import { LegalContent } from '@/components/legal/LegalContent';
import { getCanonicalUrl, getAlternateLanguages, type Locale } from '@/lib/seo/locales';

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const page = await fetchLegalPage('refund', locale);
  const title = page?.title || 'Refund Policy';
  return {
    title: `${title} | Touch.Memories`,
    alternates: {
      canonical: getCanonicalUrl(locale as Locale, '/refund'),
      languages: getAlternateLanguages('/refund'),
    },
  };
}

export default async function RefundPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const page = await fetchLegalPage('refund', locale);

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
