'use client';

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import dynamicImport from 'next/dynamic';

const MagnetConstructor = dynamicImport(() => import('@/components/MagnetConstructor'), { ssr: false });

export default function PhotomagnetsOrderPage() {
    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
            <Navigation />
            <main style={{ paddingTop: 80 }}>
                <Suspense fallback={<div style={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Завантаження...</div>}>
                    <MagnetConstructor />
                </Suspense>
            </main>
            <Footer categories={[]} />
        </div>
    );
}
