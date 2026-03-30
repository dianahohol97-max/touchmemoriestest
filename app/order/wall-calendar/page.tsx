'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import WallCalendarConstructor from '@/components/WallCalendarConstructor';

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
