'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import dynamicImport from 'next/dynamic';

// Magnets reuse the photo-print constructor in "magnet mode" (productSlug
// 'photomagnets'): one size for the whole order, polaroid render + caption for
// the two polaroid sizes, set pricing (235 ₴) and multiples handled inside.
const PhotoPrintConstructor = dynamicImport(() => import('@/components/PhotoPrintConstructor'), { ssr: false });

function PhotomagnetsOrderContent() {
    const searchParams = useSearchParams();
    // Carry the size chosen on the product page (?size=) into the constructor.
    const initialSize = searchParams.get('size') || undefined;
    const initialFinish = searchParams.get('finish') || undefined;
    return (
        <PhotoPrintConstructor
            productSlug="photomagnets"
            initialSize={initialSize}
            initialFinish={initialFinish}
        />
    );
}

export default function PhotomagnetsOrderPage() {
    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
            <Navigation />
            <main style={{ paddingTop: 80 }}>
                <Suspense fallback={<div style={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Завантаження...</div>}>
                    <PhotomagnetsOrderContent />
                </Suspense>
            </main>
            <Footer categories={[]} />
        </div>
    );
}
