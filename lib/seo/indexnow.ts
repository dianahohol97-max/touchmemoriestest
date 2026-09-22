import { getBaseUrl } from './locales';

/**
 * IndexNow — сповіщення пошуковиків про нову адресу.
 *
 * НАВІЩО. Sitemap кажуть роботу «прийди колись», IndexNow каже «зайди зараз».
 * Bing, Yandex, Seznam і Naver читають один спільний ендпоїнт, тож один запит
 * покриває всіх. Google до IndexNow не підключений і лишається на sitemap —
 * саме тому крон, окрім цього виклику, ще й робить `revalidatePath` на
 * `/sitemap.xml` і `/blog-sitemap.xml`.
 *
 * ПРО КЛЮЧ. Протокол вимагає довести, що домен наш: ключ має лежати текстовим
 * файлом на тому ж хості. Ми віддаємо його маршрутом `/indexnow-key.txt` і
 * показуємо шлях полем `keyLocation`, бо тримати ключ файлом у `public/`
 * означало б зафіксувати секрет у репозиторії. Без `INDEXNOW_KEY` функція
 * мовчки нічого не робить і каже про це в поверненому значенні: автопублікація
 * не має падати через те, що змінну ще не поставили.
 *
 * ПРО ПОМИЛКИ. Відмова IndexNow ніколи не валить публікацію. Стаття вже
 * відкрита, і єдине, що втрачається, — кілька годин до першого обходу.
 */

const ENDPOINT = 'https://api.indexnow.org/indexnow';

export type IndexNowResult = { ok: boolean; skipped?: boolean; status?: number; error?: string };

export function indexNowKeyLocation(): string {
    return `${getBaseUrl()}/indexnow-key.txt`;
}

export async function submitToIndexNow(urls: string[]): Promise<IndexNowResult> {
    const key = process.env.INDEXNOW_KEY;
    if (!key) return { ok: false, skipped: true, error: 'INDEXNOW_KEY не заданий' };
    if (!urls.length) return { ok: false, skipped: true, error: 'порожній список адрес' };

    const host = new URL(getBaseUrl()).host;

    try {
        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
                host,
                key,
                keyLocation: indexNowKeyLocation(),
                urlList: urls,
            }),
        });
        // 200 і 202 обидва означають «прийнято»; 202 — «ключ ще перевіряємо».
        return { ok: res.ok, status: res.status };
    } catch (e: any) {
        return { ok: false, error: e?.message || String(e) };
    }
}
