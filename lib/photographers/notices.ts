import type { SendOutcome } from '@/lib/email/log-outgoing';
import {
    shouldSendExpiryNotice, expiryNoticeHorizon,
    shouldSendPurgeNotice, PURGE_NOTICE_WINDOW_MS,
    storageNoticeAction, canEmailPhotographer,
} from './notice-rules';
import { expiryNoticeEmail, purgeNoticeEmail, storageNoticeEmail } from './notice-emails';

/**
 * Листи фотографу про галереї: хто, коли і з якою позначкою в базі.
 * Правила «слати чи ні» — у ./notice-rules (чисті, з тестами), тексти — у
 * ./notice-emails.
 *
 * Три незмінні речі для всіх трьох листів:
 *   – відправка тільки через sendLoggedEmail (гоча 20), тож і відмова лишає
 *     рядок у email_logs;
 *   – позначка «надіслано» ставиться ТІЛЬКИ після успіху: відмова Brevo не має
 *     назавжди закрити фотографу попередження;
 *   – жодна помилка звідси не виходить назовні. Лист — супровід, а не частина
 *     аплоаду чи очищення, і ламати їх він не має права.
 *
 * Залежності передаються ззовні, щоб тести ганяли це на фейковому PostgREST
 * (tests/photographer-notices.test.ts), а модуль не тягнув за собою ні
 * адмін-клієнта, ні Brevo.
 */

export type SendFn = (
    params: { to: string; toName?: string; subject: string; html: string },
    meta: { template: string },
) => Promise<SendOutcome>;

export interface NoticeDeps {
    db: any;
    send: SendFn;
    now?: () => Date;
    log?: (message: string, context: Record<string, unknown>) => void;
}

export const NOTICE_TEMPLATES = {
    expiry: 'photographer_gallery_expiring',
    storage: 'photographer_storage_90',
    purge: 'photographer_gallery_purged',
} as const;

export interface NoticeReport {
    candidates: number;
    sent: number;
    failed: number;
    /** Кандидати, яким лист не йде: демо-кабінет, вимкнений кабінет, немає пошти. */
    skipped: number;
}

type PhotographerRow = { id: string; name: string | null; email: string | null; is_active: boolean | null; cabinet_token: string };

const PAGE = 1000;
const MAX_PAGES = 10;

/** Усі рядки вибірки сторінками (гоча 14): мовчазна межа в тисячу тут не пройде. */
async function readPaged<T>(build: () => any): Promise<{ rows: T[]; error: string | null }> {
    const rows: T[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
        const { data, error } = await build().range(page * PAGE, page * PAGE + PAGE - 1);
        if (error) return { rows: [], error: error.message || String(error) };
        rows.push(...(data || []));
        if (!data || data.length < PAGE) return { rows, error: null };
    }
    return { rows: [], error: `вибірка перевищила ${MAX_PAGES} сторінок` };
}

async function readPhotographers(db: any, ids: string[]): Promise<Map<string, PhotographerRow>> {
    const map = new Map<string, PhotographerRow>();
    const unique = [...new Set(ids)];
    for (let i = 0; i < unique.length; i += 200) {
        const { data, error } = await db
            .from('photographers')
            .select('id, name, email, is_active, cabinet_token')
            .in('id', unique.slice(i, i + 200));
        if (error) throw new Error(error.message || String(error));
        for (const p of data || []) map.set(p.id, p);
    }
    return map;
}

async function trySend(deps: NoticeDeps, p: PhotographerRow, email: { subject: string; html: string }, template: string): Promise<boolean> {
    try {
        const outcome = await deps.send(
            { to: p.email!.trim(), toName: p.name || undefined, subject: email.subject, html: email.html },
            { template },
        );
        return !!outcome?.sent;
    } catch (e: any) {
        deps.log?.(`[${template}] send threw`, { photographer: p.id, error: e?.message || String(e) });
        return false;
    }
}

type ExpiryGallery = {
    id: string; photographer_id: string; title: string;
    expires_at: string; files_purged_at: string | null; expiry_notice_for: string | null;
};

/**
 * Лист «галерея скоро згасне». Кличе нічний крон cleanup-galleries ДО
 * очищення. Вікно запиту — галереї, що спливають до expiryNoticeHorizon;
 * чи слати, вирішує shouldSendExpiryNotice, і рядків там одиниці, тож
 * порівняння expiry_notice_for з expires_at у JS — не відсів після ліміту
 * (гоча 13): ліміту немає, читаються всі сторінки.
 */
export async function sendExpiryNotices(deps: NoticeDeps): Promise<NoticeReport> {
    const { db } = deps;
    const now = deps.now?.() ?? new Date();
    const report: NoticeReport = { candidates: 0, sent: 0, failed: 0, skipped: 0 };

    const { rows, error } = await readPaged<ExpiryGallery>(() => db
        .from('photographer_galleries')
        .select('id, photographer_id, title, expires_at, files_purged_at, expiry_notice_for')
        .is('files_purged_at', null)
        .gt('expires_at', now.toISOString())
        .lt('expires_at', expiryNoticeHorizon(now).toISOString())
        .order('expires_at', { ascending: true })
        .order('id', { ascending: true }));
    if (error) throw new Error(error);

    const due = rows.filter(g => shouldSendExpiryNotice(g, now));
    report.candidates = due.length;
    if (!due.length) return report;
    const photographers = await readPhotographers(db, due.map(g => g.photographer_id));

    for (const g of due) {
        const p = photographers.get(g.photographer_id);
        if (!canEmailPhotographer(p)) { report.skipped++; continue; }
        const ok = await trySend(deps, p!, expiryNoticeEmail({
            galleryTitle: g.title, expiresAt: g.expires_at, cabinetToken: p!.cabinet_token,
        }), NOTICE_TEMPLATES.expiry);
        if (!ok) { report.failed++; continue; }
        report.sent++;
        // Позначка — саме той термін, про який пішов лист. Якщо галерею щойно
        // продовжили, умова по expires_at не спрацює, і лист про новий термін
        // прийде вчасно.
        const { error: markErr } = await db
            .from('photographer_galleries')
            .update({ expiry_notice_for: g.expires_at, expiry_notice_sent_at: now.toISOString() })
            .eq('id', g.id)
            .eq('expires_at', g.expires_at);
        if (markErr) deps.log?.('[photographer_gallery_expiring] mark failed', { gallery: g.id, error: markErr.message });
    }
    return report;
}

type PurgedGallery = { id: string; photographer_id: string; title: string; files_purged_at: string | null; purge_notice_sent_at: string | null };

/**
 * Лист «файли галереї видалено». Кличе той самий крон ПІСЛЯ очищення.
 * Кандидат — лише галерея, якій gallery-cleanup уже поставив files_purged_at,
 * тобто сховище підтвердило, що файлів немає. Невдалий лист дошлеться
 * наступної ночі в межах PURGE_NOTICE_WINDOW_MS.
 */
export async function sendPurgeNotices(deps: NoticeDeps): Promise<NoticeReport> {
    const { db } = deps;
    const now = deps.now?.() ?? new Date();
    const report: NoticeReport = { candidates: 0, sent: 0, failed: 0, skipped: 0 };

    const { rows, error } = await readPaged<PurgedGallery>(() => db
        .from('photographer_galleries')
        .select('id, photographer_id, title, files_purged_at, purge_notice_sent_at')
        .not('files_purged_at', 'is', null)
        .gte('files_purged_at', new Date(now.getTime() - PURGE_NOTICE_WINDOW_MS).toISOString())
        .is('purge_notice_sent_at', null)
        .order('files_purged_at', { ascending: true })
        .order('id', { ascending: true }));
    if (error) throw new Error(error);

    const due = rows.filter(g => shouldSendPurgeNotice(g, now));
    report.candidates = due.length;
    if (!due.length) return report;
    const photographers = await readPhotographers(db, due.map(g => g.photographer_id));

    for (const g of due) {
        const p = photographers.get(g.photographer_id);
        if (!canEmailPhotographer(p)) { report.skipped++; continue; }
        const ok = await trySend(deps, p!, purgeNoticeEmail({
            galleryTitle: g.title, purgedAt: g.files_purged_at!, cabinetToken: p!.cabinet_token,
        }), NOTICE_TEMPLATES.purge);
        if (!ok) { report.failed++; continue; }
        report.sent++;
        const { error: markErr } = await db
            .from('photographer_galleries')
            .update({ purge_notice_sent_at: now.toISOString() })
            .eq('id', g.id)
            .is('purge_notice_sent_at', null);
        if (markErr) deps.log?.('[photographer_gallery_purged] mark failed', { gallery: g.id, error: markErr.message });
    }
    return report;
}

/** Бронь на відправку листа про місце старша за це — покинута (процес упав). */
export const STORAGE_NOTICE_LEASE_MS = 5 * 60_000;

export interface StorageUsageLike {
    usedBytes: number;
    limitBytes: number;
    planName: string;
    limitOverridden?: boolean;
}

export type StorageNoticeResult = 'sent' | 'failed' | 'rearmed' | 'none' | 'busy' | 'skipped';

/**
 * Лист «місце закінчується» після аплоаду. `uploadedBytes` — скільки додав
 * саме цей запит: з нього рахується частка ДО аплоаду (див.
 * storageNoticeAction).
 *
 * Паралельні confirm одного фотографа бачили б «ще не надіслано» одночасно,
 * тому перед відправкою ставиться бронь storage_notice_pending_at умовним
 * оновленням: хто не отримав рядок назад, не шле. Позначка sent ставиться
 * тільки після успіху, бронь знімається в будь-якому разі.
 */
export async function handleStorageNotice(deps: NoticeDeps & {
    photographerId: string;
    usage: StorageUsageLike;
    uploadedBytes: number;
}): Promise<StorageNoticeResult> {
    const { db, usage } = deps;
    const now = deps.now?.() ?? new Date();

    const { data: p, error } = await db
        .from('photographers')
        .select('id, name, email, is_active, cabinet_token, storage_notice_sent_at')
        .eq('id', deps.photographerId)
        .maybeSingle();
    if (error || !p) return 'none';

    const limit = usage.limitBytes;
    const ratio = (bytes: number) => (limit > 0 ? Math.max(0, bytes) / limit : 0);
    const action = storageNoticeAction({
        ratioBefore: ratio(usage.usedBytes - deps.uploadedBytes),
        ratioAfter: ratio(usage.usedBytes),
        sentAt: p.storage_notice_sent_at,
    });

    if (action === 'none') return 'none';
    if (action === 'rearm') {
        await db.from('photographers').update({ storage_notice_sent_at: null }).eq('id', p.id);
        return 'rearmed';
    }
    if (!canEmailPhotographer(p)) return 'skipped';

    const staleLease = new Date(now.getTime() - STORAGE_NOTICE_LEASE_MS).toISOString();
    const nowIso = now.toISOString();
    // Бронь береться лише за того самого стану позначки, який ми щойно
    // прочитали: сусідній запит, що встиг надіслати лист і зняти бронь,
    // змінив storage_notice_sent_at, і цей запит уже нічого не отримає.
    let claim = db
        .from('photographers')
        .update({ storage_notice_pending_at: nowIso, ...(p.storage_notice_sent_at ? { storage_notice_sent_at: null } : {}) })
        .eq('id', p.id)
        .or(`storage_notice_pending_at.is.null,storage_notice_pending_at.lt.${staleLease}`);
    claim = p.storage_notice_sent_at
        ? claim.eq('storage_notice_sent_at', p.storage_notice_sent_at)
        : claim.is('storage_notice_sent_at', null);
    const { data: claimed } = await claim.select('id');
    if (!claimed || claimed.length === 0) return 'busy';

    const ok = await trySend(deps, p, storageNoticeEmail({
        usedBytes: usage.usedBytes,
        limitBytes: usage.limitBytes,
        planName: usage.planName,
        limitOverridden: usage.limitOverridden,
    }), NOTICE_TEMPLATES.storage);

    await db
        .from('photographers')
        .update(ok ? { storage_notice_sent_at: nowIso, storage_notice_pending_at: null } : { storage_notice_pending_at: null })
        .eq('id', p.id);
    return ok ? 'sent' : 'failed';
}
