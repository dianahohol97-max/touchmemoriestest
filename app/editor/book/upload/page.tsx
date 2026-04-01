'use client';
import dynamic from 'next/dynamic';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';

const BookPhotoUpload = dynamic(
  () => import('@/components/BookPhotoUpload'), { ssr: false });

export default function BookUploadPage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
      <Navigation />
      <main className="pt-20 sm:pt-24 pb-8 sm:pb-24">
        <BookPhotoUpload />
      </main>
      <Footer categories={[]} />
    </div>
  );
}
