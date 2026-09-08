/**
 * Одна позиція сайту — кілька рядків у CRM.
 *
 * Глянцевий журнал приїжджає в CRM однією позицією на 1533 ₴, а з чого вона
 * складається — видно лише в коментарі дрібним текстом: база 875, терміновість
 * 263, пакет тексту 395. Менеджер не може ні побачити на картці, скільки в
 * замовленні саме послуг, ні порахувати їх за місяць: для CRM це один товар
 * «Глянцевий журнал» на всю суму (Діана, 08.09.2026 — «а не можна зробити так,
 * що в crm йшло різними товарами? 1 — журнал, 2 — текст, 3 — терміновість»).
 *
 * Розбивка вже є в `price_breakdown` кожної позиції, тож вигадувати нічого не
 * треба — досить перекласти її в окремі рядки.
 *
 * ЗАПОБІЖНИК, І ЧОМУ ВІН ГОЛОВНИЙ. Сума рядків у CRM мусить збігатися з тим,
 * що клієнт заплатив, інакше замовлення розходиться з оплатою і це помітять
 * уже у звірці. Тому розбиваємо ЛИШЕ тоді, коли розбивка сходиться до ціни за
 * одиницю точно. Не сходиться — віддаємо одну позицію, як і раніше: гірше
 * показати менше, ніж показати неправду про гроші.
 */

export type CrmLineKind = 'base' | 'rush' | 'text' | 'extra';

export interface CrmLine {
    /** Назва рядка в CRM. */
    name: string;
    /** Ціна за одиницю. */
    amount: number;
    kind: CrmLineKind;
    /**
     * Стабільний артикул для сервісних рядків, щоб їх можна було завести в
     * номенклатурі CRM і рахувати окремо. Для базового рядка null — він
     * лишається привʼязаним до справжнього товару.
     */
    sku: string | null;
    /** Початковий підпис із розбивки — їде в коментар рядка. */
    sourceLabel: string;
}

/** Назви сервісних рядків: короткі, бо CRM показує їх у вузькій колонці. */
const RUSH_NAME = 'Терміновість';
const TEXT_NAME = 'Написання тексту';

function classify(label: string, index: number): CrmLineKind {
    const l = label.toLowerCase();
    if (/термінов|швидше|urgent|rush/.test(l)) return 'rush';
    if (/текст|стат|копірайт/.test(l)) return 'text';
    if (index === 0 || /базов|основн|вартість \(/.test(l)) return 'base';
    return 'extra';
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Розкладає позицію на рядки CRM або повертає null, якщо розбивати не можна.
 *
 * null означає «лишити як було» — виклик має відправити одну позицію.
 */
export function splitLineByBreakdown(item: any): CrmLine[] | null {
    const rows = Array.isArray(item?.price_breakdown) ? item.price_breakdown : [];
    if (rows.length < 2) return null;

    const parsed = rows
        .map((r: any, i: number) => {
            const label = String(r?.label ?? '').trim();
            const amount = Number(r?.amount);
            return { label, amount, index: i };
        })
        .filter((r: any) => r.label && Number.isFinite(r.amount));

    if (parsed.length !== rows.length) return null;
    // Від'ємний рядок — це знижка, а не окрема послуга: віддавати її в CRM
    // окремим товаром із мінусовою ціною означало б зламати їхні звіти.
    if (parsed.some((r: any) => r.amount < 0)) return null;

    const unit = Number(item?.unit_price);
    if (!Number.isFinite(unit)) return null;

    const sum = round2(parsed.reduce((s: number, r: any) => s + r.amount, 0));
    if (sum !== round2(unit)) return null;

    // Рядки з нульовою ціною не показуємо: вони нічого не додають ні до суми,
    // ні до розуміння, а картку захаращують.
    const useful = parsed.filter((r: any) => r.amount > 0);
    if (useful.length < 2) return null;

    return useful.map((r: any) => {
        const kind = classify(r.label, r.index);
        if (kind === 'rush') return { name: RUSH_NAME, amount: r.amount, kind, sku: 'service-urgent', sourceLabel: r.label };
        if (kind === 'text') return { name: TEXT_NAME, amount: r.amount, kind, sku: 'service-text', sourceLabel: r.label };
        if (kind === 'base') {
            return {
                name: String(item?.product_name || 'Товар'),
                amount: r.amount,
                kind,
                sku: null,
                sourceLabel: r.label,
            };
        }
        return { name: r.label, amount: r.amount, kind, sku: null, sourceLabel: r.label };
    });
}
