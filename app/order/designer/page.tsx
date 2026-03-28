'use client';

import { Suspense } from 'react';
import DesignerOrderFlow from '@/components/DesignerOrderFlow';

export default function DesignerOrderPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Завантаження...</div>}>
            <DesignerOrderFlow />
        </Suspense>
    );
}
