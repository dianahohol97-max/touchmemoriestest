'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import dynamic from 'next/dynamic';
const PhotoPrintConstructor = dynamic(() => import('@/components/PhotoPrintConstructor'), { ssr: false });

function PhotoprintOrderContent() {
    const searchParams = useSearchParams();
    const productSlug = searchParams.get('product') || 'photoprint-standard';

    // Pre-select params passed from catalog page
    const initialSize = searchParams.get('size') || undefined;
    const initialFinish = searchParams.get('finish') || undefined;
    const borderParam = searchParams.get('border');
    const initialBorder = borderParam === '1' ? 'with' : borderParam === '0' ? 'none' : undefined;

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
            <Navigation />
            <main className="py-24">
                <PhotoPrintConstructor
                    productSlug={productSlug}
                    initialSize={initialSize}
                    initialFinish={initialFinish}
                    initialBorder={initialBorder}
                />
            </main>
            <Footer categories={[]} />
        </div>
    );
}

export default function PhotoprintOrderPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Завантаження...</div>}>
            <PhotoprintOrderContent />
        </Suspense>
    );
}
