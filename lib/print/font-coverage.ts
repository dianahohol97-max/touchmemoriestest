/**
 * Які символи шрифт справді вміє намалювати.
 *
 * Satori не має системного запасу шрифтів: якщо в жодному завантаженому шрифті
 * немає потрібного гліфа, вона малює порожній прямокутник і нічого про це не
 * каже. Так обкладинка TM-001232 приїхала з рядами чорних квадратиків замість
 * роздільників «─────── ♡ ───────».
 *
 * Запасні шрифти закривають той набір символів, який ми знаємо. Але поле напису
 * звичайне текстове, і вписати туди можна будь-що — грецьку, ієрогліф, рідкісний
 * дінгбат. Щоб такий випадок не перетворювався знову на мовчазний квадрат у
 * друці, тут читається cmap самих завантажених шрифтів і питається прямо: чи є
 * гліф. Немає — символ не потрапляє у файл, а замовлення отримує попередження.
 *
 * Парсер навмисно свій і крихітний: потрібні рівно таблиця cmap і формати 4 та
 * 12, якими Google віддає підмножини. Тягнути заради цього fontkit у serverless-
 * функцію було б дорожче, ніж сорок рядків читання буфера.
 */

/** Читає cmap і повертає множину кодів, які шрифт уміє намалювати. */
export function glyphCoverage(buf: ArrayBuffer): Set<number> {
    const out = new Set<number>();
    try {
        const dv = new DataView(buf);
        // Заголовок: sfnt version (4) + numTables (2) + 6 службових.
        const numTables = dv.getUint16(4);
        let cmapOffset = 0;
        for (let i = 0; i < numTables; i++) {
            const rec = 12 + i * 16;
            const tag = String.fromCharCode(
                dv.getUint8(rec), dv.getUint8(rec + 1), dv.getUint8(rec + 2), dv.getUint8(rec + 3),
            );
            if (tag === 'cmap') { cmapOffset = dv.getUint32(rec + 8); break; }
        }
        if (!cmapOffset) return out;

        const numSub = dv.getUint16(cmapOffset + 2);
        for (let i = 0; i < numSub; i++) {
            const rec = cmapOffset + 4 + i * 8;
            const subOffset = cmapOffset + dv.getUint32(rec + 4);
            const format = dv.getUint16(subOffset);

            if (format === 4) {
                const segX2 = dv.getUint16(subOffset + 6);
                const seg = segX2 / 2;
                const endBase = subOffset + 14;
                const startBase = endBase + segX2 + 2;
                const deltaBase = startBase + segX2;
                const rangeBase = deltaBase + segX2;
                for (let sIdx = 0; sIdx < seg; sIdx++) {
                    const end = dv.getUint16(endBase + sIdx * 2);
                    const start = dv.getUint16(startBase + sIdx * 2);
                    if (start === 0xFFFF) continue;
                    const delta = dv.getInt16(deltaBase + sIdx * 2);
                    const rangeOff = dv.getUint16(rangeBase + sIdx * 2);
                    for (let c = start; c <= end && c !== 0x10000; c++) {
                        let gid: number;
                        if (rangeOff === 0) {
                            gid = (c + delta) & 0xFFFF;
                        } else {
                            const gi = rangeBase + sIdx * 2 + rangeOff + (c - start) * 2;
                            if (gi + 1 >= dv.byteLength) continue;
                            const g = dv.getUint16(gi);
                            gid = g === 0 ? 0 : (g + delta) & 0xFFFF;
                        }
                        if (gid !== 0) out.add(c);
                    }
                }
            } else if (format === 12) {
                const nGroups = dv.getUint32(subOffset + 12);
                for (let g = 0; g < nGroups; g++) {
                    const rec12 = subOffset + 16 + g * 12;
                    const start = dv.getUint32(rec12);
                    const end = dv.getUint32(rec12 + 4);
                    const startGid = dv.getUint32(rec12 + 8);
                    if (startGid === 0 && end - start > 0x10000) continue; // захист від сміття
                    for (let c = start; c <= end; c++) out.add(c);
                }
            }
        }
    } catch {
        // Нечитаний шрифт — краще нічого не стверджувати, ніж стверджувати хибне.
    }
    return out;
}

/**
 * Безпечні заміни для символів, яких у шрифтах може не бути.
 *
 * Тільки там, де заміна виглядає майже так само: рамкові лінії на тире. Це не
 * «покращення» тексту клієнта, а вибір між схожою рискою і чорним квадратом.
 */
const SAFE_SUBSTITUTES: Record<string, string> = {
    '─': '—', // ─ → —
    '━': '—', // ━ → —
    '│': '|',      // │
    '┃': '|',      // ┃
    '╌': '–', // ╌ → –
    '―': '—', // ― → —
    '️': '',       // селектор варіації, сам по собі не малюється
};

export interface CoverageFix {
    /** Текст, у якому лишилися тільки ті символи, які реально намалюються. */
    text: string;
    /** Символи, які довелося замінити або прибрати — для попередження. */
    dropped: string[];
}

/**
 * Прибирає з тексту все, чого не намалює жоден із завантажених шрифтів.
 * Порожній `dropped` означає, що текст піде на друк таким, як його написали.
 */
export function fixToPrintableText(text: string, coverage: Set<number>): CoverageFix {
    const dropped: string[] = [];
    let out = '';
    for (const ch of Array.from(text)) {
        const cp = ch.codePointAt(0) ?? 0;
        if (coverage.has(cp) || /\s/.test(ch)) { out += ch; continue; }
        const sub = SAFE_SUBSTITUTES[ch];
        if (sub !== undefined) {
            const subCp = sub ? (sub.codePointAt(0) ?? 0) : 0;
            if (!sub || coverage.has(subCp)) {
                out += sub;
                dropped.push(ch);
                continue;
            }
        }
        // Нічим замінити — символ не потрапляє у файл. Порожнє місце чесніше за
        // чорний квадрат, і про нього буде сказано вголос.
        dropped.push(ch);
    }
    return { text: out, dropped: Array.from(new Set(dropped)) };
}
