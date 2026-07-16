import GalleryClient from './GalleryClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Ваша фотогалерея | Touch.Memories',
  robots: { index: false, follow: false },
};

export default async function ClientGalleryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <GalleryClient token={token} />;
}
