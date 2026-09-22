import type { Locale } from '@/lib/seo/locales';

/**
 * Заголовки й описи списку блогу по локалях.
 *
 * Винесено з `app/[locale]/blog/page.tsx`, бо ті самі рядки потрібні сторінкам
 * з номерами (`/blog/storinka/2`), а `generateMetadata` живе в кожному
 * маршруті окремо. Копія в другому файлі розійшлася б із першою мовчки: опис
 * у видачі бачить пошуковик, а не ми.
 */
export const BLOG_META: Record<Locale, { title: string; description: string; h1: string; subtitle: string }> = {
    uk: {
        title: 'Блог про фотокниги та подарунки з фото | Touch.Memories',
        description: 'Поради, ідеї та натхнення для створення фотокниги, тревелбука і подарунка з фотографіями. Пишемо про те, що робити зі знімками після зйомки чи подорожі.',
        h1: 'Блог touch.memories',
        subtitle: 'Натхнення, ідеї для подарунків та поради щодо створення фотокниги, яку хочеться гортати.',
    },
    en: {
        title: 'Blog about photo books and photo gifts | Touch.Memories',
        description: 'Tips, ideas and inspiration for creating a photo book, a travel book and a gift made of photographs — and what to do with your pictures after the trip.',
        h1: 'touch.memories blog',
        subtitle: 'Inspiration, gift ideas and tips for creating a photo book worth leafing through.',
    },
    pl: {
        title: 'Blog o fotoksiążkach i prezentach ze zdjęć | Touch.Memories',
        description: 'Porady, pomysły i inspiracje do tworzenia fotoksiążki, travel booka i prezentu ze zdjęć — oraz co zrobić ze zdjęciami po podróży.',
        h1: 'Blog touch.memories',
        subtitle: 'Inspiracje, pomysły na prezenty i porady dotyczące tworzenia fotoksiążki.',
    },
    de: {
        title: 'Blog über Fotobücher und Fotogeschenke | Touch.Memories',
        description: 'Tipps, Ideen und Inspiration für Fotobuch, Reisebuch und Geschenke aus Fotos — und was nach der Reise mit den Bildern passieren kann.',
        h1: 'touch.memories Blog',
        subtitle: 'Inspiration, Geschenkideen und Tipps für das perfekte Fotobuch.',
    },
    ro: {
        title: 'Blog despre cărți foto și cadouri din fotografii | Touch.Memories',
        description: 'Sfaturi, idei și inspirație pentru cartea foto, travel book și cadouri din fotografii — și ce poți face cu pozele după vacanță.',
        h1: 'Blogul touch.memories',
        subtitle: 'Inspirație, idei de cadouri și sfaturi pentru a crea cartea foto perfectă.',
    },
};
