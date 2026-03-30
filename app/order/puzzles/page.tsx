'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import PuzzleConstructor from '@/components/PuzzleConstructor';

function PuzzleOrderContent() {
    const searchParams = useSearchParams();
    const productSlug = searchParams.get('product') || 'puzzle-20x30';
    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
            <Navigation />
            <main className="py-24">
                <PuzzleConstructor productSlug={productSlug} />
            </main>
            <Footer categories={[]} />
        </div>
    );
}

export default function PuzzleOrderPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Завантаження...</div>}>
            <PuzzleOrderContent />
        </Suspense>
    );
}
