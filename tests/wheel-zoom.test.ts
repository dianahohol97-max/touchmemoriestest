import { describe, expect, it } from 'vitest';
import { isZoomModifier, wheelZoomDelta, WHEEL_ZOOM_STEP } from '@/lib/editor/wheel-zoom';

/**
 * Колесо над фотографією в конструкторі.
 *
 * Тест закріплює дві речі, які легко зламати наосліп, бо перевірити їх можна
 * тільки живим жестом на реальному пристрої.
 *
 * Перша — напрямок і величина кроку. Крок пропорційний силі жесту, і саме тут
 * ховається різниця між мишею і трекпадом: колесо миші дає близько ста пікселів
 * за клац, а щипок на трекпаді Mac — десятки дрібних подій по кілька пікселів.
 * Фіксований крок 0,05 на кожну подію проніс би масштаб від 1 до 4 за пів
 * секунди щипка. Класичний клац миші мусить лишатися рівно тим, чим був.
 *
 * Друга — розпізнавання щипка. Браузер віддає щипок на трекпаді як `wheel` із
 * `ctrlKey: true`, хоча жодного Ctrl людина не тримає. Якщо це не впіймати і не
 * викликати `preventDefault()`, щипок масштабує всю сторінку браузера замість
 * фотографії.
 */
const wheel = (init: Partial<WheelEvent>) => init as WheelEvent;

describe('wheelZoomDelta', () => {
    it('дає рівно попередній крок на звичайний клац колеса миші', () => {
        // 100 px — те, що надсилає миша в піксельному режимі.
        expect(wheelZoomDelta(wheel({ deltaY: 100 }))).toBeCloseTo(-WHEEL_ZOOM_STEP, 10);
        expect(wheelZoomDelta(wheel({ deltaY: -100 }))).toBeCloseTo(WHEEL_ZOOM_STEP, 10);
    });

    it('зменшує масштаб на прокрутку вниз і збільшує на прокрутку вгору', () => {
        expect(wheelZoomDelta(wheel({ deltaY: 240 }))).toBeLessThan(0);
        expect(wheelZoomDelta(wheel({ deltaY: -240 }))).toBeGreaterThan(0);
    });

    it('не дає щипку на трекпаді пролетіти весь діапазон', () => {
        // Щипок приходить дрібними подіями. Кожна з них мусить бути помітно
        // меншою за клац миші, інакше один жест вивертає масштаб до межі.
        const pinchStep = Math.abs(wheelZoomDelta(wheel({ deltaY: 3, ctrlKey: true })));
        expect(pinchStep).toBeLessThan(WHEEL_ZOOM_STEP);
        expect(pinchStep).toBeGreaterThan(0);
        // Тридцять подій щипка — це приблизно третина діапазону, не весь.
        expect(pinchStep * 30).toBeLessThan(1);
    });

    it('тримає різкий ривок колеса в межах розумного кроку', () => {
        // Інерційна прокрутка на трекпаді видає разові deltaY у кілька сотень.
        expect(Math.abs(wheelZoomDelta(wheel({ deltaY: 900 })))).toBeLessThanOrEqual(0.1);
    });
});

describe('isZoomModifier', () => {
    it('впізнає щипок на трекпаді Mac, який приходить як ctrlKey', () => {
        expect(isZoomModifier(wheel({ deltaY: 4, ctrlKey: true }))).toBe(true);
    });

    it('впізнає Cmd на Mac і Ctrl на клавіатурі', () => {
        expect(isZoomModifier(wheel({ deltaY: 100, metaKey: true }))).toBe(true);
    });

    it('лишає просте колесо сторінці', () => {
        expect(isZoomModifier(wheel({ deltaY: 100 }))).toBe(false);
        // Shift+колесо — це горизонтальна прокрутка, а не масштаб.
        expect(isZoomModifier(wheel({ deltaY: 100, shiftKey: true }))).toBe(false);
    });
});
