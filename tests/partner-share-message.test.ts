import { describe, expect, it } from 'vitest';
import { partnerShareMessage } from '@/lib/partners/share-message';
import { partnerRefLink } from '@/lib/partners/referral-link';

/**
 * ТЕКСТ, ЯКИМ МЕНЕДЖЕР ВІДДАЄ ПАРТНЕРУ ПОСИЛАННЯ.
 *
 * Перевіряються дві речі. Перша — що в тексті немає нічого приватного: у
 * кабінеті менеджера партнерський cabinet_token не має зʼявитися ні в якому
 * вигляді, бо він відкриває чужі нарахування й реквізити без пароля. Друга —
 * що умови в тексті збігаються з тим, як усе працює насправді: знижка на перше
 * замовлення, відсоток партнеру назавжди. Помилитися тут дешево на вигляд і
 * дорого по суті, бо обіцянка клієнту йде в директ і живе там роками.
 */

const CODE = 'ПОДОTABB';
const TOKEN = '11111111-2222-3333-4444-555555555555';

describe('partnerShareMessage', () => {
    it('містить рівно те публічне посилання, що й решта проєкту', () => {
        const msg = partnerShareMessage(CODE);
        expect(msg).toContain(partnerRefLink(CODE));
        // Кирилиця закодована: незакодований рядок ламається в месенджерах,
        // а саме в месенджер цей текст і вставляють.
        expect(msg).toContain('%D0%9F%D0%9E%D0%94%D0%9ETABB');
    });

    it('НЕ містить приватного кабінету партнера', () => {
        const msg = partnerShareMessage(CODE);
        expect(msg).not.toContain(TOKEN);
        expect(msg).not.toContain('/uk/partner/');
        expect(msg).not.toContain('cabinet');
    });

    it('каже правду про знижку: вона на перше замовлення', () => {
        // «Усі, хто замовить, отримають знижку» було б неправдою: знижка діє
        // лише на перше, привʼязувальне замовлення клієнта.
        const msg = partnerShareMessage(CODE);
        expect(msg).toContain('перше замовлення');
    });

    it('каже правду про відсоток: він довічний', () => {
        const msg = partnerShareMessage(CODE);
        expect(msg).toContain('назавжди');
    });

    it('порожній код не робить вигляд, ніби посилання робоче', () => {
        // Партнер без коду — стан зламаний, і текст не має його маскувати.
        expect(partnerShareMessage(null)).toContain('https://touchmemories.com.ua/?ref=');
    });

    it('жодне речення не коротше за три слова', () => {
        // Правило письма Діани: односкладних рубаних фраз в українських
        // текстах не буває.
        const sentences = partnerShareMessage(CODE)
            .split('\n\n')
            .flatMap(p => p.split(/(?<=[.!?])\s+/))
            .map(x => x.trim())
            .filter(Boolean);
        for (const sentence of sentences) {
            expect(sentence.split(/\s+/).length).toBeGreaterThan(2);
        }
    });
});
