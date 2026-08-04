import type { Metadata } from 'next';
import { Playfair_Display, Cormorant_Garamond, Caveat } from 'next/font/google';
import { getAdminClient } from '@/lib/supabase/admin';
import { getBaseUrl } from '@/lib/seo/locales';
import GalleryClient from './GalleryClient';

export const dynamic = 'force-dynamic';

// Display fonts the photographer can pick in the gallery design constructor.
// Cyrillic subsets are required — gallery titles are Ukrainian. Montserrat is
// NOT loaded here: the root layout already provides it as --font-heading.
const serif = Playfair_Display({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-gallery-serif',
  display: 'swap',
});
const cormorant = Cormorant_Garamond({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-gallery-cormorant',
  display: 'swap',
});
const caveat = Caveat({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '600'],
  variable: '--font-gallery-caveat',
  display: 'swap',
});

interface Props {
  params: Promise<{ token: string; locale: string }>;
}

/**
 * Client galleries are private (unguessable token) and stay noindex — these
 * are people's personal photos. The metadata below is for messenger/social
 * link previews when the photographer shares the gallery with their client:
 * the photographer's brand, not a bare URL.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const admin = getAdminClient();
  const { data: gallery } = await admin
    .from('photographer_galleries')
    .select('title, photographer:photographers(name, logo_url, avatar_url)')
    .eq('client_token', token)
    .maybeSingle();

  const photographer: any = Array.isArray(gallery?.photographer) ? gallery?.photographer[0] : gallery?.photographer;
  const title = gallery ? `${gallery.title} — фотогалерея від ${photographer?.name || 'фотографа'}` : 'Ваша фотогалерея';
  const description = gallery
    ? `Перегляньте та завантажте свої фото. Галерея доступна 30 днів. Фотограф: ${photographer?.name || ''}.`
    : 'Перегляд і завантаження фото від вашого фотографа.';
  const image = photographer?.logo_url || photographer?.avatar_url || `${getBaseUrl()}/og-image.jpg`;

  return {
    title: `${title} | Touch.Memories`,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      siteName: 'Touch.Memories',
      images: [{ url: image, width: 1200, height: 630, alt: title }],
      type: 'website',
    },
    twitter: { card: 'summary', title, description, images: [image] },
  };
}

export default async function ClientGalleryPage({ params }: Props) {
  const { token } = await params;
  return (
    <div className={`${serif.variable} ${cormorant.variable} ${caveat.variable}`}>
      <GalleryClient token={token} />
    </div>
  );
}
