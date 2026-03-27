'use client';

import { Suspense } from 'react';
import BookLayoutEditor from '@/components/BookLayoutEditor';

function BookLayoutContent() {
    return <BookLayoutEditor />;
}

export default function BookLayoutPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Завантаження редактора...</div>}>
            <BookLayoutContent />
        </Suspense>
    );
}
