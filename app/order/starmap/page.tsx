'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
const StarMapConstructor = dynamic(() => import('@/components/StarMapConstructor'), { ssr: false,
    loading: () => (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', border: '4px solid #e2e8f0', borderTopColor: '#263a99', animation: 'spin 0.8s linear infinite' }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <span style={{ fontSize: 15, color: '#64748b' }}>Завантаження...</span>
      </div>
    ),
});
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
