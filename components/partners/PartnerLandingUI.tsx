import type { ReactNode } from 'react';
import type { LandingCard, LandingFaq } from '@/lib/partners/landing-content';

/**
 * Спільні блоки трьох сторінок партнерської програми.
 *
 * Нових візуальних патернів тут немає навмисно: синій градієнтний герой, білі
 * картки з піщаною рамкою і нумерований лічильник — це рівно те, що вже стоїть
 * на /photographers, а до того стояло на /travel-agencies. Сторінок стало три,
 * тож розмітку винесено сюди — інакше вона розійшлася б між ними при першій же
 * правці, як свого часу розійшлися дві копії панелі слота.
 *
 * Усі компоненти серверні: жодного стану на цих сторінках немає, а розмітка
 * має приїхати в HTML — FAQ-схема мусить збігатися з тим, що бачить краулер.
 */

const SAND = '#E8DCC8';
const INK = '#1A1A1A';
const MUTED = '#8B8378';
const BRAND = '#263A99';

/** Іконка з коротким описом: краулер і зчитувач екрана бачать текст, а не порожній svg. */
export function IconBadge({ alt, children }: { alt: string; children: ReactNode }) {
    return (
        <span
            role="img"
            aria-label={alt}
            style={{
                width: 52, height: 52, borderRadius: 12, background: '#eef3ff',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
        >
            {children}
        </span>
    );
}

export function PartnerHero({
    badge, h1, intro, children,
}: { badge: string; h1: string; intro: string; children?: ReactNode }) {
    return (
        <section style={{ background: 'linear-gradient(135deg, #263A99 0%, #1a2a73 100%)', padding: '64px 16px 72px', color: '#fff' }}>
            <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
                <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.12)', padding: '6px 16px', borderRadius: 20, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 13, marginBottom: 20 }}>
                    {badge}
                </div>
                {/* явний #fff — globals.css h1 { color: var(--primary) } перебиває успадкування */}
                <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: 42, lineHeight: 1.1, color: '#fff', margin: '0 0 16px' }}>
                    {h1}
                </h1>
                <p style={{ fontSize: 16.5, lineHeight: 1.75, opacity: 0.9, maxWidth: 680, margin: '0 auto' }}>
                    {intro}
                </p>
                {children}
            </div>
        </section>
    );
}

export function HeroButtons({
    primaryHref, primaryLabel, secondaryHref, secondaryLabel, note,
}: { primaryHref: string; primaryLabel: string; secondaryHref: string; secondaryLabel: string; note?: string }) {
    return (
        <>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 28 }}>
                <a href={primaryHref}
                    style={{ display: 'inline-block', minWidth: 230, textAlign: 'center', padding: '15px 30px', background: '#fff', color: BRAND, borderRadius: 12, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
                    {primaryLabel}
                </a>
                <a href={secondaryHref}
                    style={{ display: 'inline-block', minWidth: 210, textAlign: 'center', padding: '15px 30px', background: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,0.7)', borderRadius: 12, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
                    {secondaryLabel}
                </a>
            </div>
            {note && <p style={{ fontSize: 13, opacity: 0.75, marginTop: 16 }}>{note}</p>}
        </>
    );
}

/** Блок «H2 + вступний абзац + нумеровані картки». */
export function CardSection({
    id, h2, lead, alt, cards, icon, tinted = false,
}: { id: string; h2: string; lead: string; alt: string; cards: LandingCard[]; icon: ReactNode; tinted?: boolean }) {
    return (
        <section id={id} style={{ padding: '56px 16px', background: tinted ? '#F5EFE6' : 'transparent' }}>
            <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <IconBadge alt={alt}>{icon}</IconBadge>
                    <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 28, color: INK, margin: '14px 0 10px' }}>
                        {h2}
                    </h2>
                    <p style={{ fontSize: 15, lineHeight: 1.75, color: MUTED, maxWidth: 680, margin: '0 auto' }}>
                        {lead}
                    </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
                    {cards.map((c, i) => (
                        <div key={c.title} style={{ background: '#FFFFFF', border: `1px solid ${SAND}`, borderRadius: 16, padding: '26px 22px' }}>
                            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 300, fontSize: 34, color: BRAND, lineHeight: 1, marginBottom: 14 }}>
                                {String(i + 1).padStart(2, '0')}
                            </div>
                            <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, color: INK, margin: '0 0 8px' }}>{c.title}</h3>
                            <p style={{ fontSize: 13.5, lineHeight: 1.7, color: MUTED, margin: 0 }}>{c.text}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

/**
 * Видимий FAQ. Той самий масив іде в FAQPage JSON-LD на сторінці — Google
 * вимагає, щоб відповіді в схемі збігалися з тим, що бачить людина.
 */
export function FaqSection({ h2, alt, faq, icon }: { h2: string; alt: string; faq: LandingFaq[]; icon: ReactNode }) {
    return (
        <section style={{ background: '#f4f6fb', padding: '56px 16px 72px' }}>
            <div style={{ maxWidth: 860, margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: 26 }}>
                    <IconBadge alt={alt}>{icon}</IconBadge>
                    <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 26, color: '#1e2d7d', margin: '14px 0 0' }}>{h2}</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {faq.map(({ q, a }) => (
                        <details key={q} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
                            <summary style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>{q}</summary>
                            <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.75, margin: '10px 0 0' }}>{a}</p>
                        </details>
                    ))}
                </div>
            </div>
        </section>
    );
}

export function CtaSection({
    h2, text, primaryHref, primaryLabel, secondaryHref, secondaryLabel,
}: { h2: string; text: string; primaryHref: string; primaryLabel: string; secondaryHref: string; secondaryLabel: string }) {
    return (
        <section style={{ padding: '64px 16px 80px' }}>
            <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 26, color: INK, margin: '0 0 12px' }}>{h2}</h2>
                <p style={{ fontSize: 15, lineHeight: 1.75, color: MUTED, margin: '0 0 24px' }}>{text}</p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <a href={primaryHref}
                        style={{ display: 'inline-block', minWidth: 230, textAlign: 'center', padding: '15px 30px', background: BRAND, color: '#fff', borderRadius: 12, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
                        {primaryLabel}
                    </a>
                    <a href={secondaryHref}
                        style={{ display: 'inline-block', minWidth: 210, textAlign: 'center', padding: '15px 30px', background: '#fff', color: BRAND, border: `1.5px solid ${BRAND}`, borderRadius: 12, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
                        {secondaryLabel}
                    </a>
                </div>
            </div>
        </section>
    );
}
