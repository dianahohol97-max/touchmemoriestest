'use client';

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import dynamicImport from 'next/dynamic';
const CalendarConstructor = dynamicImport(() => import('@/components/CalendarConstructor'), { ssr: false });

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
