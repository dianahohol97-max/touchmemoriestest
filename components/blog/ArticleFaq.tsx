export type FaqItem = { q: string; a: string };

/**
 * Блок питань і відповідей у кінці статті.
 *
 * ПРАВИЛО, ЯКЕ ТУТ ВАЖЛИВІШЕ ЗА ВИГЛЯД: розмітка `FAQPage` будується з ЦИХ
 * самих рядків, а не пишеться окремо. Схема, яка обіцяє питання, якого на
 * сторінці немає, — це порушення рекомендацій Google, і карається воно не
 * помилкою, а тихим зникненням розширеного сніпета. Сусідній `ProductFaq`
 * зроблено так само й з тієї ж причини.
 *
 * `<details>` замість скрипта навмисно: розкривається браузером, працює до
 * гідратації, і пошуковик бачить відповідь у HTML, а не після кліку.
 */
export default function ArticleFaq({ items }: { items: FaqItem[] }) {
    if (!items.length) return null;

    return (
        <section style={{ borderTop: '2px dashed #f1f5f9', paddingTop: '40px', marginBottom: '48px' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 900, color: '#263A99', marginBottom: '24px' }}>
                Часті запитання
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {items.map((item, i) => (
                    <details
                        key={i}
                        // Перше питання відкрите: закритий блок із п'яти
                        // однакових рядків читається як службовий список, а не
                        // як текст, у який варто зазирнути.
                        open={i === 0}
                        style={{ border: '1px solid #e2e8f0', borderRadius: '3px', padding: '16px 20px', backgroundColor: 'white' }}
                    >
                        <summary style={{ fontWeight: 800, color: '#263A99', fontSize: '17px', cursor: 'pointer', listStyle: 'none' }}>
                            {item.q}
                        </summary>
                        <p style={{ margin: '12px 0 0', color: '#475569', fontSize: '16px', lineHeight: 1.7 }}>
                            {item.a}
                        </p>
                    </details>
                ))}
            </div>
        </section>
    );
}

/**
 * Читає `blog_posts.faq` у передбачуваний список.
 *
 * Поле заповнює генератор, тобто модель, і покластися на його форму не можна:
 * там траплялося і `{question, answer}`, і рядок замість масиву. Усе, що не
 * складається в пару «питання — відповідь», відкидається мовчки, бо
 * наполовину заповнений акордеон гірший за його відсутність.
 */
export function parseFaq(raw: unknown): FaqItem[] {
    if (!Array.isArray(raw)) return [];

    const items: FaqItem[] = [];
    for (const entry of raw) {
        if (!entry || typeof entry !== 'object') continue;
        const q = String((entry as any).q ?? (entry as any).question ?? '').trim();
        const a = String((entry as any).a ?? (entry as any).answer ?? '').trim();
        if (q && a) items.push({ q, a });
    }
    // П'ять питань — стеля: далі блок перестає бути доповненням до статті й
    // починає бути другою статтею.
    return items.slice(0, 5);
}
