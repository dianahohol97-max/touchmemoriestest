import { describe, expect, it } from 'vitest';
import { missingRequiredOptions, areAllRequiredOptionsFilled } from '@/components/ui/ProductOptionsSelector';

/**
 * Плашка над кнопкою замовлення називає пропущене поіменно.
 *
 * До цього вона казала «Оберіть всі обов'язкові опції перед замовленням» і не
 * називала жодної: на фотокнизі обов'язкових опцій шість, а єдиною підказкою
 * про колір обкладинки був дрібний сірий рядок у підписі сітки зразків. Тест
 * пінить саме список, бо і перевірка кнопки, і текст плашки тепер читають
 * його однаково — якщо список зіпсується, кнопка або заблокується назавжди,
 * або пропустить позицію без кольору, як сталося з TM-001296.
 */
const FULL_LEATHERETTE = {
    'Розмір': '30х30',
    'Кількість сторінок': 50,
    'Тип ламінації': 'Матова',
    'Калька перед першою сторінкою': 'Без кальки',
    'Колір шкірзамінника': 'Пудровий (Ш-21)',
};

describe('missingRequiredOptions', () => {
    it('нічого не бракує, коли заповнені всі опції разом із кольором', () => {
        expect(missingRequiredOptions('photobook-leatherette', FULL_LEATHERETTE)).toEqual([]);
        expect(areAllRequiredOptionsFilled('photobook-leatherette', FULL_LEATHERETTE)).toBe(true);
    });

    it('називає саме колір обкладинки, коли бракує тільки його — випадок TM-001296', () => {
        const { 'Колір шкірзамінника': _, ...withoutColor } = FULL_LEATHERETTE;
        expect(missingRequiredOptions('photobook-leatherette', withoutColor))
            .toEqual([{ name: 'Колір шкірзамінника', kind: 'choice' }]);
        expect(areAllRequiredOptionsFilled('photobook-leatherette', withoutColor)).toBe(false);
    });

    it('перелічує все пропущене, а не зупиняється на першому', () => {
        const names = missingRequiredOptions('photobook-velour', { 'Розмір': '20х20' }).map(m => m.name);
        expect(names).toContain('Кількість сторінок');
        expect(names).toContain('Тип ламінації');
        expect(names).toContain('Колір велюру');
        expect(names).not.toContain('Розмір');
    });

    it('напис на обкладинці — це текст, а не вибір зі списку', () => {
        const withInscription = { ...FULL_LEATHERETTE, 'Оздоблення': 'Індивідуальний напис' };
        expect(missingRequiredOptions('photobook-leatherette', withInscription))
            .toEqual([{ name: 'Напис на обкладинці', kind: 'text' }]);
    });

    it('друкована обкладинка кольору не має, тож і не блокує замовлення', () => {
        const printed = {
            'Розмір': '30х30',
            'Кількість сторінок': 50,
            'Тип ламінації': 'Глянцева',
            'Калька перед першою сторінкою': 'Без кальки',
        };
        expect(missingRequiredOptions('photobook-printed', printed)).toEqual([]);
    });

    it('випускній книзі калька не обов\'язкова', () => {
        const graduation = {
            'Розмір': '20х30',
            'Кількість сторінок': 20,
            'Тип ламінації': 'Матова',
        };
        expect(missingRequiredOptions('graduation-photobook', graduation)).toEqual([]);
    });
});
