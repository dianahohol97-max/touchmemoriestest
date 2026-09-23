import { describe, expect, it } from 'vitest';
import { readyCoverLayout } from '@/lib/editor/ready-cover-fit';
import { frontCoverInset } from '@/lib/print/cover-fold';

/**
 * Геометрія передньої половини аркуша обкладинки.
 *
 * Числа не вигадані тут: аркуш тревелбука 470×328 мм (lib/print/geometry.ts),
 * поле загину 20 мм з кожного боку (COVER_FOLD_MM у lib/print/trim-guides.ts),
 * сторінка 210×297 мм. Корінець — решта: 470 − 2×20 − 2×210 = 10 мм, тобто по
 * пʼять на кожну половину. Передня половина 235 мм завширшки.
 *
 * Тест стоїть тут саме тому, що ці числа розкидані по трьох файлах і вже
 * розходилися. Якщо друкарня змінить специфікацію, він упаде першим.
 */
describe('frontCoverInset', () => {
    it('тревелбук: 5 мм корінця зліва, 20 мм загину справа, 20 мм згори й знизу', () => {
        const i = frontCoverInset('travelbook');
        expect(i.left).toBeCloseTo(5 / 235, 6);
        expect(i.right).toBeCloseTo(20 / 235, 6);
        expect(i.top).toBeCloseTo(20 / 328, 6);
        expect(i.bottom).toBeCloseTo(20 / 328, 6);
    });

    it('видима площина передньої обкладинки виходить 210×288 мм', () => {
        const i = frontCoverInset('travelbook');
        expect(235 * (1 - i.left - i.right)).toBeCloseTo(210, 6);
        expect(328 * (1 - i.top - i.bottom)).toBeCloseTo(288, 6);
    });

    it('невідомий розмір не валить розрахунок, а дає ті самі 6 %, що й конструктор', () => {
        const i = frontCoverInset('23x23');
        expect(i.left).toBeCloseTo(0.06, 6);
        expect(i.right).toBeCloseTo(0.06, 6);
    });
});

describe('readyCoverLayout', () => {
    it('макет без збереженого режиму лишається заповненим з обрізанням', () => {
        const l = readyCoverLayout(undefined, 'travelbook', '#b27467');
        expect(l.image.objectFit).toBe('cover');
        expect(l.image.width).toBe('100%');
        // Заливки немає: у цьому режимі картинка закриває аркуш цілком.
        expect(l.wrap.background).toBeUndefined();
    });

    it('новий режим вписує картинку і заливає решту аркуша кольором тла', () => {
        const l = readyCoverLayout('contain', 'travelbook', '#b27467');
        expect(l.image.objectFit).toBe('contain');
        expect(l.wrap.background).toBe('#b27467');
        expect(l.image.left).toBe(`${(5 / 235) * 100}%`);
        expect(l.image.top).toBe(`${(20 / 328) * 100}%`);
    });

    it('без кольору заливка біла, а не прозора — прозорий аркуш друкарня не прийме', () => {
        const l = readyCoverLayout('contain', 'travelbook', undefined);
        expect(l.wrap.background).toBe('#ffffff');
    });
});
