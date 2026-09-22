/**
 * Шрифт для картинок, які малює Satori (`next/og`).
 *
 * НАВІЩО ЦЕ ОКРЕМО ВІД `lib/print/`. Обкладинки вішбуків мають свій
 * завантажувач, але він живе разом із логікою друку — розмірами в міліметрах,
 * покриттям гліфів, кольором гравіювання, — і тягнути його сюди означало б
 * звʼязати SEO-картинку з друкарським пайплайном. Спільного тут рівно один
 * запит до Google Fonts, і дублювати його дешевше, ніж заплутати два різні
 * призначення одного файлу.
 *
 * ПРО ПІДМНОЖИНУ. Google віддає шрифт рівно з тих гліфів, які попросили
 * параметром `text`. Це різниця між сотнею кілобайтів і кількома мегабайтами
 * на кожен рендер. Кеш живе в памʼяті процесу: картинки регенеруються раз на
 * добу, тож один заголовок завантажує шрифт один раз.
 *
 * ПРО ВІДМОВУ. Без шрифту Satori малює кирилицю чорними прямокутниками —
 * системного запасу в неї немає. Тому `null` тут означає «краще віддати
 * картинку з латиницею, ніж не віддати нічого»: заголовок постраждає, але
 * сторінка в соцмережі лишиться з обкладинкою і брендом.
 */

const cache = new Map<string, ArrayBuffer | null>();

export async function loadOgFont(family: string, text: string): Promise<ArrayBuffer | null> {
    // Ключ рахується з набору СИМВОЛІВ, а не з рядка: дві статті з однаковими
    // літерами в різному порядку — це та сама підмножина.
    const glyphs = Array.from(new Set(text)).sort().join('');
    const key = `${family}:${glyphs}`;
    if (cache.has(key)) return cache.get(key) ?? null;

    let data: ArrayBuffer | null = null;
    try {
        const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@700&text=${encodeURIComponent(glyphs)}`;
        const cssRes = await fetch(url, {
            // Без цього заголовка Google віддає woff2, якого Satori не читає.
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        });
        if (cssRes.ok) {
            const css = await cssRes.text();
            const m = css.match(/src:\s*url\(([^)]+\.ttf)\)/)
                || css.match(/src:\s*url\(([^)]+)\)\s*format\('truetype'\)/);
            if (m) {
                const fontRes = await fetch(m[1]);
                if (fontRes.ok) data = await fontRes.arrayBuffer();
            }
        }
    } catch {
        data = null;
    }

    // Кеш тримає й невдачу: Google, який зараз не відповів, не має отримувати
    // запит на кожен рендер сторінки.
    cache.set(key, data);
    return data;
}
