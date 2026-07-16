import { Suspense } from 'react';
import MetaCheckoutClient from './MetaCheckoutClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Оформлення замовлення | Touch.Memories',
  robots: { index: false, follow: false },
};

/**
 * Meta Shops checkout URL entry point. Configure in Commerce Manager as:
 *   https://touchmemories.com.ua/uk/meta-checkout
 * Meta appends ?products={id}:{qty},{id}:{qty}&coupon=CODE; this page fills
 * the cart and forwards to the regular checkout (which auto-applies ?promo=).
 */
export default async function MetaCheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (
    <Suspense fallback={null}>
      <MetaCheckoutClient locale={locale || 'uk'} />
    </Suspense>
  );
}
