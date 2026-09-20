/**
 * Мініатюра збереженого макета для кабінету «Мої дизайни».
 *
 * Досі картки макетів редактора не мали превʼю взагалі: усі сім проєктів у
 * кабінеті виглядали однаковим градієнтом з іконкою книжки, і відрізнити
 * «TM-001257 — переекспорт» від двох просто «Глянцевий журнал з мʼякою
 * обкладинкою» можна було лише за підписом. Для дизайнера, який тримає кілька
 * чернеток одного замовлення, це прямий шлях відкрити не ту й виправляти те,
 * що вже виправлено.
 *
 * Рендерити превʼю на сервері заради цього не треба: у макета вже є фото
 * обкладинки, а якщо його немає — перше завантажене фото. Обидва лежать у
 * тому самому сховищі, звідки кабінет і так підписує посилання, тож картка
 * отримує справжній кадр клієнта, а не заглушку.
 *
 * Свідомо НЕ беремо фото зі сторінок: pages_data це весь макет цілком, і
 * тягнути його в список із двадцяти проєктів заради однієї мініатюри дорожче,
 * ніж воно того варте. Обкладинки й списку фото досить, щоб дві картки
 * перестали бути однаковими.
 */

export interface UploadedPhotoMeta {
    id?: string | null;
    name?: string | null;
    path?: string | null;
    /** Зменшена копія на ~360 px поруч із оригіналом, якщо вона вже є. */
    thumbPath?: string | null;
}

/**
 * Шлях у сховищі, який годиться як мініатюра макета, або null.
 *
 * Порядок: фото з обкладинки, далі перше завантажене фото зі шляхом. Запис
 * без path не годиться — підписати його нічим.
 */
export function designThumbPath(
    coverData: unknown,
    uploadedPhotos: unknown,
): string | null {
    const photos: UploadedPhotoMeta[] = Array.isArray(uploadedPhotos) ? uploadedPhotos : [];
    const withPath = photos.filter(p => p && typeof p.path === 'string' && !!p.path);
    if (withPath.length === 0) return null;

    const cover = (coverData && typeof coverData === 'object') ? coverData as Record<string, any> : null;
    const coverPhotoId = cover
        ? (cover.photoId
            ?? cover.printedPhotoSlots?.[0]?.photoId
            ?? cover.coverPhotos?.[0]?.photoId
            ?? null)
        : null;

    // Мініатюра в списку ніколи не більша за сотню пікселів, тож коли поруч
    // із оригіналом лежить копія на 360 px, беремо її. Десяток карток по
    // три мегабайти кожна — це той самий рахунок, який довів TM-001342 до
    // тринадцяти хвилин очікування, просто в меншому масштабі.
    const shown = (p: UploadedPhotoMeta) => p.thumbPath || p.path || null;

    if (coverPhotoId) {
        const hit = withPath.find(p => p.id === coverPhotoId);
        if (hit) {
            const url = shown(hit);
            if (url) return url;
        }
    }

    return shown(withPath[0]);
}
