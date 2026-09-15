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

import { phoneKey } from '@/lib/automation/keycrm';

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
    delivered_at?: string | null;
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
    /**
     * Днів безкоштовного зберігання на відділенні.
     *
     * Стандартні п'ять днів Нової Пошти. Менеджерці потрібне не саме «чекає», а
     * скільки лишилося до того, як почнуть рахувати гроші — тому в рядку стоїть
     * дата прибуття й дата, після якої зберігання стає платним.
     */
    freeStorageDays: 5,
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

/** Дата як «12.09» — рік у зведенні тільки заважає. */
function shortDate(iso: string): string {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '';
    return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Підпис посилки для зведення: що з нею і скільки це триває.
 *
 * Для посилки на відділенні додаємо дату прибуття й дату, після якої
 * зберігання стає платним: менеджерці треба бачити, скільки лишилося часу, а
 * не тільки те, що посилка чекає (Діана, 15.09.2026).
 */
export function stuckLabel(parcel: StuckParcel): string {
    const status = String(parcel.row.tracking_status || '').trim() || 'статус невідомий';
    const parts = [status];

    if (AT_BRANCH_STATUSES.includes(status) && parcel.row.tracking_status_at) {
        const arrived = new Date(parcel.row.tracking_status_at);
        parts.push(`прибула ${shortDate(parcel.row.tracking_status_at)}`);
        const freeUntil = new Date(arrived.getTime() + STUCK_THRESHOLDS.freeStorageDays * 24 * 60 * 60 * 1000);
        const daysLeft = STUCK_THRESHOLDS.freeStorageDays - (parcel.days ?? 0);
        parts.push(daysLeft > 0
            ? `безкоштовно до ${shortDate(freeUntil.toISOString())}, лишилось ${daysLeft} дн.`
            : `зберігання вже платне з ${shortDate(freeUntil.toISOString())}`);
    } else if (parcel.days !== null) {
        parts.push(parcel.days === 0 ? 'сьогодні' : `${parcel.days} дн.`);
    }

    if (parcel.row.ttn) parts.push(`ТТН ${parcel.row.ttn}`);
    return parts.join(', ');
}

/**
 * Посилка, яка виглядає застряглою, а насправді поїхала разом з іншою.
 *
 * ЗВІДКИ ЦЕ ВЗЯЛОСЯ. Кілька замовлень одного клієнта складають в одну коробку й
 * виписують на них ОДНУ накладну. Її отримує лише одне замовлення з групи;
 * решта лишаються зі своїми старими накладними, які після цього ніхто не
 * використовує. Нова Пошта їх або видаляє, або вони вічно висять у статусі
 * «Нове» — і для сайту такі замовлення назавжди неотримані, хоча клієнт давно
 * все забрав.
 *
 * Живий приклад: 09.09.2026 у робочому чаті «13410+13463+13683+13969 треба
 * накладну». Спільна накладна лягла на CRM-13410, воно доставлене 15.09, а
 * CRM-13683 і CRM-13969 досі стоять із мертвими серпневими номерами.
 *
 * ЯК УПІЗНАЄМО. Ознака непряма, тому й називається «ймовірно»: той самий
 * клієнт має ІНШЕ замовлення, посилку якого вручено вже ПІСЛЯ того, як
 * застрягла накладна востаннє змінила статус. Це здогад, який економить
 * менеджерці дзвінок, а не факт — тому такі рядки стоять окремим блоком зі
 * словом «ймовірно», а не ховаються зі зведення.
 */
export interface DeliveredSibling {
    order_number: string | null;
    customer_phone?: string | null;
    ttn: string | null;
    delivered_at?: string | null;
}

export function likelyMergedWith(parcel: StuckParcel, delivered: DeliveredSibling[] | null | undefined): DeliveredSibling | null {
    const key = phoneKey(String(parcel.row.customer_phone || ''));
    if (!key) return null;

    // Відлік від моменту, коли застрягла накладна востаннє ворухнулася; якщо
    // позначки ще немає — від дати замовлення.
    const since = new Date(parcel.row.tracking_status_at || parcel.row.created_at).getTime();
    if (!Number.isFinite(since)) return null;

    for (const sibling of delivered || []) {
        if (!sibling?.delivered_at) continue;
        if (sibling.order_number === parcel.row.order_number) continue;
        if (phoneKey(String(sibling.customer_phone || '')) !== key) continue;
        if (sibling.ttn && parcel.row.ttn && sibling.ttn === parcel.row.ttn) continue;
        const when = new Date(sibling.delivered_at).getTime();
        if (Number.isFinite(when) && when >= since) return sibling;
    }
    return null;
}

/**
 * Ділить список на справді застряглі й ті, що ймовірно поїхали разом з іншим
 * замовленням. Порядок усередині кожного списку зберігається.
 */
export function splitLikelyMerged(
    parcels: StuckParcel[],
    delivered: DeliveredSibling[] | null | undefined,
): { stuck: StuckParcel[]; merged: Array<StuckParcel & { sibling: DeliveredSibling }> } {
    const stuck: StuckParcel[] = [];
    const merged: Array<StuckParcel & { sibling: DeliveredSibling }> = [];
    for (const p of parcels) {
        const sibling = likelyMergedWith(p, delivered);
        if (sibling) merged.push({ ...p, sibling });
        else stuck.push(p);
    }
    return { stuck, merged };
}
