import type { Metadata } from "next";
import { Suspense } from "react";
import { Montserrat, Open_Sans, Playfair_Display, Lato, Roboto, Dancing_Script, Oswald } from "next/font/google";
import "./globals.css";
import { Toaster } from 'sonner';
import { AnalyticsProvider } from '@/components/providers/AnalyticsProvider';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { NewsletterPopup } from '@/components/ui/NewsletterPopup';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { I18nProvider } from '@/lib/i18n/context';
import CartDrawer from '@/components/cart/CartDrawer';
import { OAuthCallbackHandler } from '@/components/providers/OAuthCallbackHandler';
import { SITE_INFO } from '@/lib/seoContent';

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin", "cyrillic"],
  weight: ['400', '500', '600', '700', '800', '900'],
});

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin", "cyrillic"],
  weight: ['400', '500', '600', '700', '800'],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "cyrillic"],
  weight: ['400', '700'],
});

const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ['400', '700'],
});

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin", "cyrillic"],
  weight: ['400', '700'],
});

const dancingScript = Dancing_Script({
  variable: "--font-dancing",
  subsets: ["latin"],
  weight: ['400', '700'],
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin", "cyrillic"],
  weight: ['400', '700'],
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
    <html lang="uk" suppressHydrationWarning className={`${montserrat.variable} ${openSans.variable} ${playfair.variable} ${lato.variable} ${roboto.variable} ${dancingScript.variable} ${oswald.variable}`}>
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
      </head>
      <body className="font-body bg-background text-textPrimary antialiased">
        <ThemeProvider>
          <I18nProvider>
          {children}
          </I18nProvider>
          <CartDrawer />
          <Toaster position="top-right" richColors />
          <NewsletterPopup />
          <Suspense fallback={null}>
            <AnalyticsProvider />
          </Suspense>
          <SpeedInsights />
          <Suspense fallback={null}>
            <OAuthCallbackHandler />
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
