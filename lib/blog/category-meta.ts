import { getLocalized } from '@/lib/i18n/localize';
import { clampWords, META_DESCRIPTION_MAX, META_TITLE_MAX } from '@/lib/blog/post';
import type { Locale } from '@/lib/seo/locales';

/**
 * Заголовок і опис сторінки категорії блогу.
 *
 * НАВІЩО ОКРЕМО ВІД НАЗВИ КАТЕГОРІЇ. До 22.09.2026 сторінка віддавала
 * «Подорожі | TouchMemories Блог» і опис «Читайте статті в категорії
 * Подорожі». Дев'ять категорій — дев'ять заголовків з одного слова і дев'ять
 * описів за одним шаблоном: для пошуку це дев'ять сторінок, які нічим не
 * відрізняються, окрім одного іменника. Тому назва тут розгортається у фразу,
 * якою справді щось шукають, а опис береться з поля `description`, якщо воно
 * заповнене.
 *
 * Опис категорії в базі порожній у більшості рядків, і вигадувати його кодом
 * не можна — тому запасний варіант чесно описує, ЩО на сторінці, а не
 * прикидається текстом про тему.
 */

const SUFFIX: Record<Locale, string> = {
    uk: 'статті та ідеї',
    en: 'articles and ideas',
    ro: 'articole și idei',
    pl: 'artykuły i pomysły',
    de: 'Artikel und Ideen',
};

const FALLBACK: Record<Locale, (name: string) => string> = {
    uk: name => `Усі статті touch.memories у категорії «${name}»: поради, ідеї та покрокові гіди про те, що зробити зі своїми фотографіями.`,
    en: name => `All touch.memories articles in “${name}”: tips, ideas and step-by-step guides on what to do with your photographs.`,
    ro: name => `Toate articolele touch.memories din categoria „${name}”: sfaturi, idei și ghiduri despre ce poți face cu fotografiile tale.`,
    pl: name => `Wszystkie artykuły touch.memories w kategorii „${name}”: porady, pomysły i przewodniki o tym, co zrobić ze zdjęciami.`,
    de: name => `Alle touch.memories Artikel in „${name}“: Tipps, Ideen und Anleitungen dazu, was aus Ihren Fotos werden kann.`,
};

export function categoryTitle(category: any, locale: Locale, name: string): string {
    const custom = ((category?.translations || {})[locale] || {}).meta_title || category?.meta_title;
    if (custom) return clampWords(String(custom), META_TITLE_MAX);
    return clampWords(`${name}: ${SUFFIX[locale] || SUFFIX.uk}`, META_TITLE_MAX);
}

export function categoryDescription(category: any, locale: Locale, name: string): string {
    const own = getLocalized(category, locale, 'description');
    const text = own && own.trim() ? own : (FALLBACK[locale] || FALLBACK.uk)(name);
    return clampWords(text, META_DESCRIPTION_MAX);
}

/**
 * Рядок категорії за слагом.
 *
 * Сервісним ключем навмисно: `generateMetadata` виконується поза запитом
 * відвідувача, і звичайний клієнт повернув би тут порожньо через політику
 * читання — тобто заголовок «Категорію не знайдено» на цілком живій сторінці.
 */
export async function loadCategory(slug: string) {
    const { getAdminClient } = await import('@/lib/supabase/admin');
    const { data } = await getAdminClient()
        .from('blog_categories').select('*').eq('slug', slug).maybeSingle();
    return data;
}
