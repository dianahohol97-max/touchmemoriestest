import { describe, expect, it } from 'vitest';
import { buildPartnerWelcomeEmail } from '@/lib/agency/welcome-email';

/**
 * ОДИН ВІТАЛЬНИЙ ЛИСТ, А НЕ ДВА.
 *
 * До 16.09.2026 лист існував двічі: канонічна функція в
 * lib/agency/welcome-email.ts і повна копія, вписана в роут
 * /api/admin/agency-partners/[id]/resend-welcome, на який спирається кнопка
 * «Надіслати лист» в адмінці. Копія розійшлася з оригіналом за чотирма
 * пунктами, тож партнер, якому лист надсилали вдруге, читав інші умови, ніж
 * партнер, якому він пішов при оформленні.
 *
 * Тести закріплюють рівно ті чотири розбіжності: з ними копія не змогла б
 * пройти, а канонічна функція проходить. Повернути інлайн-версію непоміченою
 * більше не вийде.
 */

const base = {
    email: 'studio@example.com',
    name: 'Подорожуй!',
    code: 'ПОДОTABB',
    cabinetToken: '11111111-2222-3333-4444-555555555555',
    partnerKind: 'travel_agency',
    clientDiscount: 5,
    travelbookRate: 5,
    otherRate: 3,
};

describe('канонічний вітальний лист', () => {
    it('веде ПОСИЛАННЯМ, і воно закодоване', () => {
        // Копія вела кодом («Ось ваш персональний промокод»), хоча посилання
        // стало головним інструментом: за ним знижка застосовується сама.
        const { html, subject } = buildPartnerWelcomeEmail(base);
        expect(subject).toContain('посилання');
        expect(html).toContain('https://touchmemories.com.ua/?ref=%D0%9F%D0%9E%D0%94%D0%9ETABB');
        // Кириличний код у сирому вигляді в посиланні ламається в месенджерах.
        expect(html).not.toContain('/?ref=ПОДОTABB');
    });

    it('знижка клієнта береться з переданих умов, а не зашита пʼятіркою', () => {
        const { html } = buildPartnerWelcomeEmail({ ...base, clientDiscount: 12 });
        expect(html).toContain('12%');
        const off = buildPartnerWelcomeEmail({ ...base, clientDiscount: 0 });
        expect(off.html).toContain('0%');
    });

    it('ставки партнера теж із умов', () => {
        const { html } = buildPartnerWelcomeEmail({ ...base, travelbookRate: 7, otherRate: 4 });
        expect(html).toContain('7%');
        expect(html).toContain('4%');
    });

    it('знає всі чотири види партнера', () => {
        // Копія знала два і називала фотографа «агенцією».
        const kinds: Record<string, string> = {
            travel_agency: 'агенцією',
            wedding_agency: 'весільною агенцією',
            travel_blogger: 'блогером',
            photographer: 'фотографом',
        };
        for (const [kind, word] of Object.entries(kinds)) {
            expect(buildPartnerWelcomeEmail({ ...base, partnerKind: kind }).html).toContain(word);
        }
    });

    it('розповідає про довічну привʼязку — головну умову партнерства', () => {
        // Копія про неї мовчала.
        const { html, text } = buildPartnerWelcomeEmail(base);
        expect(html).toContain('назавжди');
        expect(text).toContain('назавжди');
    });

    it('дає і приватний кабінет, і шлях входу через акаунт', () => {
        const { html } = buildPartnerWelcomeEmail(base);
        expect(html).toContain(`/uk/partner/${base.cabinetToken}`);
        expect(html).toContain('/uk/partner/cabinet');
        expect(html).toContain('/uk/register');
    });
});
