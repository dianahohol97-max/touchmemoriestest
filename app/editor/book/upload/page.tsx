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
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">ÃÂÃÂ°ÃÂ²ÃÂ°ÃÂ½ÃÂÃÂ°ÃÂ¶ÃÂµÃÂ½ÃÂ½ÃÂ...</div>}>
            <BookUploadContent />
        </Suspense>
    );
}
