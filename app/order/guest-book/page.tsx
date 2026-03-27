'use client';

import { Suspense } from 'react';
import GuestBookConstructor from '@/components/GuestBookConstructor';

function GuestBookContent() {
    return <GuestBookConstructor />;
}

export default function GuestBookOrderPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e2d7d] mx-auto mb-4"></div>
                    <p className="text-gray-600">Завантаження конструктора...</p>
                </div>
            </div>
        }>
            <GuestBookContent />
        </Suspense>
    );
}
