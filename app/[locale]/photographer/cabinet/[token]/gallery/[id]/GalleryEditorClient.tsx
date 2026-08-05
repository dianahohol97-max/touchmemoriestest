'use client';

import React from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import GalleryWorkspace from '../GalleryWorkspace';

/**
 * Full-page gallery editor (Diana, 2026-08-04: «хочу щоб перекидало на
 * окреме вікно з кнопкою назад, хедером та футером, де я можу повноцінно
 * створити галерею»). The cabinet list links here instead of expanding
 * panels inline; everything the photographer does with the gallery lives in
 * GalleryWorkspace, which the creation page reuses.
 */
export default function GalleryEditorClient({ token, galleryId }: { token: string; galleryId: string }) {
  const back = `/uk/photographer/cabinet/${token}`;

  return (
    <div style={{ background: '#FAF8F5', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navigation />
      <main style={{ flex: 1, paddingTop: 110 }}>
        {/* Wider than the cabinet list: the design section puts the live
            preview beside the options on desktop. */}
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '20px 16px 80px', fontFamily: 'var(--font-body), sans-serif', color: '#1A1A1A' }}>
          <a href={back} style={{ display: 'inline-block', fontSize: 14, fontWeight: 700, color: '#263A99', textDecoration: 'none', marginBottom: 14 }}>
            ← Усі галереї
          </a>
          <GalleryWorkspace token={token} galleryId={galleryId} />
        </div>
      </main>
      <Footer categories={[]} />
    </div>
  );
}
