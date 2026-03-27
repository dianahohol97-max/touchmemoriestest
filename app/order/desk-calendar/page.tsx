'use client';

import { Suspense } from 'react';
import CalendarConstructor from '@/components/CalendarConstructor';

function DeskCalendarContent() {
    return <CalendarConstructor productType="desk" />;
}

export default function DeskCalendarOrderPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Завантаження...</div>}>
            <DeskCalendarContent />
        </Suspense>
    );
}
