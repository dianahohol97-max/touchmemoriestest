'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';
import { ShoppingCart, BookOpen, Check } from 'lucide-react';

const DECO_LABELS: Record<string, string> = {
  acryl: 'Акрил', photovstavka: 'Фотовставка', flex: 'Фотодрук Flex',
  metal: 'Метал', graviruvannya: 'Гравіювання',
};

function WishbookSummaryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const addItem = useCartStore(s => s.addItem);

  const size = searchParams.get('size') || '20×30';
  const cover = searchParams.get('cover') || '';
  const coverColor = searchParams.get('cover_color') || '';
  const lamination = searchParams.get('lamination') || '';
  const decoration = searchParams.get('decoration') || '';
  const decorationVariant = searchParams.get('decoration_variant') || '';

  // Get price from sessionStorage config if available
  const config = typeof window !== 'undefined'
    ? (() => { try { return JSON.parse(sessionStorage.getItem('bookConstructorConfig') || '{}'); } catch { return {}; } })()
    : {};
  const price = config.totalPrice || 0;

  const params: { label: string; value: string }[] = [
    { label: 'Розмір', value: size },
    { label: 'Тип обкладинки', value: cover },
    ...(coverColor ? [{ label: 'Колір', value: coverColor }] : []),
    ...(lamination ? [{ label: 'Ламінація', value: lamination }] : []),
    ...(decoration ? [{ label: 'Оздоблення', value: DECO_LABELS[decoration] || decoration }] : []),
    ...(decorationVariant ? [{ label: 'Варіант', value: decorationVariant }] : []),
  ];

  const handleAddToCart = () => {
    addItem({
      id: `wishbook-${Date.now()}`,
      name: 'Книга побажань',
      price,
      qty: 1,
      slug: 'wishbook',
      category_slug: 'wishbook',
      options: { size, cover, coverColor, lamination, decoration, decorationVariant },
    });
    toast.success('Книгу побажань додано до кошика!');
    router.push('/cart');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <Navigation />
      <main style={{ maxWidth: 560, margin: '0 auto', padding: '100px 20px 60px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, background: '#f0f3ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <BookOpen size={28} color="#1e2d7d" />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1e2d7d', marginBottom: 8 }}>Книга побажань</h1>
          <p style={{ fontSize: 15, color: '#64748b' }}>Перевірте параметри перед додаванням до кошика</p>
        </div>

        {/* Summary card */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
            Параметри замовлення
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {params.map(p => (
              <div key={p.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 14, color: '#64748b' }}>{p.label}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', textAlign: 'right' }}>{p.value}</span>
              </div>
            ))}
          </div>

          {price > 0 && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#1e2d7d' }}>Ціна</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: '#1e2d7d' }}>{price} ₴</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ background: '#f0f3ff', borderRadius: 12, padding: 16, marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Check size={16} color="#1e2d7d" style={{ marginTop: 2, flexShrink: 0 }} />
            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
              Книга побажань не потребує редактора — гості самі заповнюють сторінки від руки.
              Після замовлення ми виготовимо книгу з обраними параметрами.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={handleAddToCart}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 24px', background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            <ShoppingCart size={18} /> Додати до кошика
          </button>
          <button onClick={() => router.back()}
            style={{ padding: '12px 24px', background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
            ← Змінити параметри
          </button>
        </div>
      </main>
      <Footer categories={[]} />
    </div>
  );
}

export default function WishbookOrderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Завантаження...</div>}>
      <WishbookSummaryContent />
    </Suspense>
  );
}
