'use client';
import { Suspense } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import dynamicImport from 'next/dynamic';

const WeddingNewspaperConstructor = dynamicImport(() => import('@/components/WeddingNewspaperConstructor'), { ssr: false });

export default function WeddingNewspaperOrderPage() {
    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
            <Navigation />
            <main style={{ paddingTop: 80 }}>
                <Suspense fallback={<div style={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Завантаження...</div>}>
                    <WeddingNewspaperConstructor />
                </Suspense>
            </main>
            <Footer categories={[]} />
        </div>
    );
}
