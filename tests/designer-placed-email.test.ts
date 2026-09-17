import { describe, expect, it } from 'vitest';
import { render } from '@react-email/render';
import DesignerOrderPlacedEmail from '@/components/email/DesignerOrderPlacedEmail';

/**
 * Лист, якого не було.
 *
 * Потік із дизайнером вставляє замовлення прямо з браузера і не проходить через
 * /api/orders/submit, тож листа про оформлення не слав ніхто. TM-001320 (Юлія
 * Джулай, дев'ятнадцять фото з двадцяти одного) дві доби пролежало без жодного
 * слова від нас, і клієнтка написала в дирекг сама: «щось далі не розумію як
 * все буде відбуватись» (Діана, 17.09.2026).
 */

const html = (props: Parameters<typeof DesignerOrderPlacedEmail>[0]) =>
    render(DesignerOrderPlacedEmail(props));

describe('лист про прийняту заявку з дизайнером', () => {
    it('той самий випадок: каже, скільки фото доїхало, і не мовчить про втрачені', async () => {
        const out = await html({
            orderNumber: 'TM-001320', customerName: 'Юлія',
            photosAttached: 19, photosSubmitted: 21,
        });
        expect(out).toContain('TM-001320');
        expect(out).toContain('19');
        expect(out).toContain('21');
        // Саме число втрачених, а не туманне «частина фото», і зі згодою в числі.
        expect(out).toContain('два найважчі файли не пройшли');
    });

    it('коли доїхали всі, про втрати не згадуємо взагалі', async () => {
        const out = await html({ orderNumber: 'TM-001', photosAttached: 14, photosSubmitted: 14 });
        expect(out).toContain('Усі 14 знімків збережені');
        expect(out).not.toMatch(/не пройшли/);
    });

    it('пояснює, чому суми ще немає — це головне питання клієнта', async () => {
        const out = await html({ orderNumber: 'TM-001', photosAttached: 5, photosSubmitted: 5 });
        expect(out).toMatch(/ще немає суми/);
        expect(out).toMatch(/дизайнер/);
        expect(out).toMatch(/посилання на оплату/);
    });

    it('кнопки оплати немає, бо платити ще нема за що', async () => {
        const out = await html({ orderNumber: 'TM-001', photosAttached: 5, photosSubmitted: 5 });
        expect(out).not.toMatch(/Оплатити замовлення/);
        expect(out).not.toMatch(/pay\.monobank/);
    });

    it('побажання і доставка зʼявляються лише тоді, коли вони є', async () => {
        const bare = await html({ orderNumber: 'TM-001' });
        expect(bare).not.toContain('Ваше побажання');
        expect(bare).not.toContain('Дані доставки');

        const full = await html({
            orderNumber: 'TM-001',
            wish: 'Щоб була яскрава, кольорова, сімейна книга з моря',
            deliveryAddress: 'Київ, Відділення №102',
        });
        expect(full).toContain('Ваше побажання');
        expect(full).toContain('книга з моря');
        expect(full).toContain('Відділення №102');
    });

    it('без жодного фото блок про знімки мовчить, а не пише нуль', async () => {
        const out = await html({ orderNumber: 'TM-001', photosAttached: 0, photosSubmitted: 0 });
        expect(out).not.toMatch(/Усі 0 знімків/);
    });

    it('числа узгоджені: один файл, два файли, пʼять файлів', async () => {
        expect(await html({ orderNumber: 'T', photosAttached: 20, photosSubmitted: 21 }))
            .toContain('один найважчий файл не пройшов');
        expect(await html({ orderNumber: 'T', photosAttached: 18, photosSubmitted: 21 }))
            .toContain('три найважчі файли не пройшли');
        expect(await html({ orderNumber: 'T', photosAttached: 16, photosSubmitted: 21 }))
            .toContain('пʼять найважчих файлів не пройшли');
        expect(await html({ orderNumber: 'T', photosAttached: 1, photosSubmitted: 1 }))
            .toContain('Усі 1 знімок збережений');
        expect(await html({ orderNumber: 'T', photosAttached: 3, photosSubmitted: 3 }))
            .toContain('Усі 3 знімки збережені');
    });

    it('імʼя в звертанні не відмінюється навмання — його там немає', async () => {
        const out = await html({ orderNumber: 'T', customerName: 'Юлія' });
        expect(out).toContain('Вітаємо!');
        expect(out).not.toContain('Вітаємо, Юлія');
    });
});
