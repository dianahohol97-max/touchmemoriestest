'use client';

import { Suspense } from 'react';
import PhotoPuzzleConstructor from '@/components/PhotoPuzzleConstructor';

function PuzzleContent() {
    return <PhotoPuzzleConstructor />;
}

export default function PuzzlesOrderPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e2d7d] mx-auto mb-4"></div>
                    <p className="text-gray-600">Завантаження конструктора пазлів...</p>
                </div>
            </div>
        }>
            <PuzzleContent />
        </Suspense>
    );
}
