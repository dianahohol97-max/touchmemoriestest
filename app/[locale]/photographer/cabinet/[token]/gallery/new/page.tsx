import type { Metadata } from 'next';
import NewGalleryClient from './NewGalleryClient';

export const dynamic = 'force-dynamic';

// Private cabinet page (token in the URL) — never index it.
export const metadata: Metadata = {
  title: 'Нова галерея | Touch.Memories',
  robots: { index: false, follow: false },
};

/** Static `new` segment wins over the sibling `[id]` route in the App
 *  Router, so /gallery/new is the creation page and /gallery/<uuid> the
 *  editor. */
export default async function NewGalleryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <NewGalleryClient token={token} />;
}
