/**
 * Файл підтвердження власності домену для IndexNow.
 *
 * Протокол перевіряє, що ключ із запиту лежить текстовим файлом на тому ж
 * хості. Тримати його в `public/` не можна: ключ потрапив би в репозиторій, а
 * репозиторій бачать двоє людей і другий ШІ-агент. Тому він приходить зі
 * змінної оточення, а `keyLocation` у запиті вказує саме на цю адресу.
 *
 * Без змінної маршрут віддає 404, а не порожній файл: порожня відповідь із
 * кодом 200 виглядала б для пошуковика як «ключ не збігся», і він вирішив би,
 * що адреси надсилає чужий.
 */
export const dynamic = 'force-dynamic';

export function GET() {
    const key = process.env.INDEXNOW_KEY;
    if (!key) return new Response('Not found', { status: 404 });

    return new Response(key, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
        },
    });
}
