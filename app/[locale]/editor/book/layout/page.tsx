'use client';

export const dynamic = 'force-dynamic';

import dynamicImport from 'next/dynamic';

// Load BookLayoutEditor dynamically — it's 200KB+ and uses browser-only APIs
// This prevents SSR crashes and shows a proper loading skeleton on mobile
const BookLayoutEditor = dynamicImport(
  () => import('@/components/BookLayoutEditor'),
  { ssr: false, loading: () => <EditorSkeleton /> });

// Paints in the first frame while the editor bundle downloads. Without it the
// route showed a blank page for the whole download+parse — Speed Insights had
// this as the worst route on the site (RES 49) mostly because LCP only fired
// when the finished editor appeared.
function EditorSkeleton() {
  return (
    <div className="fixed inset-0 flex flex-col bg-slate-100">
      <div className="h-14 shrink-0 border-b border-slate-200 bg-white flex items-center gap-3 px-4">
        <div className="h-8 w-8 rounded-lg bg-slate-200 animate-pulse" />
        <div className="h-4 w-40 rounded bg-slate-200 animate-pulse" />
        <div className="ml-auto h-9 w-28 rounded-lg bg-slate-200 animate-pulse" />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden sm:flex w-64 shrink-0 flex-col gap-3 border-r border-slate-200 bg-white p-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="aspect-[2/1.4] w-full max-w-3xl rounded-lg bg-white shadow-sm animate-pulse flex items-center justify-center">
            <div className="text-sm text-slate-400">Завантажуємо редактор…</div>
          </div>
        </div>
      </div>
      <div className="h-20 shrink-0 border-t border-slate-200 bg-white flex items-center gap-2 px-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 w-20 rounded-lg bg-slate-100 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export default function BookLayoutPage() {
  return <BookLayoutEditor />;
}
