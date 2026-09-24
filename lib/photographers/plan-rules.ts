import { effectivePlanId, type PlanId } from './plans';
import { EXTEND_DAY_OPTIONS } from './gallery-term';

/**
 * Що дозволяє тариф фотографа в галереях (Diana, 2026-09-24). Чисті функції,
 * без бази, щоб маршрути, кабінет, лист «галерея скоро згасне» і тести
 * (tests/photographer-plan-rules.test.ts) читали ОДНЕ правило, а не кожен свою
 * копію.
 *
 *   – Безкоштовний тариф: галерея живе 30 днів і не продовжується. Відео не
 *     завантажуються, фото вантажаться як і раніше.
 *   – Платні тарифи: термін 30, 60 або 90 днів на вибір, продовження є,
 *     відео є.
 *
 * Тариф береться «чинний» (effectivePlanId): оплачений тариф, строк якого
 * минув, рахується безкоштовним. Тобто галерею, створену на 90 днів у
 * платному місяці, після його кінця вже не продовжиш, але свої 90 днів вона
 * доживе.
 *
 * СТАРІ ГАЛЕРЕЇ ЖИВУТЬ ЗА СТАРИМИ ПРАВИЛАМИ. Заборона продовження діє лише
 * для галерей, створених не раніше за PLAN_RULES_FROM. Галерея Ірини Владової
 * (06.09.2026, лист їй піде 03.10) і всі інші, що вже були на момент рішення,
 * продовжуються на безкоштовному тарифі так само, як до нього.
 *
 * Чому межа — мітка часу в коді, а не окрема колонка. Колонка вимагала б
 * міграції, а цю зміну свідомо зроблено без змін у базі. created_at є в кожної
 * галереї й ніколи не змінюється, тож «створена до межі» — стійка ознака, яку
 * не зіб'є ні продовження, ні зміна тарифу. Межа стоїть на момент коміту, тобто
 * трохи раніше за деплой: галерея, яку хтось створив старим кодом між комітом
 * і деплоєм, піде за новими правилами, тобто лише не продовжиться на
 * безкоштовному тарифі, а свій термін збереже. Перед пушем це перевірено
 * запитом до бази, щоб такої галереї в реального фотографа не було.
 */

/** Межа нових правил: галереї, створені з цієї миті, живуть за ними. */
export const PLAN_RULES_FROM = '2026-09-24T13:45:00.000Z';

/** Термін галереї на безкоштовному тарифі, днів. */
export const FREE_TERM_DAYS = 30;

type PlanSubject = { plan?: string | null; plan_expires_at?: string | null };

/** Чинний тариф фотографа — той самий розрахунок, що й для квоти. */
export function planOf(photographer: PlanSubject): PlanId {
    return effectivePlanId(photographer);
}

/** Галерея створена вже за новими правилами? Невідома дата — теж так: суворіше правило безпечніше за вічне продовження. */
export function isUnderPlanRules(createdAt: string | null | undefined): boolean {
    const t = createdAt ? new Date(createdAt).getTime() : NaN;
    if (!Number.isFinite(t)) return true;
    return t >= new Date(PLAN_RULES_FROM).getTime();
}

/** Які терміни можна обрати при створенні галереї. */
export function termOptionsFor(planId: PlanId): readonly number[] {
    return planId === 'free' ? [FREE_TERM_DAYS] : EXTEND_DAY_OPTIONS;
}

/** Чи можна продовжити цю галерею. */
export function canExtendGallery(planId: PlanId, galleryCreatedAt: string | null | undefined): boolean {
    if (planId !== 'free') return true;
    return !isUnderPlanRules(galleryCreatedAt);
}

/** Чи можна вантажити відео. Уже завантажені відео лишаються за будь-якого тарифу. */
export function canUploadVideo(planId: PlanId): boolean {
    return planId !== 'free';
}

/**
 * Розширення відеофайлів. Тип файлу, який назвав браузер, перевіряється
 * окремо; розширення потрібне, бо тип подає сам клієнт, і відео з типом
 * `image/jpeg` інакше пройшло б як фото.
 */
const VIDEO_EXTENSIONS = new Set([
    'mp4', 'm4v', 'mov', 'qt', 'webm', 'mkv', 'avi', 'wmv', 'flv', 'f4v',
    '3gp', '3g2', 'mts', 'm2ts', 'ts', 'mpg', 'mpeg', 'mpe', 'ogv', 'mxf', 'vob', 'hevc',
]);

/** Відео за типом АБО за розширенням: досить однієї ознаки. */
export function isVideoFile(file: { contentType?: string | null; fileName?: string | null }): boolean {
    const type = String(file.contentType || '').toLowerCase().trim();
    if (type.startsWith('video/')) return true;
    const name = String(file.fileName || '').toLowerCase().trim();
    const dot = name.lastIndexOf('.');
    if (dot < 0) return false;
    return VIDEO_EXTENSIONS.has(name.slice(dot + 1));
}

/** Який варіант листа «галерея скоро згасне» казатиме правду про цю галерею. */
export type ExpiryLetterVariant = 'extend' | 'upgrade';

export function expiryLetterVariant(planId: PlanId, galleryCreatedAt: string | null | undefined): ExpiryLetterVariant {
    return canExtendGallery(planId, galleryCreatedAt) ? 'extend' : 'upgrade';
}

// ─── Тексти відмов ────────────────────────────────────────────────────────
// Кабінет показує їх дослівно, тож вони написані для людини.

export const FREE_TERM_REFUSAL =
    'На безкоштовному тарифі галерея зберігається 30 днів. Термін 60 чи 90 днів доступний на платних тарифах, обрати їх можна в кабінеті, у розділі «Місце для галерей».';

export const FREE_EXTEND_REFUSAL =
    'На безкоштовному тарифі галерея зберігається 30 днів без продовження. Щоб зберігати галереї довше, оберіть платний тариф у кабінеті, у розділі «Місце для галерей».';

export function videoRefusal(fileName: string): string {
    return `Файл «${fileName}» не завантажено, бо відео в галереї доступні від тарифу «Старт». Фото на безкоштовному тарифі завантажуються як і раніше.`;
}
