import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { isServerOrderFlowEnabled } from '@/lib/orders/server-order-flow';
import {
    buildMagazineBriefOrderRow,
    isMagazineTextPackage,
    priceMagazineBrief,
} from '@/lib/orders/magazine-brief';

export const dynamic = 'force-dynamic';

/**
 * POST /api/orders/magazine-text-brief
 *
 * Серверне оформлення заявки «журнал із нашим текстом». Сторінка досі
 * вставляла замовлення прямо з браузера анонімним ключем: ціну рахував
 * браузер, файли підвʼязував браузер, і єдиним, що стояло між сторонньою
 * заявкою і базою, була політика таблиці.
 *
 * Маршрут вимкнений, поки в `settings` немає ствердного
 * `server_order_magazine_brief_enabled`. Вимкнений він відповідає
 * `{ enabled: false }`, а сторінка на таку відповідь іде старим шляхом —
 * тобто відкат не потребує деплою. Так само сторінка поводиться, якщо
 * маршрут недоступний або відповів помилкою.
 *
 * Що робить сервер, чого не робив браузер:
 *   1. Рахує ціну сам, тією ж функцією, що показує її клієнтові. Суму з
 *      браузера не відкидає — кладе поруч як заявлену, щоб розбіжність
 *      (стара збірка сторінки в клієнта) потрапила в звіт, а не в рахунок.
 *   2. Приймає тільки ті файли, що лежать під префіксом цієї ж заявки, і
 *      перевіряє, що вони справді є в сховищі. Інакше до замовлення можна
 *      було б підвʼязати будь-який обʼєкт чужого замовлення за його шляхом.
 *   3. Тримає ключ повтору: та сама заявка, надіслана двічі (клієнт
 *      натиснув ще раз, мережа обірвалася на відповіді), повертає те саме
 *      замовлення замість другого рядка з тими ж фото.
 */

const BUCKET = 'order-files';
/** Префікс, який складає сама сторінка: `magazine-brief-<мітка часу>`. */
const SESSION_RE = /^magazine-brief-\d{10,}$/;
const MAX_FILES = 200;

type IncomingFile = { path?: unknown; name?: unknown; size?: unknown; type?: unknown };

function str(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: NextRequest) {
    const admin = getAdminClient();

    let body: Record<string, any>;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'bad_json' }, { status: 400 });
    }

    // Вимикач читається ПЕРШИМ і до будь-якого запису: вимкнений маршрут не
    // має ані валідувати, ані торкатися бази.
    if (!(await isServerOrderFlowEnabled(admin, 'magazine-text-brief'))) {
        return NextResponse.json({ enabled: false });
    }

    const sessionId = str(body.idempotencyKey);
    if (!SESSION_RE.test(sessionId)) {
        return NextResponse.json({ error: 'bad_session' }, { status: 400 });
    }

    const pkg = body.pkg;
    if (!isMagazineTextPackage(pkg)) {
        return NextResponse.json({ error: 'bad_package' }, { status: 400 });
    }

    const firstName = str(body.firstName);
    const lastName = str(body.lastName);
    const email = str(body.email);
    const telegram = str(body.telegram);
    const phone = str(body.phone);
    const contactMethod = str(body.contactMethod) || 'telegram';
    // Ті самі обовʼязкові поля, що й у кнопці на сторінці. Telegram і пошта
    // обовʼязкові обидва (Діана, 07.08.2026): Telegram не завжди доступний, а
    // замовлення без пошти лишає єдиним каналом особистий телефон.
    if (!firstName || !lastName || !telegram || !/.+@.+\..+/.test(email)) {
        return NextResponse.json({ error: 'missing_contact' }, { status: 400 });
    }
    if (contactMethod === 'phone' && !phone) {
        return NextResponse.json({ error: 'missing_phone' }, { status: 400 });
    }

    const answers: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.answers || {})) {
        if (typeof v === 'string') answers[k] = v;
    }
    const options: Record<string, any> = (body.options && typeof body.options === 'object') ? body.options : {};
    const productSlug = str(body.productSlug) || 'personalized-glossy-magazine';

    const incoming: IncomingFile[] = Array.isArray(body.files) ? body.files.slice(0, MAX_FILES) : [];
    // Чужий шлях до замовлення не підвʼязується: приймаються тільки обʼєкти
    // під префіксом цієї заявки.
    const claimed = incoming
        .map(f => ({ path: str(f.path), name: str(f.name), size: Number(f.size) || 0, type: str(f.type) || 'image/jpeg' }))
        .filter(f => f.path.startsWith(`${sessionId}/`));
    if (claimed.length === 0) {
        return NextResponse.json({ error: 'no_files' }, { status: 400 });
    }

    // Повтор тієї самої заявки. Перевірка стоїть до вставки, а не замість
    // помилки унікальності: колонки під ключ немає, він лежить у
    // custom_attributes.
    const { data: already } = await admin
        .from('orders')
        .select('id, order_number, total')
        .eq('custom_attributes->>order_idempotency_key', sessionId)
        .maybeSingle();
    if (already) {
        return NextResponse.json({
            enabled: true, repeated: true,
            orderId: already.id, orderNumber: already.order_number, total: already.total,
        });
    }

    // Чи справді фото доїхали. Браузер вставляв рядки на всі шляхи, які
    // збирався завантажити, тож недовантажене замовлення виглядало в адмінці
    // повним. Один перегляд префікса дешевший за перевірку кожного файла.
    const { data: stored } = await admin.storage.from(BUCKET).list(sessionId, { limit: 1000 });
    const present = new Set((stored || []).map(o => `${sessionId}/${o.name}`));
    const files = claimed.filter(f => present.has(f.path));
    if (files.length === 0) {
        return NextResponse.json({ error: 'files_missing_in_storage' }, { status: 409 });
    }

    const declaredTotal = Number(body.declaredTotal);
    const price = priceMagazineBrief(options, pkg);
    if (Number.isFinite(declaredTotal) && declaredTotal !== price.total) {
        // Не відмова: замовлення оформлюється за порахованою сумою, а
        // розбіжність лишається в журналі і в помітці замовлення.
        console.warn('[magazine-brief] price mismatch', JSON.stringify({
            sessionId, declared: declaredTotal, computed: price.total, options, pkg,
        }));
    }

    const coverPhotoPath = (() => {
        const declared = str(body.coverPhotoPath);
        return declared && present.has(declared) ? declared : null;
    })();

    const row = buildMagazineBriefOrderRow({
        path: 'server',
        productSlug,
        pkg,
        answers,
        options,
        firstName, lastName, phone, email, telegram, contactMethod,
        coverName: str(body.coverName),
        coverDate: str(body.coverDate),
        coverEra: str(body.coverEra),
        coverStyle: str(body.coverStyle),
        coverPhotoNote: str(body.coverPhotoNote),
        coverInscription: str(body.coverInscription),
        coverPhotoPath,
        declaredTotal: Number.isFinite(declaredTotal) ? declaredTotal : null,
        idempotencyKey: sessionId,
    });
    row.source = 'site';
    row.custom_attributes = {
        ...row.custom_attributes,
        // Скільки фото заявив браузер і скільки реально лежить у сховищі.
        // Різниця — це те, чого в замовленні бракує.
        photos_submitted: claimed.length,
        photos_attached: files.length,
    };

    const { data: order, error: orderError } = await admin
        .from('orders')
        .insert(row)
        .select('id, order_number, total')
        .single();
    if (orderError || !order) {
        console.error('[magazine-brief] insert failed:', orderError?.message);
        return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
    }

    // Підвʼязка файлів. Замовлення вже існує, тож її помилка не має вертатися
    // клієнтові як помилка оформлення — інакше він оформить друге.
    const { error: filesErr } = await admin.from('order_files').insert(
        files.map((f, idx) => ({
            order_id: order.id,
            file_path: f.path,
            file_name: f.name || f.path.split('/').pop(),
            file_type: 'upload',
            file_category: 'magazine-text-brief',
            product_type: 'journal',
            bucket_name: BUCKET,
            file_size: f.size,
            mime_type: f.type,
            page_number: idx + 1,
        }))
    );
    if (filesErr) console.error('[magazine-brief] order_files link failed (order kept):', filesErr.message);

    return NextResponse.json({
        enabled: true,
        orderId: order.id,
        orderNumber: order.order_number,
        total: order.total,
        filesLinked: filesErr ? 0 : files.length,
    });
}
