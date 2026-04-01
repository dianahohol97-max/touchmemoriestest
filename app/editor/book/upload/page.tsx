'use client';
import dynamic from 'next/dynamic';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';

const BookPhotoUpload = dynamic(
  () => import('@/components/BookPhotoUpload'),
  {
    ssr: false,
    loading: () => (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #e2e8f0', borderTopColor: '#263a99', animation: 'spin 0.8s linear infinite' }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <span style={{ fontSize: 14, color: '#64748b' }}>Завантаження...</span>
      </div>
    ),
  }
);

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
