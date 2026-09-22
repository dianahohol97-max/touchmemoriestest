import type { TocEntry } from '@/lib/blog/markdown';

/**
 * Зміст статті.
 *
 * НАВІЩО. Стаття на півтори тисячі слів читається з середини: людина приходить
 * із пошуку за одним питанням, а не за всією темою. Зміст дає їй дійти до
 * свого розділу, не гортаючи, і водночас віддає Google перелік того, про що
 * стаття, посиланнями, а не здогадками з тексту.
 *
 * Це звичайний `<nav>` зі звичайними якорями, без жодного скрипта: блок,
 * який розкривається на кліку, коштував би гідратації заради однієї деталі й
 * не працював би до неї. Якорі приходять із `extractToc`, тобто з тієї ж
 * функції, яка проставила `id` у тілі статті.
 *
 * Менше трьох розділів — змісту немає: три рядки над текстом заважають більше,
 * ніж допомагають.
 */
export default function TableOfContents({ entries }: { entries: TocEntry[] }) {
    if (entries.length < 3) return null;

    return (
        <nav
            aria-label="Зміст статті"
            style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '3px',
                padding: '24px 28px',
                marginBottom: '40px',
            }}
        >
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 800, color: '#263A99', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Зміст
            </h2>
            <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {entries.map(entry => (
                    <li key={entry.id} style={{ fontSize: '16px', lineHeight: 1.5 }}>
                        <a href={`#${entry.id}`} style={{ color: '#263A99', textDecoration: 'none', borderBottom: '1px solid #cbd5e1' }}>
                            {entry.text}
                        </a>
                    </li>
                ))}
            </ol>
        </nav>
    );
}
