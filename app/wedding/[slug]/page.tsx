import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import localFont from 'next/font/local';
import { getAdminClient } from '@/lib/supabase/admin';
import type { WeddingEvent } from '@/lib/wedding/config';
import WeddingPageClient from './WeddingPageClient';

export const dynamic = 'force-dynamic';

// Сторінка гостя. Живе поза групою [locale] навмисно: гість приходить сюди з
// QR-коду на столі, а не з меню магазину, і ні перемикача мов, ні шапки
// каталогу, ні кошика йому тут не треба. Мова одна — українська.

// Написи на цій сторінці — не інтерфейс магазину, а підпис до фотографії, тож
// і шрифт тут інший. Cormorant уже завантажується в клієнтських галереях, тобто
// нової залежності не додає.
//
// Файл лежить у app/fonts/, а не тягнеться через next/font/google: той
// завантажує шрифт по мережі В МОМЕНТ ЗБІРКИ, і 22.09.2026 збірка від цього
// впала на комміті, який шрифтів не чіпав. Подробиці — app/fonts/README.md.
// Накреслення, ваги і підмножини ті самі; файл змінний, тож 400, 500 і 600
// беруться з одного діапазону.
const display = localFont({
  src: '../../fonts/CormorantGaramond-Variable.woff2',
  weight: '300 700',
  style: 'normal',
  variable: '--font-wedding-display',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
});

interface Props {
  params: Promise<{ slug: string }>;
}

async function loadEvent(slug: string): Promise<WeddingEvent | null> {
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) return null;

  const { data, error } = await getAdminClient()
    .from('wedding_events')
    .select('id, slug, couple_names, event_date, hero_photo_path')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    console.error('[wedding] не вдалося прочитати подію:', error);
    return null;
  }
  return data;
}

/**
 * Сторінка закрита від пошуку.
 *
 * Захист тут один — непередбачувана адреса, і індексація знесла б його цілком:
 * досить одного посилання десь назовні, щоб приватні фото з чужого весілля
 * стали знахідкою в пошуку. noindex тут, а в sitemap маршрут не додано взагалі.
 *
 * Прев'ю для месенджерів лишається: гості пересилають адресу одне одному, і
 * замість голого посилання видно імена пари. Самих фото в прев'ю немає.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await loadEvent(slug);
  const title = event ? `${event.couple_names} — фото з весілля` : 'Фото з весілля';

  return {
    title,
    description: 'Сторінка для гостей: завантажте свої фото з цього дня.',
    robots: { index: false, follow: false, nocache: true },
    openGraph: { title, description: 'Поділіться своїми фото з цього дня.', type: 'website' },
  };
}

export default async function WeddingPage({ params }: Props) {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event) notFound();

  return (
    <div className={display.variable}>
      <WeddingPageClient event={event} />
    </div>
  );
}
