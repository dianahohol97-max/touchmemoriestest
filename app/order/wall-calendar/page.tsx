'use client';

import { Suspense } from 'react';
import CalendarConstructor from '@/components/CalendarConstructor';

function WallCalendarContent() {
    return <CalendarConstructor productType="wall" />;
}

export default function WallCalendarOrderPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Завантаження...</div>}>
            <WallCalendarContent />
        </Suspense>
    );
}
