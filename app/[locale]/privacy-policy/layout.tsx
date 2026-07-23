import type { Metadata } from 'next';
import { getCanonicalUrl, type Locale } from '@/lib/seo/locales';

// /privacy-policy is a legacy duplicate of the canonical legal page /privacy
// (the one listed in the sitemap). The page itself is a client component, so it
// can't export metadata — this segment layout consolidates the duplicate by
// canonicalizing to /privacy. No redirect (the client page keeps working) and
// no noindex (canonical is the consolidation signal; mixing the two sends Google
// contradictory hints).
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    alternates: { canonical: getCanonicalUrl(locale as Locale, '/privacy') },
  };
}

export default function PrivacyPolicyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
