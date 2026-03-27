'use client';

import { Suspense } from 'react';
import CityMapConstructor from '@/components/CityMapConstructor';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';

function CityMapContent() {
    return <CityMapConstructor />;
}

export default function CityMapOrderPage() {
    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
            <Navigation />
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Завантаження...</div>}>
                <CityMapContent />
            </Suspense>
            <Footer categories={[]} />
        </div>
    );
}
