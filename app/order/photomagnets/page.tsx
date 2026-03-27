'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import PhotoPrintConstructor from '@/components/PhotoPrintConstructor';

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
