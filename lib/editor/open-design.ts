import { createClient } from '@/lib/supabase/client';
import { countPhotosNeedingVariants } from '@/lib/editor/photo-variant-paths';
import { resolveEndpaperPaid } from '@/lib/print/forzat-expectation';
import { toast } from 'sonner';

/**
 * Відкрити збережений макет у СПРАВЖНЬОМУ конструкторі.
 *
 * ЧОМУ ЦЕ ОКРЕМИЙ МОДУЛЬ. Передача макета в редактор — це не навігація, а
 * десяток кроків: дочитати рядок `projects`, догнати зменшені копії фото,
 * зібрати конфіг, підписати кожен файл у сховищі, відновити розкладку по
 * іменах, вирішити режим (звичайна чернетка, редагування свого замовлення,
 * виправлення чужого) і аж тоді покласти все у sessionStorage, звідки
 * конструктор це читає. Друга копія такого коду розійшлася б із першою за
 * тиждень — так уже було з панеллю фото і зі списком блогу.
 *
 * Тому копія одна, і користуються нею двоє: кабінет клієнта («Продовжити
 * редагування») і місток /editor/open/[projectId], на який ведуть картка
 * замовлення в адмінці та листи-нагадування. Доти обидва ті посилання вели на
 * /editor/[projectId] — інший, недобудований редактор, який читає pages_data
 * як власний формат, падає на `page.background.type` і показує порожнє
 * полотно. Його кнопка «Скачати PDF» віддавала обкладинку плюс чисті аркуші,
 * бо цикл по сторінках у ній так і лишився коментарями.
 *
 * Повертає адресу, на яку треба перейти, а не переходить сама: місток хоче
 * router.push, кабінет — теж, але рішення про навігацію лишається за тим, хто
 * знає свій контекст.
 */
export type OpenDesignResult =
    | { ok: true; href: string }
    | { ok: false; error: string };

export async function openDesignInConstructor(projectId: string): Promise<OpenDesignResult> {
    const supabase = createClient();
    try {
    const { data: row, error } = await supabase.from('projects').select('*').eq('id', projectId).single();
    if (error || !row) return { ok: false as const, error: 'Не вдалося відкрити дизайн — його немає або він належить іншому акаунту.' };
    const cp: any = row.cart_payload || {};
    const ov: any = row.overlays_data || {};
    let photosMeta: any[] = Array.isArray(row.uploaded_photos) ? row.uploaded_photos : [];

    // Макети, збережені до появи зменшених копій, копій не мають, і
    // зробити їх у браузері можна тільки завантаживши оригінали — тобто
    // рівно ті тринадцять хвилин, від яких ми тікаємо. Тому їх ріже
    // сервер, а людина бачить, що відбувається. Сорок фото на прохід,
    // тож великий макет забирає два-три виклики.
    const pending = countPhotosNeedingVariants(photosMeta);
    if (pending > 0) {
        const prep = toast.loading(
            `Готуємо ${pending} фото до швидкого відкриття, це займе трохи часу.`,
        );
        try {
            for (let pass = 0; pass < 6; pass++) {
                const res = await fetch(`/api/projects/${row.id}/photo-variants`, { method: 'POST' });
                if (!res.ok) break;
                const info = await res.json().catch(() => null);
                if (!info?.ok) break;
                if (Array.isArray(info.photos)) photosMeta = info.photos;
                if (!info.remaining || !info.made) break;
            }
        } catch {
            // Не вийшло — відкриваємо з оригіналів, як відкривалося досі.
        } finally {
            toast.dismiss(prep);
        }
    }

    // Prefer the exact saved config; otherwise reconstruct the essentials.
    const config = ov.config || {
        productSlug: cp.slug || row.product_type,
        productName: cp.name || row.name,
        productId: cp.product_id,
        selectedSize: row.format,
        selectedPageCount: cp.options?.['Сторінок'] || `${row.total_pages} сторінок`,
        selectedCoverType: row.cover_type,
        totalPrice: cp.price,
    };
    const slug = String(config.productSlug || '').toLowerCase().trim();

    /**
     * ОПЛАЧЕНИЙ ФОРЗАЦ ДЛЯ МАКЕТІВ, ЗБЕРЕЖЕНИХ ДО ПОЯВИ `endpaperPaid`.
     *
     * Поле `endpaperPaid` зʼявляється лише в НОВИХ збереженнях, а форзац уже
     * оплачений у десятках старих. Для них конструктор має єдине джерело —
     * `enableEndpaper`, який для журналу з мʼякою обкладинкою не може бути
     * нічим, окрім false, бо галочку в конфігураторі показує
     * shouldShowEndpaperOption() тільки для тревелбука і твердої обкладинки.
     * Тобто без цього відкату кожне відкриття такого макета замикало б форзац,
     * за який людина заплатила, а видалення розвороту стирало б із нього фото
     * як із неоплаченого — рівно те, від чого лікувалися.
     *
     * Джерело — рядок кошика, який лежить у самому проєкті. Читати `orders`
     * звідси не можна: клієнтові їх не дає RLS, і саме тому запитувати треба
     * не замовлення, а `cart_payload`, який оформлення зберігає разом із
     * макетом. Дизайнерська копія його теж несе: clone-project-to-me копіює
     * `cart_payload` дослівно.
     *
     * Прохід по живій базі (22.09.2026): із 62 макетів на замовленнях з
     * оплаченим форзацом відкат бачить 52, тобто 16 замовлень із 20. Решта
     * шість несуть тонку позначку `{ id }` без опцій — там форзац лишиться
     * замкненим, як і був, а нестачу файлу однаково спіймає сторож.
     *
     * Це ЧИТАННЯ: у базу тут не пишеться нічого, жоден рядок живого замовлення
     * не змінюється. Записатися нове поле може тільки тоді, коли людина сама
     * збереже макет, і то вже в новому форматі.
     *
     * Порядок джерел — від сильнішого до слабшого: `endpaperPaid`, далі рядок
     * кошика, далі `enableEndpaper`, далі замкнено. Жодне слабше джерело не
     * може зняти оплату, яку назвало сильніше.
     */
    const endpaperPaid = resolveEndpaperPaid(config.endpaperPaid, cp.options);
    if (endpaperPaid) config.endpaperPaid = endpaperPaid;

    // Structure draft — exactly the shape the editor's restore path reads.
    const draft = {
        pages: row.pages_data || [],
        coverState: row.cover_data || undefined,
        freeSlots: ov.freeSlots,
        pageStickers: ov.pageStickers,
        pageShapes: ov.pageShapes,
        pageBgs: ov.pageBgs,
        qrOverlays: ov.qrOverlays,
        generatedQRCount: ov.generatedQRCount,
    };

    // filename -> the slots / free-slots / cover it occupied.
    const idToName: Record<string, string> = {};
    photosMeta.forEach((p: any) => { if (p?.id && p?.name) idToName[p.id] = p.name; });
    const placement: Record<string, { pages: { pi: number; si: number }[]; free: { pi: number; idx: number }[]; cover: boolean }> = {};
    const ensure = (name: string) => (placement[name] ||= { pages: [], free: [], cover: false });
    (row.pages_data || []).forEach((pg: any, pi: number) => (pg?.slots || []).forEach((s: any, si: number) => {
        const nm = s?.photoId ? idToName[s.photoId] : undefined;
        if (nm) ensure(nm).pages.push({ pi, si });
    }));
    Object.entries(ov.freeSlots || {}).forEach(([pi, arr]: [string, any]) => (arr || []).forEach((fs: any, idx: number) => {
        const nm = fs?.photoId ? idToName[fs.photoId] : undefined;
        if (nm) ensure(nm).free.push({ pi: Number(pi), idx });
    }));
    const coverPid = (row.cover_data as any)?.photoId;
    if (coverPid && idToName[coverPid]) ensure(idToName[coverPid]).cover = true;

    // Restore photos from Storage if they were uploaded on a previous
    // save (uploaded_photos[].path). Falls back to the empty-array
    // "re-add by filename" flow for older drafts saved before this
    // existed, or for any photo whose upload failed.
    const photosWithPaths = photosMeta.filter(p => p?.path);
    let restoredPhotos: any[] = [];
    // Фото, які не вдалося відновити. Раніше вони мовчки відсіювались
    // фільтром, і це найдорожча тиша в усьому потоці: createSignedUrls
    // повертає рядок на КОЖЕН шлях, і для відсутнього файлу в ньому
    // стоїть помилка й порожній signedUrl. Такий запис випадав, лічильник
    // у редакторі показував менше фото, ніж є в макеті, а слоти з ними
    // малювалися як порожні. На TM-001257 у макеті 18 розставлених фото,
    // усі 18 зі шляхами у сховищі, а редактор показував «Фото (12)» —
    // і клієнт бачив сторінки, які вважав порожніми.
    const failedPhotos: string[] = [];
    if (photosWithPaths.length > 0) {
        try {
            // Підписуємо разом із оригіналом і його зменшені копії.
            //
            // Показувати оригінали було найдорожчою звичкою редактора:
            // TM-001342 це 68 знімків на 184 МБ, які браузер тягнув і
            // розкодовував заради стрічки мініатюр, і клієнтка чекала
            // тринадцять хвилин заради правки напису на обкладинці. На
            // полотно тепер іде копія на 1600 px, у стрічку — на 360,
            // а оригінал лишається там, де він справді потрібен, у
            // `path`: макет для друку збирає Railway саме з нього.
            //
            // Копій немає в чернетках, збережених до цієї зміни, тож
            // кожен рядок має відкат на оригінал, а не порожнечу.
            const paths = photosWithPaths.map(p => p.path as string);
            const previewPaths = photosWithPaths.map(p => (p.previewPath as string) || '');
            const thumbPaths = photosWithPaths.map(p => (p.thumbPath as string) || '');
            const extra = [...previewPaths, ...thumbPaths].filter(Boolean);
            const [{ data: signedUrls, error: signErr }, extraSigned] = await Promise.all([
                supabase.storage.from('photobook-uploads')
                    .createSignedUrls(paths, 60 * 60 * 24 * 7), // 7 days
                extra.length
                    ? supabase.storage.from('photobook-uploads')
                        .createSignedUrls(extra, 60 * 60 * 24 * 7)
                        .then(r => r.data || [], () => [])
                    : Promise.resolve([] as any[]),
            ]);
            const urlByPath: Record<string, string> = {};
            (extraSigned || []).forEach((s: any, i: number) => {
                if (s?.signedUrl && extra[i]) urlByPath[extra[i]] = s.signedUrl;
            });
            if (signErr) {
                console.error('Failed to sign photo URLs:', signErr);
                failedPhotos.push(...photosWithPaths.map(p => String(p.name || p.id)));
            } else if (signedUrls) {
                photosWithPaths.forEach((p, i) => {
                    const url = signedUrls[i]?.signedUrl || '';
                    if (url) restoredPhotos.push({
                        id: p.id,
                        name: p.name,
                        width: p.width,
                        height: p.height,
                        preview: urlByPath[previewPaths[i]] || url,
                        ...(urlByPath[thumbPaths[i]] ? { thumb: urlByPath[thumbPaths[i]] } : {}),
                        // Шлях до ОРИГІНАЛУ їде з фото далі.
                        //
                        // Без нього конструктор вважав відновлене фото
                        // новим: на першому ж збереженні він качав усі
                        // оригінали назад із хмари і заливав їх удруге
                        // під новим шляхом. Для цього макета це 184 МБ
                        // вниз і стільки ж угору, і точна копія кожного
                        // файлу в сховищі після кожного відкриття.
                        path: p.path,
                        ...(p.previewPath ? { previewPath: p.previewPath } : {}),
                        ...(p.thumbPath ? { thumbPath: p.thumbPath } : {}),
                    });
                    else failedPhotos.push(String(p.name || p.id));
                });
            }
        } catch (e) {
            console.error('Failed to restore photos from storage:', e);
            failedPhotos.push(...photosWithPaths.map(p => String(p.name || p.id)));
        }
    }
    if (failedPhotos.length > 0) {
        console.error('[reopen] photos not restored', failedPhotos);
        toast.error(
            `Не вдалося завантажити ${failedPhotos.length} фото з ${photosWithPaths.length}: `
            + `${failedPhotos.slice(0, 3).join(', ')}${failedPhotos.length > 3 ? '…' : ''}. `
            + 'Сторінки з ними позначені в редакторі — вони не порожні, фото піде в друк.',
            { duration: 15000 },
        );
    }
    // Any photo without a stored path still needs manual re-add — keep
    // it out of restoredPhotos so the placement-by-filename toast covers it.
    const restoredIds = new Set(restoredPhotos.map(p => p.id));
    const remainingPlacement: typeof placement = {};
    Object.entries(placement).forEach(([nm, info]) => {
        const meta = photosMeta.find(p => p.name === nm);
        if (!meta || !restoredIds.has(meta.id)) remainingPlacement[nm] = info;
    });

    // Hand off via the same sessionStorage keys the editor already reads.
    sessionStorage.setItem('bookConstructorConfig', JSON.stringify(config));
    sessionStorage.setItem('bookConstructorPhotos', JSON.stringify(restoredPhotos));
    sessionStorage.setItem(slug ? `bookEditorDraft_${slug}` : 'bookEditorDraft', JSON.stringify(draft));
    sessionStorage.setItem('bookReopenPlacement', JSON.stringify(remainingPlacement));
    sessionStorage.setItem('bookReopenProjectId', String(row.id));

    // If this design belongs to an order that has not gone to print yet,
    // the editor switches into "change this order" mode: the save lands
    // on that order instead of creating a second one. The server decides
    // — it owns the ownership and production checks — so a stale or
    // foreign order simply comes back non-editable and the normal
    // add-to-cart flow stays.
    sessionStorage.removeItem('bookEditOrderId');
    sessionStorage.removeItem('bookEditOrderNumber');
    // РЕЖИМ ВИПРАВЛЕННЯ ЧУЖОГО ЗАМОВЛЕННЯ.
    //
    // Копія, зроблена кнопкою «Макет → мої чернетки», несе позначку
    // fix_for_order_id. Без неї конструктор бачив звичайну чернетку, і
    // «Зберегти та замовити» додавало виправлення чужого макета в
    // кошик дизайнера як нову покупку на повну вартість журналу.
    // У цьому режимі кошика немає взагалі: збереження лягає в ту саму
    // чернетку, а на замовлення її ставлять із картки замовлення.
    sessionStorage.removeItem('bookFixOrderId');
    sessionStorage.removeItem('bookFixOrderLabel');
    if ((row as any).fix_for_order_id) {
        sessionStorage.setItem('bookFixOrderId', String((row as any).fix_for_order_id));
        // Назва копії має вигляд «TM-001257 — переекспорт», тож номер
        // беремо з неї: читати orders з акаунта не дає RLS.
        const label = String(row.name || '').split('—')[0].trim();
        sessionStorage.setItem('bookFixOrderLabel', label);
        sessionStorage.setItem('bookFixProjectId', String(row.id));
        toast.info(
            `Ви виправляєте макет замовлення ${label}. Збережене повернеться в картку замовлення, у кошик нічого не додається.`.trim(),
            { duration: 9000 },
        );
    }
    if (row.order_id) {
        try {
            const chk = await fetch(`/api/orders/${row.order_id}/update-design`);
            const info = await chk.json().catch(() => ({}));
            if (chk.ok && info.editable) {
                sessionStorage.setItem('bookEditOrderId', String(row.order_id));
                sessionStorage.setItem('bookEditOrderNumber', String(info.orderNumber || ''));
                toast.info(
                    `Ви редагуєте макет замовлення ${info.orderNumber || ''}. Зміни збережуться в ньому, платити ще раз не потрібно.`.trim(),
                    { duration: 9000 },
                );
            } else if (info.reason) {
                toast.info(`${info.reason} Ви можете змінити дизайн і оформити його як нове замовлення.`, { duration: 9000 });
            }
        } catch { /* offline — fall back to the normal cart flow */ }
    }
    try { (window as any).__bookPhotoOriginals = undefined; } catch {}

    const locale = (typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : 'uk') || 'uk';
    return { ok: true as const, href: `/${locale}/editor/book/layout` };
    } catch (e) {
        console.error('openDesignInConstructor failed:', e);
        return { ok: false, error: 'Не вдалося відкрити дизайн' };
    }
}
