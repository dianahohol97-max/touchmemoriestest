import type { Metadata } from 'next';
import GalleryEditorClient from './GalleryEditorClient';

export const dynamic = 'force-dynamic';

// The cabinet is private (token in the URL) — never index it.
export const metadata: Metadata = {
  title: 'Редагування галереї | Touch.Memories',
  robots: { index: false, follow: false },
};

export default async function GalleryEditorPage({ params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  return <GalleryEditorClient token={token} galleryId={id} />;
}
