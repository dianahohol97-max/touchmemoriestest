'use client';

import dynamic from 'next/dynamic';

// Load BookLayoutEditor dynamically — it's 200KB+ and uses browser-only APIs
// This prevents SSR crashes and shows a proper loading skeleton on mobile
const BookLayoutEditor = dynamic(
  () => import('@/components/BookLayoutEditor'), { ssr: false });

export default function BookLayoutPage() {
  return <BookLayoutEditor />;
}
