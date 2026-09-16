import { describe, expect, it } from 'vitest';
import {
    FIND_CABINET_EMAIL_COOLDOWN_MS,
    FIND_CABINET_IP_LIMIT,
    FIND_CABINET_IP_WINDOW_MS,
    FIND_CABINET_REPLY,
    buildCabinetRecoveryEmail,
    decideCabinetRecovery,
    markEmailSent,
    onEmailCooldown,
    overWindowLimit,
    type WindowState,
} from '@/lib/partners/find-cabinet';

/**
 * ФОРМА «ЗНАЙТИ МІЙ КАБІНЕТ» — і головне в ній не зручність, а те, чого вона
 * не розповідає.
 *
 * Кабінет відкривається одним лише cabinet_token, у ньому нарахування й
 * реквізити для виплат. Тому форма мусить уміти рівно одне: надіслати
 * посилання власнику скриньки. Усе інше — сказати, чи є така пошта в системі,
 * показати посилання на екрані, надіслати його тому, хто набрав чужу адресу —
 * це не дрібні недоліки, а саме те, заради чого зловмисник цю форму й відкриє.
 */

const NOW = 1_800_000_000_000;
const MINUTE = 60_000;

const partner = {
    email: 'studio@example.com',
    cabinet_token: '11111111-2222-3333-4444-555555555555',
    status: 'active',
    agency_name: 'Подорожуй!',
};

describe('відповідь однакова завжди', () => {
    it('текст не каже ні «знайшли», ні «не знайшли»', () => {
        expect(FIND_CABINET_REPLY).toContain('Якщо ця пошта є в нашій системі');
        // Жодного слова, з якого можна зрозуміти результат.
        expect(FIND_CABINET_REPLY).not.toMatch(/не знайд|немає такої|не зареєстр/i);
    });

    it('неіснуюча пошта і призупинений партнер дають ту саму мовчанку', () => {
        const missing = decideCabinetRecovery({ submittedEmail: 'nobody@example.com', partner: null });
        const paused = decideCabinetRecovery({ submittedEmail: partner.email, partner: { ...partner, status: 'paused' } });
        expect(missing.kind).toBe('ignore');
        expect(paused.kind).toBe('ignore');
        // Причина існує тільки для журналу й назовні не їде: обидві гілки
        // закінчуються тією самою відповіддю роуту.
        expect(missing.kind === 'ignore' && missing.reason).toBe('not_found');
        expect(paused.kind === 'ignore' && paused.reason).toBe('inactive');
    });

    it('партнер без токена теж нічого не отримує', () => {
        const r = decideCabinetRecovery({ submittedEmail: partner.email, partner: { ...partner, cabinet_token: null } });
        expect(r.kind).toBe('ignore');
    });

    it('сміття замість пошти не ламає форму', () => {
        for (const junk of ['', '   ', 'не-пошта', null, undefined]) {
            expect(decideCabinetRecovery({ submittedEmail: junk, partner }).kind).toBe('ignore');
        }
    });
});

describe('лист іде ЛИШЕ на пошту з запису партнера', () => {
    it('адресат береться з бази, а не з форми', () => {
        // Найважливіший тест файлу. Якщо пошук колись почне збігатися ширше —
        // за старою адресою, за доменом, за схожістю, — адресат усе одно
        // лишиться власником запису.
        const r = decideCabinetRecovery({
            submittedEmail: 'attacker@evil.example',
            partner,
        });
        expect(r.kind).toBe('send');
        expect(r.kind === 'send' && r.to).toBe('studio@example.com');
    });

    it('адресат нормалізується так само, як решта пошт у програмі', () => {
        const r = decideCabinetRecovery({
            submittedEmail: partner.email,
            partner: { ...partner, email: '  Studio@Example.COM ' },
        });
        expect(r.kind === 'send' && r.to).toBe('studio@example.com');
    });

    it('запис без пошти листа не породжує', () => {
        const r = decideCabinetRecovery({ submittedEmail: partner.email, partner: { ...partner, email: null } });
        expect(r.kind).toBe('ignore');
    });
});

describe('обмеження частоти', () => {
    it('пʼять спроб з адреси проходять, шоста ні', () => {
        const store = new Map<string, WindowState>();
        for (let i = 0; i < FIND_CABINET_IP_LIMIT; i++) {
            expect(overWindowLimit(store, '1.2.3.4', FIND_CABINET_IP_LIMIT, FIND_CABINET_IP_WINDOW_MS, NOW)).toBe(false);
        }
        expect(overWindowLimit(store, '1.2.3.4', FIND_CABINET_IP_LIMIT, FIND_CABINET_IP_WINDOW_MS, NOW)).toBe(true);
    });

    it('вікно відпускає через годину', () => {
        const store = new Map<string, WindowState>();
        for (let i = 0; i <= FIND_CABINET_IP_LIMIT; i++) {
            overWindowLimit(store, '1.2.3.4', FIND_CABINET_IP_LIMIT, FIND_CABINET_IP_WINDOW_MS, NOW);
        }
        expect(overWindowLimit(store, '1.2.3.4', FIND_CABINET_IP_LIMIT, FIND_CABINET_IP_WINDOW_MS, NOW + 61 * MINUTE)).toBe(false);
    });

    it('адреси рахуються окремо одна від одної', () => {
        const store = new Map<string, WindowState>();
        for (let i = 0; i <= FIND_CABINET_IP_LIMIT; i++) {
            overWindowLimit(store, '1.2.3.4', FIND_CABINET_IP_LIMIT, FIND_CABINET_IP_WINDOW_MS, NOW);
        }
        expect(overWindowLimit(store, '5.6.7.8', FIND_CABINET_IP_LIMIT, FIND_CABINET_IP_WINDOW_MS, NOW)).toBe(false);
    });

    it('скринька захищена окремо: ліміт на IP її не рятує', () => {
        // Адрес багато, скринька одна — без цього правила формою можна було б
        // завалити пошту партнера з різних IP.
        const store = new Map<string, number>();
        expect(onEmailCooldown(store, 'studio@example.com', FIND_CABINET_EMAIL_COOLDOWN_MS, NOW)).toBe(false);
        markEmailSent(store, 'studio@example.com', NOW);
        expect(onEmailCooldown(store, 'studio@example.com', FIND_CABINET_EMAIL_COOLDOWN_MS, NOW + MINUTE)).toBe(true);
        expect(onEmailCooldown(store, 'studio@example.com', FIND_CABINET_EMAIL_COOLDOWN_MS, NOW + 14 * MINUTE)).toBe(true);
        expect(onEmailCooldown(store, 'studio@example.com', FIND_CABINET_EMAIL_COOLDOWN_MS, NOW + 16 * MINUTE)).toBe(false);
    });

    it('чужа скринька чекання не успадковує', () => {
        const store = new Map<string, number>();
        markEmailSent(store, 'studio@example.com', NOW);
        expect(onEmailCooldown(store, 'other@example.com', FIND_CABINET_EMAIL_COOLDOWN_MS, NOW)).toBe(false);
    });
});

describe('лист відновлення', () => {
    it('веде на кабінет і попереджає, що посилання замінює пароль', () => {
        const mail = buildCabinetRecoveryEmail({
            agencyName: 'Подорожуй!', cabinetToken: partner.cabinet_token, email: partner.email,
        });
        expect(mail.html).toContain(`https://touchmemories.com.ua/uk/partner/${partner.cabinet_token}`);
        expect(mail.html).toContain('без пароля');
        expect(mail.text).toContain(partner.cabinet_token);
    });

    it('показує шлях, після якого листи більше не потрібні', () => {
        const mail = buildCabinetRecoveryEmail({
            agencyName: null, cabinetToken: partner.cabinet_token, email: partner.email,
        });
        expect(mail.html).toContain('/uk/partner/cabinet');
        expect(mail.html).toContain('/uk/register');
    });

    it('без назви агенції лист не ламається', () => {
        const mail = buildCabinetRecoveryEmail({
            agencyName: null, cabinetToken: partner.cabinet_token, email: partner.email,
        });
        expect(mail.html).not.toContain('null');
        expect(mail.subject).toBeTruthy();
    });
});
