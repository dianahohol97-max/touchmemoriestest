/**
 * Дозбирання відбитків фотодруку, коли посилання на них загубилося.
 *
 * ЩО САМЕ ЛАМАЄТЬСЯ. Конструктор фотодруку не створює рядка в `projects`
 * взагалі: він рендерить відбитки, кладе їх у теку `{userKey}/pp_{ts}/` і
 * запамʼятовує перелік у сховищі вкладки під ключем `export_{cartItemId}`.
 * Оформлення читає той ключ і робить із нього order_files. Сховище вкладки
 * живе рівно до кінця сесії.
 *
 * TM-001347 — рахунок за цю крихкість. Клієнтка зібрала 126 фото 17.09 о 16:29,
 * позиція пролежала в кошику три доби, і 20.09 о 17:13 вона оплатила 1008 ₴
 * сертифікатом. Усі 126 відбитків лежали у сховищі цілі, а в замовленні не було
 * жодного файлу: ключ у сховищі вкладки за три дні зник, а більше про звʼязок
 * не знав ніхто. Для книг цей самий розрив уже лікували на TM-001255, але там
 * рятує рядок у `projects`, якого у фотодруку немає.
 *
 * ЯК ЦЕ ЗНАХОДИТЬСЯ БЕЗ КЛЮЧА. Ідентифікатор позиції кошика має вигляд
 * `{productId}_{ts}`, а тека — `pp_{ts}`, і роблять їх за мілісекунди одна від
 * одної: у TM-001347 різниця тридцять шість мілісекунд. Часу мало, тож на ньому
 * одному будувати не можна — повтор спроби лишає теку з давнішим часом. Тому
 * збіг тут потрійний: час у вікні, РІВНО стільки файлів, скільки відбитків
 * оплачено, і тека, яку ще не забрало собі інше замовлення.
 *
 * ЧОМУ САМЕ ТАК СУВОРО. Помилитися тут означає покласти в замовлення чужі
 * фотографії, і побачить це не адмінка, а людина, яка отримає конверт. Тому
 * коли кількість відбитків невідома або кандидатів із однаковою вагою кілька,
 * функція чесно не повертає нічого: порожнє замовлення видно, чужі фото — ні.
 */

/** Час із ідентифікатора позиції кошика `{productId}_{ts}`. */
export function cartIdTimestamp(cartItemId: unknown): number | null {
    const m = String(cartItemId || '').match(/_(\d{10,})$/);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
}

/** Час із назви теки `pp_{ts}`. */
export function folderTimestamp(folder: unknown): number | null {
    const m = String(folder || '').match(/^pp_(\d{10,})$/);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Скільки відбитків у цій позиції замовлення.
 *
 * Конструктор пише кількість у двох місцях, і обидва доїжджають до замовлення:
 * опція «Кількість фото» і примітка «126 фото для друку». Читаємо обидва, бо
 * саме це число — головний запобіжник від чужої теки.
 */
export function expectedPhotoCount(item: unknown): number | null {
    if (!item || typeof item !== 'object') return null;
    const it = item as Record<string, any>;
    const fromOption = it.options && typeof it.options === 'object'
        ? String((it.options as Record<string, unknown>)['Кількість фото'] ?? '')
        : '';
    const direct = Number(String(fromOption).replace(/[^\d]/g, ''));
    if (Number.isFinite(direct) && direct > 0) return direct;

    const note = String(it.personalization_note || '').match(/(\d+)\s*фото/);
    if (note) {
        const n = Number(note[1]);
        if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
}

/** Скільки часу навколо позиції кошика вважаємо «тією самою спробою». */
export const FOLDER_WINDOW_MS = 30 * 60_000;

export type FolderCandidate = {
    /** Повна назва теки, напр. `pp_1789662580990`. */
    folder: string;
    /** Корінь у бакеті: `anon` або id користувача. */
    root: string;
    /** Скільки файлів у теці. */
    files: number;
    /** Чи вже належить ця тека якомусь замовленню. */
    taken: boolean;
};

/**
 * Єдина тека, яка може належати цій позиції, або нічого.
 *
 * Повертає null навмисно частіше, ніж могло б: без кількості відбитків, при
 * розбіжності в кількості, поза вікном часу і коли два кандидати однаково
 * близькі. Порожнє замовлення помітить менеджерка, чужі фото — клієнт.
 */
export function pickPrintFolder(
    candidates: FolderCandidate[],
    opts: { cartTs: number | null; expected: number | null; windowMs?: number },
): FolderCandidate | null {
    const { cartTs, expected } = opts;
    if (!cartTs || !expected) return null;
    const windowMs = opts.windowMs ?? FOLDER_WINDOW_MS;

    const fit = (candidates || []).filter(c => {
        if (!c || c.taken) return false;
        if (c.files !== expected) return false;
        const ts = folderTimestamp(c.folder);
        return ts !== null && Math.abs(ts - cartTs) <= windowMs;
    });
    if (fit.length === 0) return null;

    const distance = (c: FolderCandidate) => Math.abs((folderTimestamp(c.folder) as number) - cartTs);
    fit.sort((a, b) => distance(a) - distance(b));
    // Два однаково близькі кандидати — це не вибір, це жереб.
    if (fit.length > 1 && distance(fit[0]) === distance(fit[1])) return null;
    return fit[0];
}

type Admin = {
    from: (table: string) => any;
    storage: { from: (bucket: string) => any };
};

const BUCKET = 'order-files';

/** Теки `pp_*` під цим коренем, із кількістю файлів у кожній. */
async function listPrintFolders(admin: Admin, root: string, cartTs: number, windowMs: number): Promise<FolderCandidate[]> {
    try {
        const { data, error } = await admin.storage.from(BUCKET).list(root, { limit: 1000 });
        if (error || !data) return [];
        // Відсіюємо за часом ДО того, як рахувати файли: інакше кожне оформлення
        // читало б усі теки цього користувача заради однієї.
        const near = (data as any[])
            .filter(e => e && !e.id && typeof e.name === 'string')
            .filter(e => {
                const ts = folderTimestamp(e.name);
                return ts !== null && Math.abs(ts - cartTs) <= windowMs;
            });
        const out: FolderCandidate[] = [];
        for (const entry of near) {
            const { data: files } = await admin.storage.from(BUCKET).list(`${root}/${entry.name}`, { limit: 1000 });
            out.push({
                folder: entry.name,
                root,
                files: Array.isArray(files) ? files.filter((f: any) => f?.id).length : 0,
                taken: false,
            });
        }
        return out;
    } catch {
        return [];
    }
}

/**
 * Прикріпити відбитки до позиції замовлення, якщо їх вдалося впізнати.
 *
 * Повертає кількість прикріплених файлів. Нуль означає «не впізнали» і це
 * нормальний результат: краще лишити замовлення видимо порожнім, ніж покласти
 * в нього чужі знімки.
 */
export async function recoverPrintFilesForItem(
    admin: Admin,
    orderId: string,
    item: unknown,
    owners: string[],
): Promise<number> {
    const it = (item && typeof item === 'object') ? item as Record<string, any> : null;
    if (!it) return 0;
    const cartTs = cartIdTimestamp(it.cart_item_id);
    const expected = expectedPhotoCount(it);
    if (!cartTs || !expected) return 0;

    const candidates: FolderCandidate[] = [];
    for (const root of owners) {
        if (!root) continue;
        candidates.push(...await listPrintFolders(admin, root, cartTs, FOLDER_WINDOW_MS));
    }
    if (candidates.length === 0) return 0;

    // Тека, яку вже забрало інше замовлення, не може належати цьому.
    for (const c of candidates) {
        const { data: used } = await admin
            .from('order_files')
            .select('order_id')
            .eq('bucket_name', BUCKET)
            .like('file_path', `${c.root}/${c.folder}/%`)
            .limit(1);
        const owner = (used || [])[0]?.order_id;
        if (owner && owner !== orderId) c.taken = true;
    }

    const pick = pickPrintFolder(candidates, { cartTs, expected });
    if (!pick) return 0;

    const { data: objects } = await admin.storage.from(BUCKET).list(`${pick.root}/${pick.folder}`, { limit: 1000 });
    const names = (objects || []).filter((o: any) => o?.id).map((o: any) => String(o.name)).sort();
    if (names.length !== expected) return 0;

    const { data: existing } = await admin
        .from('order_files')
        .select('file_path')
        .eq('order_id', orderId);
    const already = new Set((existing || []).map((r: any) => r.file_path));

    const rows = names
        .map((name: string, i: number) => ({
            order_id: orderId,
            file_path: `${pick.root}/${pick.folder}/${name}`,
            file_name: name,
            file_type: 'export',
            file_category: String(it.slug || '') === 'polaroid-print' ? 'polaroid-print'
                : String(it.slug || '') === 'photomagnets' ? 'photomagnets'
                : 'photo-print',
            product_type: 'photo-print',
            bucket_name: BUCKET,
            mime_type: 'image/jpeg',
            page_number: i + 1,
        }))
        .filter((r: any) => !already.has(r.file_path));
    if (rows.length === 0) return 0;

    const { error } = await admin.from('order_files').insert(rows);
    if (error) {
        console.error('[recover-print] insert failed', { orderId, folder: pick.folder, error: error.message });
        return 0;
    }
    console.log('[recover-print] відбитки знайдено за часом і кількістю', {
        orderId, folder: pick.folder, files: rows.length,
    });
    return rows.length;
}
