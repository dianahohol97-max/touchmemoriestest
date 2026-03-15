import type { Metadata } from "next";
import { Suspense } from "react";
import { Montserrat, Open_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from 'sonner';
import { AnalyticsProvider } from '@/components/providers/AnalyticsProvider';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { NewsletterPopup } from '@/components/ui/NewsletterPopup';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import CartDrawer from '@/components/cart/CartDrawer';
import { OAuthCallbackHandler } from '@/components/providers/OAuthCallbackHandler';

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

export const metadata: Metadata = {
  title: "TouchMemories | Створюйте свої фотокниги",
  description: "TouchMemories — ваш сервіс для створення преміальних фотокниг та збереження спогадів.",
  keywords: ["фотокниги", "друк фото", "спогади", "подарунки", "Україна"],
  openGraph: {
    title: "TouchMemories | Створюйте свої фотокниги",
    description: "Зберігайте найцінніші моменти у преміальних фотокнигах.",
    locale: "uk_UA",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body className={`${montserrat.variable} ${openSans.variable}`} style={{ margin: 0, fontFamily: 'var(--font-open-sans)' }}>
        <ThemeProvider>
          {children}
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
