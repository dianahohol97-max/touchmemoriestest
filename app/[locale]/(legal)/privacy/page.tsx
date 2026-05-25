import type { Metadata } from 'next';
import { fetchLegalPage } from '@/lib/legal/fetch';
import { LegalContent } from '@/components/legal/LegalContent';
import { getCanonicalUrl, getAlternateLanguages, type Locale } from '@/lib/seo/locales';

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const page = await fetchLegalPage('privacy', locale);
  const title = page?.title || 'Privacy Policy';
  return {
    title: `${title} | Touch.Memories`,
    alternates: {
      canonical: getCanonicalUrl(locale as Locale, '/privacy'),
      languages: getAlternateLanguages('/privacy'),
    },
  };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const page = await fetchLegalPage('privacy', locale);

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
