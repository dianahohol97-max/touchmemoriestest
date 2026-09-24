#!/usr/bin/env node
/**
 * Запити до великих таблиць, написані без пагінації.
 *
 * Навіщо. PostgREST віддає щонайбільше тисячу рядків і НЕ каже про це нічим:
 * відповідь просто коротша за правду. За 14.09.2026 ця сама пастка спрацювала
 * чотири рази — список клієнтів, список замовлень у дашборді, аналітика на
 * довгому періоді й один діалог у соціальній скриньці, — і щоразу її помічали
 * випадково, уже після того, як хтось подивився на неправильне число.
 *
 * Запуск:  node scripts/unpaginated-queries.mjs
 *
 * Код повернення 1, якщо знайдено бодай один запит, який треба переписати —
 * щоб це можна було поставити в перевірку перед комітом.
 *
 * Розбір і поточний список живуть у docs/unpaginated-queries.md; цей скрипт
 * лише перезаміряє. Правило — гоча 14 в CLAUDE.md.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

/**
 * Таблиці, де пагінація потрібна ЗАВЖДИ, незалежно від сьогоднішнього розміру.
 *
 * Критерій відбору простий: таблиця росте від роботи магазину, а не від
 * рішення адміністратора. Довідники на кшталт categories чи products ростуть
 * тоді, коли Діана щось додає, і тисячу рядків там видно заздалегідь. Ці
 * шість наповнюються самі, і межу вони перетнуть без жодної зміни в коді.
 */
const WATCHED_TABLES = [
    'orders',
    'customers',
    'social_messages',
    'social_conversations',
    'email_logs',
    'projects',
    // Весільна сторінка: фото складають гості, а не адміністратор. Сто гостей
    // по двадцять знімків — це дві тисячі рядків на одному весіллі, тобто
    // критерій той самий, що й у шести вище.
    'wedding_photos',
    // Галереї фотографів: таблицю наповнюють фотографи, а не адміністратор, і
    // одна галерея сама дає до двох тисяч рядків (MAX_PHOTOS_PER_GALLERY).
    // Крон очищення читав тисячу, а видаляв усі рядки, тож друга тисяча файлів
    // лишалася в R2 без жодного рядка. Читати — через lib/photographers/gallery-photos.ts.
    'photographer_gallery_photos',
    // Спроби «Завантажити все»: рядок на кожне натискання клієнта. Кабінет
    // читає їх лише агрегатом gallery_zip_attempt_stats (рядок на галерею).
    'gallery_zip_attempts',
];

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', '.vercel', 'scripts']);
const SOURCE = /\.(ts|tsx)$/;

/** Ознаки того, що вибірка вже обмежена і межа PostgREST їй не страшна. */
const BOUNDED = [
    { re: /\.range\s*\(/, why: 'сторінками' },
    { re: /\.limit\s*\(/, why: 'з лімітом' },
    { re: /\.maybeSingle\s*\(/, why: 'один рядок' },
    { re: /\.single\s*\(/, why: 'один рядок' },
    { re: /head:\s*true/, why: 'лише лічильник' },
];

/** Запис, а не читання: межа вибірки до нього не стосується. */
const WRITE = /\.(insert|update|upsert|delete)\s*\(/;

/**
 * Фільтр по ключу батьківського запису.
 *
 * Такий запит обмежений не лімітом, а самими даними: замовлення одного
 * клієнта, повідомлення одного діалогу, файли одного замовлення. Це НЕ
 * автоматично безпечно — найдовший діалог у нас має 3 021 повідомлення, — тож
 * скрипт виносить їх окремим списком, а не мовчки зараховує до чистих.
 */
const BY_PARENT = /\.(eq|in|ilike)\s*\(\s*['"][a-z_]*(id|email)['"]/;

/**
 * Фільтр по списку, який передав викликач.
 *
 * `.in('order_number', orderNumbers)` обмежений не лімітом і не ключем, а
 * довжиною масиву, що прийшов у функцію. Це та сама природа, що й фільтр по
 * батьківському ключу: тримають дані, а не запит. Літеральний список у дужках
 * сюди не рахується — там усе видно очима.
 */
const BY_CALLER_LIST = /\.in\s*\(\s*['"][a-z_]+['"]\s*,\s*[A-Za-z_$][\w$.]*\s*\)/;

function walk(dir, out = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
            walk(join(dir, entry.name), out);
        } else if (SOURCE.test(entry.name)) {
            out.push(join(dir, entry.name));
        }
    }
    return out;
}

/**
 * Ланцюжок запиту від .from('таблиця') до кінця виразу.
 *
 * Межею вважається крапка з комою або початок нового оператора: ланцюжки тут
 * пишуть у кілька рядків, і обрізати їх по переводу рядка не можна.
 */
function chainsFor(text, table) {
    const found = [];
    const opener = new RegExp(`\\.from\\(\\s*['"]${table}['"]\\s*\\)`, 'g');
    let m;
    while ((m = opener.exec(text)) !== null) {
        const start = m.index;
        let end = text.length;
        for (let i = m.index + m[0].length; i < text.length; i++) {
            if (text[i] === ';') { end = i; break; }
        }
        const slice = text.slice(start, Math.min(end, start + 1200));
        found.push({ index: start, text: slice });
    }
    return found;
}

const root = resolve(process.cwd());
const files = walk(root);

const needsWork = [];
const byParent = [];
let bounded = 0;

for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const table of WATCHED_TABLES) {
        if (!text.includes(`'${table}'`) && !text.includes(`"${table}"`)) continue;
        for (const chain of chainsFor(text, table)) {
            if (WRITE.test(chain.text)) continue;
            if (!/\.select\s*\(/.test(chain.text)) continue;

            const line = text.slice(0, chain.index).split('\n').length;
            const where = `${relative(root, file).split(sep).join('/')}:${line}`;

            const bound = BOUNDED.find((b) => b.re.test(chain.text));
            if (bound) { bounded++; continue; }

            if (BY_PARENT.test(chain.text) || BY_CALLER_LIST.test(chain.text)) byParent.push({ where, table });
            else needsWork.push({ where, table });
        }
    }
}

const pad = (s, n) => String(s).padEnd(n);

console.log(`Таблиці під наглядом: ${WATCHED_TABLES.join(', ')}`);
console.log(`Прочитано файлів: ${files.length}`);
console.log(`Запитів уже обмежених: ${bounded}\n`);

console.log(`ТРЕБА ПЕРЕПИСАТИ — ${needsWork.length}`);
if (needsWork.length === 0) console.log('  (жодного)');
for (const h of needsWork.sort((a, b) => a.where.localeCompare(b.where))) {
    console.log(`  ${pad(h.table, 22)} ${h.where}`);
}

console.log(`\nОБМЕЖЕНІ БАТЬКІВСЬКИМ КЛЮЧЕМ — ${byParent.length}`);
console.log('  Не ліміт їх тримає, а дані. Переглядати варто тоді, коли в одного');
console.log('  батька рядків може стати понад тисячу: саме так один діалог із 3 021');
console.log('  повідомленням показувався третиною.');
for (const h of byParent.sort((a, b) => a.where.localeCompare(b.where))) {
    console.log(`  ${pad(h.table, 22)} ${h.where}`);
}

console.log('\nПравило — гоча 14 в CLAUDE.md. Розбір — docs/unpaginated-queries.md.');
process.exit(needsWork.length > 0 ? 1 : 0);
