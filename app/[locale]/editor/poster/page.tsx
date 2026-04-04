'use client';

export const dynamic = 'force-dynamic';

import dynamicImport from 'next/dynamic';

const PosterEditor = dynamicImport(
  () => import('@/components/PosterEditor'), { ssr: false });

export default function PosterEditorPage() {
  return <PosterEditor />;
}
