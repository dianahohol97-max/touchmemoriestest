/**
 * Посилки, які застрягли дорогою до клієнта.
 *
 * НАВІЩО. До 15.09.2026 сайт не знав про посилки нічого: крон відстеження
 * падав із 500, і в 837 замовлень із накладною не було жодного статусу. Щойно
 * статуси з'явилися, стало видно те, чого ніхто не бачив роками — сімнадцять
 * видалених накладних, три відмови від одержання і посилки, що тижнями лежать
 * на відділенні. Кожна з них це або гроші назад, або клієнт, який не отримав
 * замовлення й мовчить.
 *
 * ПРО ВІК. Скільки посилка стоїть у своєму статусі, видно з
 * `tracking_status_at` — часу ОСТАННЬОЇ ЗМІНИ статусу, який пише крон
 * відстеження. Дата замовлення тут не годиться: замовлення з третього липня
 * могло приїхати на відділення вчора, і назвати його «застряглим на 74 дні»
 * означало б збрехати менеджеру. Тому рядки без цієї позначки у вікові кошики
 * не потрапляють зовсім — перший день після впровадження зведення недорахує,
 * а не перебільшить. З наступного прогону крона позначка є в усіх.
 */

export type ParcelRow = {
    id: string;
    order_number: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    ttn: string | null;
    tracking_status: string | null;
    tracking_status_at?: string | null;
    created_at: string;
    order_status: string | null;
};

/**
 * Пороги.
 *
 * Відділення — три дні. Нова Пошта тримає посилку безкоштовно п'ять днів, далі
 * рахує зберігання, а через сім відправляє назад. Три дні лишають два дні на
 * дзвінок клієнту, поки це ще нічого не коштує. На даних 15.09.2026 під цей
 * поріг підпадали 36 посилок із 44, що лежали на відділенні, — тобто поріг
 * відсікає саме щойно прибулі, а не половину черги.
 *
 * Накладна без руху — тиждень. Зі 135 накладних у статусі «Нове» 82 створені
 * за останні сім днів: це нормальна поточна черга, її чіпати не треба.
 * Лишається 53, і серед них є накладна від третього липня.
 */
export const STUCK_THRESHOLDS = {
    /** Днів на відділенні, після яких посилку треба нагадати клієнту. */
    atBranchDays: 3,
    /** Днів у статусі «Нове», після яких накладна виглядає забутою. */
    waybillNewDays: 7,
};

/** Статуси, які самі по собі означають проблему, хоч би скільки їм було днів. */
const PROBLEM_STATUSES = ['Вилучено', 'Відмова від одержання', 'Відмова від одержання (повернення)'];
/** Посилка доїхала й чекає клієнта. */
const AT_BRANCH_STATUSES = ['Прибув на відділення', 'Прибув на відділення (одержувач)'];
/** Накладна створена, але посилку у відділення ще не передали. */
const NEW_WAYBILL_STATUS = 'Нове';

const CLOSED_ORDER_STATUSES = ['delivered', 'cancelled', 'refunded'];

export interface StuckParcel {
    row: ParcelRow;
    /** Днів у поточному статусі; null, коли час зміни статусу ще не записаний. */
    days: number | null;
}

export interface StuckParcels {
    /** Видалені накладні та відмови від одержання. */
    problem: StuckParcel[];
    /** Лежить на відділенні довше за поріг. */
    atBranch: StuckParcel[];
    /** Накладна створена, але посилку не передали. */
    notHandedOver: StuckParcel[];
}

function daysInStatus(row: ParcelRow, now: Date): number | null {
    const stamp = row.tracking_status_at;
    if (!stamp) return null;
    const ms = now.getTime() - new Date(stamp).getTime();
    if (!Number.isFinite(ms)) return null;
    return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export function stuckParcels(rows: ParcelRow[] | null | undefined, now: Date): StuckParcels {
    const out: StuckParcels = { problem: [], atBranch: [], notHandedOver: [] };

    for (const row of rows || []) {
        if (!row?.ttn) continue;
        if (CLOSED_ORDER_STATUSES.includes(String(row.order_status || ''))) continue;

        const status = String(row.tracking_status || '').trim();
        if (!status) continue;
        const days = daysInStatus(row, now);

        if (PROBLEM_STATUSES.includes(status)) {
            out.problem.push({ row, days });
            continue;
        }
        // Вікові кошики мовчать, поки час зміни статусу невідомий — краще
        // недорахувати в перший день, ніж назвати вік замовлення віком посилки.
        if (days === null) continue;

        if (AT_BRANCH_STATUSES.includes(status) && days >= STUCK_THRESHOLDS.atBranchDays) {
            out.atBranch.push({ row, days });
        } else if (status === NEW_WAYBILL_STATUS && days >= STUCK_THRESHOLDS.waybillNewDays) {
            out.notHandedOver.push({ row, days });
        }
    }

    const byAge = (a: StuckParcel, b: StuckParcel) => (b.days ?? 0) - (a.days ?? 0);
    out.problem.sort(byAge);
    out.atBranch.sort(byAge);
    out.notHandedOver.sort(byAge);
    return out;
}

/** Підпис посилки для зведення: що з нею і скільки це триває. */
export function stuckLabel(parcel: StuckParcel): string {
    const parts = [String(parcel.row.tracking_status || '').trim() || 'статус невідомий'];
    if (parcel.days !== null) {
        parts.push(parcel.days === 0 ? 'сьогодні' : `${parcel.days} дн.`);
    }
    if (parcel.row.ttn) parts.push(`ТТН ${parcel.row.ttn}`);
    return parts.join(', ');
}
