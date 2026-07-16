'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCartStore } from '@/store/cart-store';

/**
 * Bridge between Meta Shops and the regular checkout.
 * Parses ?products={id}:{qty},{id}:{qty}&coupon=CODE (the format Meta's
 * checkout-URL integration sends), resolves the products server-side, puts
 * them in the cart and forwards to /checkout — with ?promo= so the existing
 * auto-apply picks the coupon up.
 */
export default function MetaCheckoutClient({ locale }: { locale: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const addItems = useCartStore(s => s.addItems);
  const [error, setError] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // React strict-mode double-invoke guard
    ran.current = true;

    (async () => {
      const productsParam = searchParams.get('products') || '';
      const coupon = (searchParams.get('coupon') || '').trim();

      const pairs = productsParam
        .split(',')
        .map(entry => {
          const [id, qty] = entry.split(':');
          return { id: (id || '').trim(), qty: Number(qty) || 1 };
        })
        .filter(p => p.id);

      if (pairs.length === 0) {
        router.replace(`/${locale}/catalog`);
        return;
      }

      try {
        const res = await fetch('/api/meta-checkout/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: pairs }),
        });
        const json = await res.json();
        if (!res.ok || !json.items?.length) {
          setError(json?.error || 'Не вдалося знайти товари');
          setTimeout(() => router.replace(`/${locale}/catalog`), 2500);
          return;
        }

        addItems(json.items.map((it: any) => ({
          id: it.id,
          product_id: it.product_id,
          name: it.name,
          price: it.price,
          qty: it.qty,
          image: it.image,
          slug: it.slug,
          category_slug: it.category_slug,
          payment_mode: it.payment_mode,
        })));

        const promoQuery = coupon ? `?promo=${encodeURIComponent(coupon)}` : '';
        router.replace(`/${locale}/checkout${promoQuery}`);
      } catch {
        setError('Сталася помилка');
        setTimeout(() => router.replace(`/${locale}/catalog`), 2500);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: 'Arial, sans-serif', color: '#475569' }}>
      {error ? (
        <>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#991b1b' }}>{error}</div>
          <div style={{ fontSize: 14 }}>Перенаправляємо до каталогу…</div>
        </>
      ) : (
        <>
          <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#1e2d7d', borderRadius: '50%', animation: 'tm-spin 0.8s linear infinite' }} />
          <div style={{ fontSize: 15, fontWeight: 600 }}>Готуємо ваше замовлення…</div>
          <style>{'@keyframes tm-spin { to { transform: rotate(360deg) } }'}</style>
        </>
      )}
    </div>
  );
}
