'use client';

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import dynamicImport from 'next/dynamic';

// Dynamic import — BookConstructorConfig uses process.env and browser APIs
const BookConstructorConfig = dynamicImport(
  () => import('@/components/BookConstructorConfig'), { ssr: false });

function BookOrderContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const productSlug = searchParams.get('product') || 'photobook-velour';

  // Redirect wishbook/guestbook to new constructor
  const s = productSlug.toLowerCase();
  if (s.includes('wishbook') || s.includes('guestbook') || s.includes('pobazhan') || s.includes('vishbuk')) {
    if (typeof window !== 'undefined') {
      router.replace('/order/guest-book');
    }
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Перенаправлення...</div>;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
      <Navigation />
      <main className="py-24">
        <BookConstructorConfig productSlug={productSlug} />
      </main>
      <Footer categories={[]} />
    </div>
  );
}

export default function BookOrderPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', border: '4px solid #e2e8f0', borderTopColor: '#263a99', animation: 'spin 0.8s linear infinite' }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <BookOrderContent />
    </Suspense>
  );
}
