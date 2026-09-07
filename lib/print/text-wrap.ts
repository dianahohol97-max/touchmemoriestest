/**
 * Розкладка напису у прямокутнику фіксованого фізичного розміру.
 *
 * Файли для лазера (метал, гравіювання, флекс) — це напис на пластині відомих
 * міліметрів. Досі текст малювався ОДНИМ рядком: якщо він не влазив у ширину,
 * зменшувався шрифт, і більше нічого. На підписі «Із тисячі доріг — одна
 * привела нас одне до одного» на пластині 90 мм це давало волосину заввишки з
 * міліметр, яку після гравіювання не прочитати (TM-001288). Перенесення рядків
 * не було взагалі, хоча місця по висоті лишалося більше половини пластини.
 *
 * Тому підбираємо і перенесення, і кегль разом: спершу пробуємо найбільший
 * дозволений шрифт, розкладаємо текст по рядках і перевіряємо, чи вміщається
 * блок у висоту. Не вміщається — зменшуємо і пробуємо знову.
 *
 * Вимірювання передається ззовні (`measureAt`), бо на клієнті це
 * ctx.measureText, а в тесті — проста модель ширини. Так логіка розкладки
 * перевіряється без канви.
 */

/** Явні переноси автора зберігаються, решта переноситься по словах. */
export function wrapLines(
    text: string,
    maxWidth: number,
    measure: (line: string) => number,
): string[] {
    const out: string[] = [];
    for (const hard of String(text ?? '').split('\n')) {
        const words = hard.trim().split(/\s+/).filter(Boolean);
        if (words.length === 0) continue;
        let line = '';
        for (const word of words) {
            const next = line ? `${line} ${word}` : word;
            // Слово, довше за рядок, не ріжемо: воно лишається як є, а кегль
            // під нього підбере fitTextBlock. Різати слово посеред літер на
            // гравіюванні гірше, ніж дрібніший шрифт.
            if (line && measure(next) > maxWidth) {
                out.push(line);
                line = word;
            } else {
                line = next;
            }
        }
        if (line) out.push(line);
    }
    return out;
}

export interface FitTextOptions {
    text: string;
    maxWidth: number;
    maxHeight: number;
    /** Найбільший кегль, з якого починаємо підбір. */
    startFontPx: number;
    /** Нижче цього не опускаємось — далі текст усе одно не прочитати. */
    minFontPx: number;
    lineHeight?: number;
    measureAt: (line: string, fontPx: number) => number;
}

/**
 * Кегль і рядки, які вміщаються у прямокутник.
 *
 * Повертає найбільший кегль, при якому і найширший рядок влазить у ширину, і
 * весь блок — у висоту. Якщо не влазить навіть на мінімумі, віддає мінімум:
 * краще трохи затісний напис, ніж порожня пластина.
 */
export function fitTextBlock(opts: FitTextOptions): { fontPx: number; lines: string[] } {
    const lineHeight = opts.lineHeight ?? 1.2;
    const start = Math.max(opts.minFontPx, opts.startFontPx);
    let fontPx = start;
    let lines: string[] = [];

    // Крок 6 % на ітерацію: від стартового кегля до мінімуму це десятки
    // спроб навіть при десятикратній різниці, і кожна з них — лише
    // перерахунок ширин, без малювання.
    for (let i = 0; i < 200; i++) {
        lines = wrapLines(opts.text, opts.maxWidth, l => opts.measureAt(l, fontPx));
        if (lines.length === 0) return { fontPx, lines };
        const widest = Math.max(...lines.map(l => opts.measureAt(l, fontPx)));
        const blockH = lines.length * fontPx * lineHeight;
        if ((widest <= opts.maxWidth && blockH <= opts.maxHeight) || fontPx <= opts.minFontPx) break;
        fontPx = Math.max(opts.minFontPx, fontPx * 0.94);
    }
    return { fontPx, lines };
}
