'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import BookConstructorConfig from '@/components/BookConstructorConfig';

function BookOrderContent() {
    const searchParams = useSearchParams();
    const productSlug = searchParams.get('product') || 'photobook-velour';

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
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Завантаження...</div>}>
            <BookOrderContent />
        </Suspense>
    );
}
