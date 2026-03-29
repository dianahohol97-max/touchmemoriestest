'use client';
import { useRouter } from 'next/navigation';

import { Suspense } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import BookPhotoUpload from '@/components/BookPhotoUpload';

function BookUploadContent() {
    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
            <Navigation />
            <main className="py-24">
                <BookPhotoUpload />
            </main>
            <Footer categories={[]} />
        </div>
    );
}

export default function BookUploadPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">ÐÐ°Ð²Ð°Ð½ÑÐ°Ð¶ÐµÐ½Ð½Ñ...</div>}>
            <BookUploadContent />
        </Suspense>
    );
}
