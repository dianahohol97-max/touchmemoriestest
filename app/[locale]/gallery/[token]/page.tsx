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
// Link-preview text (messengers/social) in the language the photographer set
// for the gallery — the client abroad sees a preview they can read.
const META_I18N: Record<string, { title: (g: string, p: string) => string; desc: (p: string) => string; fallbackTitle: string; fallbackDesc: string; anon: string }> = {
  uk: { title: (g, p) => `${g} — фотогалерея від ${p}`, desc: p => `Перегляньте та завантажте свої фото. Галерея доступна 30 днів. Фотограф: ${p}.`, fallbackTitle: 'Ваша фотогалерея', fallbackDesc: 'Перегляд і завантаження фото від вашого фотографа.', anon: 'фотографа' },
  en: { title: (g, p) => `${g} — photo gallery by ${p}`, desc: p => `View and download your photos. The gallery is available for 30 days. Photographer: ${p}.`, fallbackTitle: 'Your photo gallery', fallbackDesc: 'View and download photos from your photographer.', anon: 'your photographer' },
  pl: { title: (g, p) => `${g} — galeria zdjęć od ${p}`, desc: p => `Zobacz i pobierz swoje zdjęcia. Galeria jest dostępna przez 30 dni. Fotograf: ${p}.`, fallbackTitle: 'Twoja galeria zdjęć', fallbackDesc: 'Przeglądaj i pobieraj zdjęcia od swojego fotografa.', anon: 'fotografa' },
  de: { title: (g, p) => `${g} — Fotogalerie von ${p}`, desc: p => `Sehen und laden Sie Ihre Fotos herunter. Die Galerie ist 30 Tage verfügbar. Fotograf: ${p}.`, fallbackTitle: 'Ihre Fotogalerie', fallbackDesc: 'Fotos Ihres Fotografen ansehen und herunterladen.', anon: 'Ihrem Fotografen' },
  cs: { title: (g, p) => `${g} — fotogalerie od ${p}`, desc: p => `Prohlédněte si a stáhněte své fotky. Galerie je dostupná 30 dní. Fotograf: ${p}.`, fallbackTitle: 'Vaše fotogalerie', fallbackDesc: 'Prohlížení a stahování fotek od vašeho fotografa.', anon: 'fotografa' },
  it: { title: (g, p) => `${g} — galleria fotografica di ${p}`, desc: p => `Guarda e scarica le tue foto. La galleria è disponibile per 30 giorni. Fotografo: ${p}.`, fallbackTitle: 'La tua galleria fotografica', fallbackDesc: 'Guarda e scarica le foto del tuo fotografo.', anon: 'fotografo' },
  es: { title: (g, p) => `${g} — galería de fotos de ${p}`, desc: p => `Mira y descarga tus fotos. La galería está disponible durante 30 días. Fotógrafo: ${p}.`, fallbackTitle: 'Tu galería de fotos', fallbackDesc: 'Mira y descarga las fotos de tu fotógrafo.', anon: 'fotógrafo' },
  fr: { title: (g, p) => `${g} — galerie photo de ${p}`, desc: p => `Consultez et téléchargez vos photos. La galerie est disponible pendant 30 jours. Photographe : ${p}.`, fallbackTitle: 'Votre galerie photo', fallbackDesc: 'Consultez et téléchargez les photos de votre photographe.', anon: 'photographe' },
  ro: { title: (g, p) => `${g} — galerie foto de la ${p}`, desc: p => `Vezi și descarcă fotografiile tale. Galeria este disponibilă 30 de zile. Fotograf: ${p}.`, fallbackTitle: 'Galeria ta foto', fallbackDesc: 'Vezi și descarcă fotografiile de la fotograful tău.', anon: 'fotograful' },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const admin = getAdminClient();
  const { data: gallery } = await admin
    .from('photographer_galleries')
    .select('title, design, photographer:photographers(name, logo_url, avatar_url)')
    .eq('client_token', token)
    .maybeSingle();

  const photographer: any = Array.isArray(gallery?.photographer) ? gallery?.photographer[0] : gallery?.photographer;
  const m = META_I18N[(gallery?.design as any)?.lang] || META_I18N.uk;
  const title = gallery ? m.title(gallery.title, photographer?.name || m.anon) : m.fallbackTitle;
  const description = gallery ? m.desc(photographer?.name || '') : m.fallbackDesc;
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
