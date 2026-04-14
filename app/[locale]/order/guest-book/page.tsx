'use client';

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import dynamicImport from 'next/dynamic';

const GuestBookConstructorNew = dynamicImport(() => import('@/components/GuestBookConstructorNew'), { ssr: false });

export default function GuestBookOrderPage() {
  return (
    <>
      <Navigation />
      <main style={{ minHeight: '100vh', paddingTop: 80 }}>
        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Завантаження...</div>}>
          <GuestBookConstructorNew />
        </Suspense>
      </main>
      <Footer categories={[]} />
    </>
  );
}
