'use client';

export const dynamic = 'force-dynamic';
import dynamicImport from 'next/dynamic';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';

const BookPhotoUpload = dynamicImport(
  () => import('@/components/BookPhotoUpload'),
  { ssr: false, loading: () => <UploadSkeleton /> });

// First-frame placeholder while the upload bundle downloads — same reasoning
// as the layout route: LCP used to fire only once the real component mounted,
// which made this the second-worst route in Speed Insights (RES 46).
function UploadSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4">
      <div className="h-7 w-64 rounded bg-slate-200 animate-pulse mb-3" />
      <div className="h-4 w-96 max-w-full rounded bg-slate-100 animate-pulse mb-8" />
      <div className="h-64 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 animate-pulse flex items-center justify-center">
        <div className="text-sm text-slate-400">Готуємо завантаження фото…</div>
      </div>
      <div className="mt-6 grid grid-cols-3 sm:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="aspect-square rounded-xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

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
