'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
const WallCalendarConstructor = dynamic(() => import('@/components/WallCalendarConstructor'), { ssr: false,
    loading: () => (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', border: '4px solid #e2e8f0', borderTopColor: '#263a99', animation: 'spin 0.8s linear infinite' }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <span style={{ fontSize: 15, color: '#64748b' }}>Завантаження...</span>
      </div>
    ),
});

function Content() {
    const params = useSearchParams();
    const size = params.get('size') || 'A4';
    return <WallCalendarConstructor initialSize={size} />;
}

export default function WallCalendarPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Завантаження...</div>}>
            <Content />
        </Suspense>
    );
}
