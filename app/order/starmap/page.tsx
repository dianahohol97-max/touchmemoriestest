'use client';

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import dynamicImport from 'next/dynamic';
const StarMapConstructor = dynamicImport(() => import('@/components/StarMapConstructor'), { ssr: false });
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';

function StarMapContent() {
    return <StarMapConstructor />;
}

export default function StarMapOrderPage() {
    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
            <Navigation />
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Завантаження...</div>}>
                <StarMapContent />
            </Suspense>
            <Footer categories={[]} />
        </div>
    );
}
