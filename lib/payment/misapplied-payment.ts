/**
 * Платіж, який не збігається із сумою замовлення.
 *
 * ЧОМУ ЦЕ ІСНУЄ. Вебхук Monobank звіряє суму платежу з поточною сумою
 * замовлення і донедавна на розбіжності відповідав 400. Виглядало як захист, а
 * працювало як тиха втрата: банк списав гроші, ми відмовилися їх записати,
 * Monobank повторював вебхук і щоразу отримував ту саму відмову, а в базі не
 * лишалося ні рядка. Менеджер бачив неоплачене замовлення, клієнт — списання.
 *
 * Розбіжність суми не потребує ні кнопки, ні нового коду, щоб статися: досить,
 * щоб суму замовлення змінили після виставлення рахунку. Менеджери правлять
 * замовлення щодня, а посилання на оплату живе добу.
 *
 * Гроші, які прийшли, треба записати — навіть коли вони прийшли «не так».
 * Тому розбіжність тепер не відмова, а окремий стан: сума лягає в отримані
 * кошти, замовлення лишається неоплаченим, і про це кажуть уголос.
 *
 * Рішення відокремлене від маршруту навмисно: це єдине місце, де зважується
 * «збіглося чи ні», і воно має бути перевіреним тестами, а не захованим у
 * трьохсотрядковому обробнику.
 */

/** Допуск на заокруглення, копійки. */
const TOLERANCE_KOPECKS = 1;

export type PaymentVerdict =
    | { kind: 'match' }
    | {
        kind: 'misapplied';
        /** Старе посилання чи розбіжність суми на поточному рахунку. */
        reason: 'stale-invoice' | 'amount-mismatch';
        paidUah: number;
        expectedUah: number;
        /** Скільки ще бракує (додатна) або наскільки переплатили (відʼємна). */
        diffUah: number;
        /** Готовий рядок для історії замовлення і примітки менеджеру. */
        note: string;
    };

/** Сума гривень людською мовою: 1 953 ₴, 675,50 ₴. */
export function formatUah(value: number): string {
    const rounded = Math.round(value * 100) / 100;
    const whole = Math.trunc(Math.abs(rounded));
    const cents = Math.round((Math.abs(rounded) - whole) * 100);
    const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const sign = rounded < 0 ? '−' : '';
    return `${sign}${grouped}${cents ? `,${String(cents).padStart(2, '0')}` : ''} ₴`;
}

/**
 * Чи цей платіж — те, на що виставлявся рахунок.
 *
 * Сума вирішує, а не номер рахунку: менеджер міг перевиставити рахунок на ту
 * саму суму, і такий платіж нормальний, хоч invoiceId у ньому вже інший.
 * Номер рахунку потрібен лише для того, щоб назвати причину розбіжності
 * правильно — «заплатили за старим посиланням» звучить інакше, ніж «сума не
 * збігається», і менеджер шукатиме різні речі.
 */
export function classifyIncomingPayment(input: {
    invoiceId: string;
    currentInvoiceId?: string | null;
    paidKopecks: number;
    expectedUah: number;
}): PaymentVerdict {
    const expectedKopecks = Math.round(input.expectedUah * 100);

    if (Math.abs(input.paidKopecks - expectedKopecks) <= TOLERANCE_KOPECKS) {
        return { kind: 'match' };
    }

    const paidUah = Math.round(input.paidKopecks) / 100;
    const expectedUah = Math.round(expectedKopecks) / 100;
    const diffUah = Math.round((expectedUah - paidUah) * 100) / 100;

    const current = String(input.currentInvoiceId || '').trim();
    const reason: 'stale-invoice' | 'amount-mismatch' =
        current && current !== String(input.invoiceId || '').trim() ? 'stale-invoice' : 'amount-mismatch';

    const head = reason === 'stale-invoice'
        ? 'Оплата за старим посиланням'
        : 'Оплата не збігається з сумою замовлення';
    const tail = diffUah > 0
        ? `різниця ${formatUah(diffUah)} — доплата`
        : `різниця ${formatUah(Math.abs(diffUah))} — переплата`;

    return {
        kind: 'misapplied',
        reason,
        paidUah,
        expectedUah,
        diffUah,
        note: `⚠️ ${head}: ${formatUah(paidUah)}, замовлення на ${formatUah(expectedUah)}, ${tail}. Гроші отримані, замовлення НЕ позначене оплаченим.`,
    };
}
