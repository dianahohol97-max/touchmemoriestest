import type { Locale } from '@/lib/seo/locales';

export interface FaqItem {
    q: string;
    a: string;
}

const HEADING: Record<string, string> = {
    uk: 'Часті питання',
    en: 'FAQ',
    ro: 'Întrebări frecvente',
    pl: 'Najczęstsze pytania',
    de: 'Häufige Fragen',
};

/**
 * Читає faq для потрібної локалі за тією самою домовленістю, що й сторінки
 * landing_pages: українська лежить у самій колонці, решта — у
 * translations.{locale}.faq. Якщо перекладу немає, показуємо українську:
 * питання з відповіддю корисніше за порожнє місце, а Google однаково читає
 * мову сторінки з розмітки, а не з цього блоку.
 */
export function pickFaq(row: any, locale: Locale): FaqItem[] {
    if (!row) return [];
    const raw = locale === 'uk'
        ? row.faq
        : (((row.translations as any) || {})[locale] || {}).faq || row.faq;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
        (f: any) => f && typeof f.q === 'string' && typeof f.a === 'string' && f.q.trim() && f.a.trim(),
    );
}

/**
 * Секція «Часті питання» на сторінці товару.
 *
 * Серверний компонент: розмітка потрапляє у відповідь одразу, тож її бачить і
 * сканер, і людина з вимкненим JavaScript. Сторінка товару в усьому іншому
 * клієнтська, тому блок передається в неї як children — інакше він опинився б
 * після підвалу, бо саме ProductClient малює <main> і <Footer>.
 *
 * Розмітку FAQPage додає page.tsx поруч із Product і BreadcrumbList: тримати
 * її разом із рештою структурованих даних зрозуміліше, ніж розкладати по двох
 * компонентах, і так вона гарантовано збігається з видимим текстом.
 */
export default function ProductFaq({ items, locale }: { items: FaqItem[]; locale: Locale }) {
    if (!items.length) return null;
    const heading = HEADING[locale] || HEADING.uk;

    return (
        <section aria-label={heading} style={{ marginTop: 56, marginBottom: 40, maxWidth: 820 }}>
            <h2 style={{ fontSize: 'clamp(1.3rem, 3vw, 1.7rem)', fontWeight: 800, color: '#1e2d7d', marginBottom: 20 }}>
                {heading}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {items.map((f, i) => (
                    <details key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', padding: '14px 18px' }}>
                        <summary style={{ fontSize: 16, fontWeight: 600, color: '#1e2d7d', cursor: 'pointer', listStyle: 'none' }}>
                            {f.q}
                        </summary>
                        <p style={{ fontSize: 15, lineHeight: 1.7, color: '#475569', margin: '10px 0 2px' }}>{f.a}</p>
                    </details>
                ))}
            </div>
        </section>
    );
}
