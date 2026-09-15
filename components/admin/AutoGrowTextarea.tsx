'use client';

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Поле, яке саме росте під текст.
 *
 * Навіщо. Нотатки в картці замовлення жили у вікні на 120 пікселів із
 * `resize: 'none'` і `rows={3}`: приблизно три рядки, без можливості
 * розтягнути навіть мишею. Довгу нотатку — а в них лежать заголовки, написи
 * на обкладинку, побажання клієнта — доводилось читати, прокручуючи по три
 * рядки за раз, і жодного способу побачити її цілою не було («в цьому вікні,
 * коли багато тексту, незручно переглядати», Діана).
 *
 * Поле підганяє висоту під вміст одразу після того, як значення приїхало з
 * бази, а не лише коли в нього друкують. Це і є головний випадок: нотатку
 * найчастіше читають, а не пишуть.
 *
 * Стеля потрібна, бо нотатка буває справді великою, а картка не має їхати на
 * три екрани. Дійшовши до стелі, поле починає прокручуватись усередині —
 * тобто поводиться як раніше, тільки вікно на пів екрана, а не на три рядки.
 *
 * Потягнули за кут — далі висоту тримає людина. Інакше поле, зменшене вручну,
 * стрибало б назад на першому ж натисканні клавіші.
 */
export function AutoGrowTextarea({
    value,
    onChange,
    placeholder,
    style,
    minHeight = 120,
    maxHeight = 600,
    ...rest
}: {
    value: string;
    onChange: (next: string) => void;
    placeholder?: string;
    style?: React.CSSProperties;
    /** Найменша висота — поле ніколи не стискається нижче за неї. */
    minHeight?: number;
    /** Стеля, після якої вміст прокручується всередині поля. */
    maxHeight?: number;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'style' | 'placeholder'>) {
    const ref = useRef<HTMLTextAreaElement | null>(null);
    /** Висота, яку виставили МИ. Усе інше — робота людини. */
    const setByUs = useRef<number | null>(null);
    const manual = useRef(false);

    const fit = useCallback(() => {
        const el = ref.current;
        if (!el || manual.current) return;
        // Спершу 'auto': інакше scrollHeight ніколи не стане меншим за поточну
        // висоту й поле вміло б тільки рости.
        el.style.height = 'auto';
        // scrollHeight рахує вміст разом із падінгами, але без рамки, а висота
        // тут міряється по border-box. Різниця offsetHeight і clientHeight — це
        // рівно рамка, тож без неї поле щоразу виходило б на пару пікселів
        // нижчим за потрібне й показувало б смужку прокрутки на порожньому місці.
        const border = el.offsetHeight - el.clientHeight;
        const wanted = el.scrollHeight + border;
        const next = Math.min(Math.max(wanted, minHeight), maxHeight);
        el.style.height = `${next}px`;
        el.style.overflowY = wanted > maxHeight ? 'auto' : 'hidden';
        setByUs.current = Math.round(el.getBoundingClientRect().height);
    }, [minHeight, maxHeight]);

    // useLayoutEffect, а не useEffect: висота міряється до того, як браузер
    // покаже кадр, тож поле не встигає блимнути трьома рядками.
    useLayoutEffect(fit, [value, fit]);

    useEffect(() => {
        const el = ref.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(() => {
            const h = Math.round(el.getBoundingClientRect().height);
            if (setByUs.current !== null && h !== setByUs.current) manual.current = true;
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    return (
        <textarea
            {...rest}
            ref={ref}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            // overflowY навмисно не тут, а в fit(): усе, що стоїть у цьому
            // об'єкті, React повертає на місце при кожному перемальовуванні, і
            // смужка прокрутки зникала б рівно тоді, коли вона потрібна.
            style={{ ...style, minHeight, boxSizing: 'border-box', resize: 'vertical' }}
        />
    );
}
