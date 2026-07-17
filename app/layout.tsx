import type { Metadata } from "next";
import { Suspense } from "react";
import Script from "next/script";
import { Montserrat, Open_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from 'sonner';
import { AnalyticsProvider } from '@/components/providers/AnalyticsProvider';
import { ConsentProvider } from '@/lib/consent/ConsentProvider';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { NewsletterPopup } from '@/components/ui/NewsletterPopup';
import { CookieBanner } from '@/components/cookies/CookieBanner';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { I18nProvider } from '@/lib/i18n/context';
import { serializeJsonLd } from '@/lib/seo/jsonld';
import CartDrawer from '@/components/cart/CartDrawer';
import { OAuthCallbackHandler } from '@/components/providers/OAuthCallbackHandler';
import ReferralCapture from '@/components/ReferralCapture';
import InAppBrowserBanner from '@/components/InAppBrowserBanner';
import { SITE_INFO } from '@/lib/seoContent';
import { getBaseUrl } from '@/lib/seo/locales';

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin", "cyrillic"],
  weight: ['700', '900'],          // reduced from ['600','700','800','900'] — 700 for body, 900 for headings
  display: 'swap',
  preload: true,
  fallback: ['Arial', 'Helvetica', 'sans-serif'],  // instant fallback while font loads
});

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin", "cyrillic"],
  weight: ['400', '600'],          // reduced from ['400','500','600','700']
  display: 'swap',
  preload: false, // secondary font — don't block LCP
});

export const metadata: Metadata = {
  // Resolves all relative OG/Twitter image paths against the canonical domain.
  // Without it Next emits absolute-URL warnings and social cards may break.
  metadataBase: new URL(getBaseUrl()),
  title: SITE_INFO.metaTitle,
  description: SITE_INFO.metaDescription,
  keywords: SITE_INFO.keywords,
  openGraph: {
    title: SITE_INFO.metaTitle,
    description: SITE_INFO.metaDescription,
    locale: "uk_UA",
    type: "website",
    siteName: SITE_INFO.name,
  },
  // Icons come from the App Router file convention (app/favicon.ico,
  // app/icon.png, app/apple-icon.png) — Next auto-links them, so no `icons`
  // field is needed here.
  verification: {
    // Google Search Console / Merchant Center site verification.
    // Several tokens can coexist; add more to this array if another
    // Google property needs verifying without removing this one.
    google: '8nxC7U2tum2CMHvmNrfCVTH0q3xDG06YIjAXGGxquiA',
    // Meta (Facebook/Instagram) domain verification — required for Commerce
    // Manager catalog + Instagram Shopping. Renders
    // <meta name="facebook-domain-verification" content="...">.
    other: {
      'facebook-domain-verification': 'log1qnzblw5feag1mojf20wfsuo2ak',
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Global structured data (site-wide identity). Rendered server-side so it's
  // in the initial HTML for crawlers. Product/Breadcrumb JSON-LD lives on the
  // product pages; this is the Organization / LocalBusiness / WebSite graph.
  // Microsoft Clarity project id — read from the environment, never hardcoded.
  // Set NEXT_PUBLIC_CLARITY_ID in .env.local (local) and in Vercel (production).
  // When unset (e.g. a preview without the var) the tag simply isn't rendered.
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID;

  const site = getBaseUrl();
  const SOCIALS = [
    'https://instagram.com/touch.memories',
    'https://t.me/touchmemories',
    'https://tiktok.com/@touch.memories',
  ];
  const globalJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${site}/#organization`,
        name: SITE_INFO.name,
        url: site,
        email: 'touch.memories3@gmail.com',
        description: SITE_INFO.description,
        sameAs: SOCIALS,
      },
      {
        '@type': 'LocalBusiness',
        '@id': `${site}/#localbusiness`,
        name: SITE_INFO.name,
        url: site,
        email: 'touch.memories3@gmail.com',
        description: SITE_INFO.description,
        priceRange: '₴₴',
        currenciesAccepted: 'UAH',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'вул. Омеляна Польового, 4а',
          addressLocality: 'Тернопіль',
          addressRegion: 'Тернопільська область',
          addressCountry: 'UA',
        },
        geo: { '@type': 'GeoCoordinates', latitude: 49.5535, longitude: 25.5948 },
        parentOrganization: { '@id': `${site}/#organization` },
        sameAs: SOCIALS,
      },
      {
        '@type': 'WebSite',
        '@id': `${site}/#website`,
        url: site,
        name: SITE_INFO.name,
        inLanguage: 'uk',
        publisher: { '@id': `${site}/#organization` },
      },
    ],
  };

  return (
    <html lang="uk" suppressHydrationWarning className={`${montserrat.variable} ${openSans.variable}`}>
      <head>
        {/* Preconnect to external origins used on every page — reduces DNS+TLS
            handshake latency for LCP images (Supabase storage). Fonts are
            self-hosted by next/font, so no Google Fonts preconnect is needed. */}
        <link rel="preconnect" href="https://yivfsicvaoewxrtkrfxr.supabase.co" />
        {/* dns-prefetch as fallback for browsers that don't support preconnect */}
        <link rel="dns-prefetch" href="https://yivfsicvaoewxrtkrfxr.supabase.co" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(globalJsonLd) }}
        />
      </head>
      <body className="font-body bg-background text-textPrimary antialiased">
        {/* Microsoft Clarity — official tag loaded via next/script (afterInteractive
            so it never blocks first render). Rendered at the root layout, so it
            fires on every route across all locales, /order/book, and the editor.
            Only emitted when NEXT_PUBLIC_CLARITY_ID is configured. */}
        {clarityId && (
          <Script id="ms-clarity" strategy="afterInteractive">
            {`(function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${clarityId}");`}
          </Script>
        )}
        <ConsentProvider>
          <ThemeProvider>
            <I18nProvider>
              {children}
              <CartDrawer />
              <Toaster position="top-right" richColors />
              <NewsletterPopup />
              <CookieBanner />
              <Suspense fallback={null}>
                <ReferralCapture />
                <InAppBrowserBanner />
              </Suspense>
            </I18nProvider>
            <Suspense fallback={null}>
              <AnalyticsProvider />
            </Suspense>
            <SpeedInsights />
            <Suspense fallback={null}>
              <OAuthCallbackHandler />
            </Suspense>
          </ThemeProvider>
        </ConsentProvider>
      </body>
    </html>
  );
}
