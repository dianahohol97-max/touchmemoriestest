'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import dynamic from 'next/dynamic';
const PhotoPrintConstructor = dynamic(() => import('@/components/PhotoPrintConstructor'), { ssr: false,
    loading: () => (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', border: '4px solid #e2e8f0', borderTopColor: '#263a99', animation: 'spin 0.8s linear infinite' }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <span style={{ fontSize: 15, color: '#64748b' }}>Завантаження...</span>
      </div>
    ),
});

function PhotomagnetsOrderContent() {
    const searchParams = useSearchParams();
    const productSlug = 'photomagnets'; // Always use photomagnets slug

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
            <Navigation />
            <main className="py-24">
                <PhotoPrintConstructor productSlug={productSlug} />
            </main>
            <Footer categories={[]} />
        </div>
    );
}

export default function PhotomagnetsOrderPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Завантаження...</div>}>
            <PhotomagnetsOrderContent />
        </Suspense>
    );
}
