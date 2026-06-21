'use client';

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import BabybookFlow from '@/components/babybook/BabybookFlow';

export default function BabybookOrderPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Завантаження…</div>}>
            <BabybookFlow />
        </Suspense>
    );
}
