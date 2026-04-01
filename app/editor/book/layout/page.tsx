'use client';

import dynamic from 'next/dynamic';

// Load BookLayoutEditor dynamically — it's 200KB+ and uses browser-only APIs
// This prevents SSR crashes and shows a proper loading skeleton on mobile
const BookLayoutEditor = dynamic(
  () => import('@/components/BookLayoutEditor'),
  {
    ssr: false,
    loading: () => (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: '#f9fafb',
      }}>
        {/* Animated logo */}
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          border: '4px solid #e2e8f0',
          borderTopColor: '#263a99',
          animation: 'spin 0.8s linear infinite',
        }}/>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#263a99', marginBottom: 4 }}>
            Завантаження редактора...
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>
            Зачекайте кілька секунд
          </div>
        </div>
        {/* Skeleton preview */}
        <div style={{
          width: '90vw', maxWidth: 600, height: 180,
          background: '#e2e8f0', borderRadius: 12,
          animation: 'pulse 1.5s ease-in-out infinite',
        }}/>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
      </div>
    ),
  }
);

export default function BookLayoutPage() {
  return <BookLayoutEditor />;
}
