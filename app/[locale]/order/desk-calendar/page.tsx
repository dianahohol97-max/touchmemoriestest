'use client';

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import dynamicImport from 'next/dynamic';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';

const DeskCalendarConstructor = dynamicImport(() => import('@/components/DeskCalendarConstructor'), { ssr: false });

export default function DeskCalendarOrderPage() {
  return (
    <>
      <Navigation />
      <main style={{ minHeight:'100vh', paddingTop:80 }}>
        <div style={{ background:'#fff', borderBottom:'1px solid #e2e8f0', padding:'14px 24px' }}>
          <div style={{ maxWidth:1400, margin:'0 auto', display:'flex', alignItems:'center', gap:12 }}>
            <a href="/catalog/calendar-table" style={{ color:'#64748b', textDecoration:'none', fontSize:13 }}>← Назад до каталогу</a>
            <span style={{ color:'#e2e8f0' }}>|</span>
            <h1 style={{ fontSize:17, fontWeight:800, color:'#1e2d7d', margin:0 }}>Конструктор настільного календаря</h1>
          </div>
        </div>
        <div style={{ maxWidth:1400, margin:'0 auto' }}>
          <Suspense fallback={<div style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>Завантаження...</div>}>
            <DeskCalendarConstructor />
          </Suspense>
        </div>
      </main>
      <Footer categories={[]} />
    </>
  );
}
