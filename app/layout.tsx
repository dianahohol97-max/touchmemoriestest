import type { Metadata } from "next";
import { Suspense } from "react";
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
import CartDrawer from '@/components/cart/CartDrawer';
import { OAuthCallbackHandler } from '@/components/providers/OAuthCallbackHandler';
import { SITE_INFO } from '@/lib/seoContent';

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin", "cyrillic"],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
});

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin", "cyrillic"],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
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
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" suppressHydrationWarning className={`${montserrat.variable} ${openSans.variable}`}>
      <head>
      </head>
      <body className="font-body bg-background text-textPrimary antialiased">
        <ConsentProvider>
          <ThemeProvider>
            <I18nProvider>
              {children}
              <CartDrawer />
              <Toaster position="top-right" richColors />
              <NewsletterPopup />
              <CookieBanner />
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
