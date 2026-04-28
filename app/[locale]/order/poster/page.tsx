'use client';
import { Suspense } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import dynamicImport from 'next/dynamic';

const PosterConstructor = dynamicImport(() => import('@/components/PosterConstructor'), { ssr: false });

export default function PosterOrderPage() {
  return (
    <>
      <Navigation />
      <main style={{ minHeight: '100vh', paddingTop: 80 }}>
        <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '16px 24px' }}>
          <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/catalog/poster" style={{ color: '#64748b', textDecoration: 'none', fontSize: 13 }}>← Назад</a>
            <span style={{ color: '#e2e8f0' }}>|</span>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: '#1e2d7d', margin: 0 }}>Конструктор постера</h1>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Створіть свій унікальний постер</span>
          </div>
        </div>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Завантаження...</div>}>
            <PosterConstructor />
          </Suspense>
        </div>
      </main>
      <Footer categories={[]} />
    </>
  );
}
