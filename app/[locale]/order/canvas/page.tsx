'use client';
import { Suspense } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import dynamicImport from 'next/dynamic';
const CanvasPrintConstructor = dynamicImport(() => import('@/components/CanvasPrintConstructor'), { ssr: false });

export default function CanvasOrderPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Завантаження...</div>}>
            <div style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
                <Navigation />
                <main className="py-24">
                    <CanvasPrintConstructor />
                </main>
                <Footer categories={[]} />
            </div>
        </Suspense>
    );
}
