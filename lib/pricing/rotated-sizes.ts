/**
 * Один і той самий виріб, повернутий боком, мусить коштувати однаково.
 *
 * 20×30 і 30×20 — це одна фотокнига в різній орієнтації: той самий папір,
 * той самий друк, те саме виробництво. Код так її й рахує: у lib/products.ts
 * обидва розміри мають ОДИН спільний ключ ціни '20x30_30x20'. А таблиця цін
 * тримає їх окремими рядками, тож ніщо не заважає їм розійтися — і вони
 * розійшлися.
 *
 * Як саме. Обидві шкали друкованої обкладинки починалися з 890 ₴ на десяти
 * сторінках і закінчувалися 2390 ₴ на пʼятдесяти, але 20×30 ішов кроком 75 ₴
 * на кожні дві сторінки, а 30×20 — кроком 70 ₴. Опорні точки збігалися, бо їх
 * виставили окремо, а все між ними недобирало: від 5 ₴ на дванадцяти
 * сторінках до 95 ₴ на сорока восьми. На 24 сторінках сайт просив 1380 ₴
 * замість 1415 ₴ — з цього Діана й помітила (15.09.2026).
 *
 * Тестами це не ловиться: ціни фотокниг живуть у Supabase, а тести бази не
 * бачать. Тому перевірка стоїть там, куди CLAUDE.md велить заходити після
 * будь-якої зміни цін, — у /api/admin/pricing/audit. Сама функція чиста,
 * приймає рядки таблиці й нічого не знає про базу, тож її тримають тести.
 */

/** Пари розмірів, які є одним виробом у різній орієнтації. */
export const ROTATED_SIZE_PAIRS: Array<[string, string]> = [
    ['20x30', '30x20'],
];

export type PhotobookPriceRow = {
    size: string;
    cover: string;
    page_count: number | string;
    base_price: number | string;
};

export type RotatedSizeMismatch = {
    cover: string;
    pages: number;
    /** Розмір, узятий за орієнтир (перший у парі). */
    sizeA: string;
    priceA: number;
    sizeB: string;
    priceB: number;
    /** На скільки B дешевший за A. Відʼємне — дорожчий. */
    diff: number;
};

/** '20×30 см' → '20x30'. Кирилична × і латинська x — те саме. */
export function normalizeSize(size: string): string {
    return String(size ?? '')
        .trim()
        .toLowerCase()
        .replace(/[×хx]/g, 'x')
        .replace(/\s|см|cm/g, '');
}

const num = (v: unknown): number | null => {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
    return Number.isFinite(n) ? n : null;
};

/**
 * Кожен тариф, де повернутий боком розмір коштує не стільки ж.
 *
 * Тарифи, яких немає з одного боку пари, НЕ повідомляються: відсутній рядок —
 * це інша хвороба (її лікує міграція про мінімальну кількість розворотів), і
 * змішувати їх в одному звіті означало б ховати справжні розбіжності в цін
 * серед шуму. Тут ідеться рівно про ті пари, де обидві ціни є й вони різні.
 */
export function auditRotatedSizes(rows: PhotobookPriceRow[]): RotatedSizeMismatch[] {
    const byKey = new Map<string, number>();
    for (const r of rows) {
        const price = num(r.base_price);
        const pages = num(r.page_count);
        if (price === null || pages === null) continue;
        byKey.set(`${normalizeSize(r.size)}|${String(r.cover).trim()}|${pages}`, price);
    }

    const out: RotatedSizeMismatch[] = [];
    for (const [rawA, rawB] of ROTATED_SIZE_PAIRS) {
        const a = normalizeSize(rawA);
        const b = normalizeSize(rawB);
        for (const [key, priceA] of byKey) {
            const [size, cover, pagesText] = key.split('|');
            if (size !== a) continue;
            const priceB = byKey.get(`${b}|${cover}|${pagesText}`);
            if (priceB === undefined || priceB === priceA) continue;
            out.push({
                cover,
                pages: Number(pagesText),
                sizeA: rawA,
                priceA,
                sizeB: rawB,
                priceB,
                diff: priceA - priceB,
            });
        }
    }
    // Найбільша розбіжність згори — з неї починають розбиратися.
    return out.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff) || x.pages - y.pages);
}

/** Український опис для звіту аудиту. */
export function describeRotatedSizes(mismatches: RotatedSizeMismatch[]): string[] {
    return mismatches.map(m =>
        `${m.cover}, ${m.pages} стор.: ${m.sizeA} коштує ${m.priceA} ₴, а ${m.sizeB} — ${m.priceB} ₴. `
        + `Це той самий виріб боком, різниці бути не може (${m.diff > 0 ? '+' : ''}${m.diff} ₴).`
    );
}
