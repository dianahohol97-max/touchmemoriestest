import { escapeHtml } from '@/lib/email/escape';
import { formatBytes } from './plans';
import { kyivDateParts } from './notice-rules';

/**
 * Тексти трьох листів фотографу про галереї. Лише складання HTML — хто і коли
 * шле, у lib/photographers/notices.ts. Обгортка та сама, що в листі про
 * створення кабінету (app/api/photographers/register), щоб фотограф бачив
 * листи одного відправника.
 *
 * Правила тексту від Діани: українською, без маркованих списків, без речень
 * з одного-двох слів, спокійний тон, без слова «успішно».
 *
 * Умов продовження тарифом тут свідомо немає: код і тарифи в цьому місці
 * зараз розходяться, і обіцянка в листі закріпила б одну зі сторін раніше,
 * ніж це вирішено.
 */

export interface NoticeEmail {
    subject: string;
    html: string;
}

export function siteUrl(): string {
    return (process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua').replace(/\/$/, '');
}

export function cabinetUrl(cabinetToken: string): string {
    return `${siteUrl()}/uk/photographer/cabinet/${cabinetToken}`;
}

export function plansUrl(): string {
    return `${siteUrl()}/uk/photographers#tarify`;
}

const P = 'font-size:15px;line-height:1.7;color:#475569;margin:0 0 14px';
const NOTE = 'font-size:13px;color:#94a3b8;margin:14px 0 0';

/**
 * Звертання без імені (Діана, 2026-09-24): кличного відмінка автоматично не
 * зробимо, а «Доброго дня, Ірина Владова!» звучить як від робота.
 */
function layout(paragraphs: string[], button: { href: string; label: string }, note?: string): string {
    return `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
              <div style="background:#263A99;padding:24px 28px;text-align:center"><span style="color:#fff;font-size:20px;font-weight:900;letter-spacing:.1em">TOUCH.MEMORIES</span></div>
              <div style="padding:32px 28px;background:#fff;border:1px solid #e2e8f0">
                <h2 style="color:#1e2d7d;font-size:22px;margin:0 0 12px">Доброго дня!</h2>
                ${paragraphs.map(p => `<p style="${P}">${p}</p>`).join('\n                ')}
                <p style="margin:18px 0 0"><a href="${button.href}" style="background:#1e2d7d;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">${button.label}</a></p>
                ${note ? `<p style="${NOTE}">${note}</p>` : ''}
              </div>
            </div>`;
}

/**
 * Розмір для прози: «3,4 ГБ», «4 ГБ». Зайняте і квота йдуть через ОДНУ
 * функцію, formatBytes, яка ділить на 1024³, як і квота в plans.ts і лічильник
 * у кабінеті. Змішати десяткові гігабайти з квотою в ГіБ означало б показати
 * 85% як 90%.
 */
const size = (bytes: number) => formatBytes(bytes).replace('.0 ', ' ').replace('.', ',');

const CABINET_NOTE = 'Посилання на кабінет особисте, тому не передавайте його стороннім.';

export function expiryNoticeEmail(input: {
    galleryTitle: string;
    expiresAt: string;
    cabinetToken: string;
}): NoticeEmail {
    const { date, time } = kyivDateParts(input.expiresAt);
    const title = escapeHtml(input.galleryTitle);
    return {
        subject: `Галерея «${input.galleryTitle}» зберігається до ${date}`,
        html: layout([
            `Галерея «${title}» зберігається до ${date}, ${time} за київським часом. Після цього її фото й відео буде видалено зі сховища, а клієнтське посилання показуватиме сторінку про завершення терміну.`,
            'Якщо клієнтам ще потрібен доступ до знімків, термін зберігання можна продовжити в кабінеті, на картці цієї галереї. Радимо також переконатися, що клієнти вже завантажили собі все потрібне.',
        ], { href: cabinetUrl(input.cabinetToken), label: 'Відкрити кабінет' }, CABINET_NOTE),
    };
}

export function storageNoticeEmail(input: {
    usedBytes: number;
    limitBytes: number;
    planName: string;
    limitOverridden?: boolean;
}): NoticeEmail {
    const where = input.limitOverridden
        ? 'доступних для вашого кабінету'
        : `доступних на тарифі «${escapeHtml(input.planName)}»`;
    return {
        subject: 'Місце для ваших галерей майже заповнене',
        html: layout([
            `Ваші галереї зараз займають ${size(input.usedBytes)} із ${size(input.limitBytes)}, ${where}. Коли місце закінчиться, нові фото й відео завантажити не вийде, а наявні галереї працюватимуть як і раніше до кінця свого терміну.`,
            'Звільнити місце можна в кабінеті, видаливши галереї чи файли, які вже не потрібні. Якщо попереду багато зйомок, варто переглянути тарифи з більшим обсягом.',
        ], { href: plansUrl(), label: 'Переглянути тарифи' }),
    };
}

export function purgeNoticeEmail(input: {
    galleryTitle: string;
    purgedAt: string;
    cabinetToken: string;
}): NoticeEmail {
    const { date } = kyivDateParts(input.purgedAt);
    const title = escapeHtml(input.galleryTitle);
    return {
        subject: `Файли галереї «${input.galleryTitle}» видалено`,
        html: layout([
            `Термін зберігання галереї «${title}» завершився, тому ${date} її фото й відео видалено зі сховища. Відновити ці файли вже неможливо.`,
            'Клієнтське посилання на галерею тепер показує сторінку про завершення терміну з вашими контактами. Місце, яке займала галерея, знову вільне для нових зйомок.',
        ], { href: cabinetUrl(input.cabinetToken), label: 'Відкрити кабінет' }, CABINET_NOTE),
    };
}
