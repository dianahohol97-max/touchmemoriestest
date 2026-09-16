#!/usr/bin/env node
/**
 * Хибні зіставлення товарів сайту з позиціями KeyCRM.
 *
 * Навіщо. Прив'язка живе в `keycrm_product_map`, і з неї в довідник сайту
 * приїжджає собівартість. Помилка в парі не ламає нічого видимого: сторінка
 * працює, замовлення оформлюється, а в звіті просто стоїть чуже число.
 *
 * 16.09.2026 таких пар знайшлося дві, і обидві випадково. Картридж Instax був
 * прив'язаний до камери Instax mini 12 — нечіткий збіг назви з оцінкою 0,71,
 * який хтось підтвердив, — і в довідник сайту приїхала собівартість 3 450 ₴
 * при ціні картриджа 1 059 ₴. Цифрова фоторамка за 2 400 ₴ була прив'язана до
 * фотопазлів за 349 ₴, вручну, і носила їхню собівартість 140 ₴.
 *
 * Запуск:  node scripts/catalogue-mapping-audit.mjs
 * Потрібні NEXT_PUBLIC_SUPABASE_URL і SUPABASE_SERVICE_ROLE_KEY, бо перевірка
 * читає дані, а не код — на відміну від двох сусідніх скриптів.
 *
 * Код повернення 1, якщо знайдено бодай одну пару з першої групи.
 *
 * Поточний розбір — docs/catalogue-mapping.md.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Немає доступу до бази: задайте NEXT_PUBLIC_SUPABASE_URL і SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(2);
}

/**
 * У скільки разів ціни двох товарів мають розійтися, щоб вважати спільну
 * позицію помилкою.
 *
 * Поріг два, і взятий він не зі стелі. Спільна позиція CRM на кілька товарів
 * сайту — річ нормальна: преміум-фотокнига в CRM одна на три обкладинки
 * (тканина, шкірзамінник, велюр), наклейки одні на три кольори. Заміряно
 * 16.09.2026: таких законних груп 93, і в КОЖНІЙ ціни товарів однакові, тобто
 * розкид рівно 1,00. Помилкова пара з фоторамкою давала 6,9.
 *
 * Тобто між законним 1,0 і порогом 2,0 лежить чистий запас. Якщо колись
 * з'явиться законна група з різними цінами — підняти поріг легше, ніж
 * пояснювати пропущену помилку.
 */
const PRICE_SPREAD_ALARM = 2;

/** Нижче цієї оцінки автоматичний збіг назви — здогад, а не факт. */
const WEAK_SCORE = 0.8;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
});

/** Усі рядки таблиці, сторінками: гоча 14, і map росте разом із каталогом. */
async function fetchAll(table, columns) {
    const pageSize = 1000;
    const rows = [];
    for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
            .from(table)
            .select(columns)
            .order('id', { ascending: true })
            .range(from, from + pageSize - 1);
        if (error) {
            console.error(`Не вдалося прочитати ${table}: ${error.message}`);
            process.exit(2);
        }
        rows.push(...(data || []));
        if (!data || data.length < pageSize) break;
    }
    return rows;
}

const [mappings, products] = await Promise.all([
    fetchAll('keycrm_product_map', 'id, site_slug, site_product_name, keycrm_offer_id, keycrm_name, keycrm_price, keycrm_cost_price, match_type, match_score, confirmed'),
    fetchAll('products', 'id, slug, name, price, cost_price'),
]);

const productBySlug = new Map(products.map(p => [p.slug, p]));
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

// ── 1. Одна позиція CRM на товари з дуже різною ціною ───────────────────────
const byOffer = new Map();
for (const row of mappings) {
    if (!row.confirmed || !row.keycrm_offer_id) continue;
    const product = productBySlug.get(row.site_slug);
    const price = num(product?.price);
    if (!price || price <= 0) continue;

    const key = String(row.keycrm_offer_id);
    const group = byOffer.get(key) || { offer: key, name: row.keycrm_name || '', items: new Map() };
    group.items.set(row.site_slug, { name: product.name, price });
    byOffer.set(key, group);
}

const priceConflicts = [];
for (const group of byOffer.values()) {
    if (group.items.size < 2) continue;
    const prices = [...group.items.values()].map(i => i.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min > 0 && max / min >= PRICE_SPREAD_ALARM) {
        priceConflicts.push({ ...group, spread: max / min, min, max });
    }
}

// ── 2. Собівартість більша за ціну товару ──────────────────────────────────
const costOverPrice = [];
for (const product of products) {
    const price = num(product.price);
    const cost = num(product.cost_price);
    if (!price || price <= 0 || !cost || cost <= 0) continue;
    if (cost > price) costOverPrice.push({ ...product, ratio: cost / price });
}

// ── 3. Слабкий нечіткий збіг, який хтось підтвердив ────────────────────────
const weakConfirmed = mappings
    .filter(row => row.confirmed
        && String(row.match_type || '').startsWith('fuzzy')
        && num(row.match_score) !== null
        && num(row.match_score) < WEAK_SCORE)
    .sort((a, b) => num(a.match_score) - num(b.match_score));

// ── Вивід ──────────────────────────────────────────────────────────────────
const money = (v) => `${Math.round(v).toLocaleString('uk-UA')} ₴`;

console.log(`Прочитано прив'язок: ${mappings.length}, товарів: ${products.length}`);
console.log(`Поріг розбіжності цін: ${PRICE_SPREAD_ALARM}×, слабка оцінка: нижче ${WEAK_SCORE}\n`);

console.log(`ОДНА ПОЗИЦІЯ CRM НА ТОВАРИ З РІЗНОЮ ЦІНОЮ — ${priceConflicts.length}`);
console.log('  Саме так виглядали обидві знайдені помилки: чужа позиція приносить');
console.log('  чужу собівартість, і в звіті стоїть неправильне число.');
if (priceConflicts.length === 0) console.log('  (жодної)');
for (const c of priceConflicts.sort((a, b) => b.spread - a.spread)) {
    console.log(`  offer ${c.offer} «${c.name}» — розкид ${c.spread.toFixed(1)}×, від ${money(c.min)} до ${money(c.max)}`);
    for (const [slug, item] of c.items) console.log(`      ${item.name} (${slug}) — ${money(item.price)}`);
}

console.log(`\nСОБІВАРТІСТЬ БІЛЬША ЗА ЦІНУ — ${costOverPrice.length}`);
console.log('  Товар, який продається дешевше за закупівлю, буває — розпродаж чи');
console.log("  стара ціна, — але частіше це слід чужої прив'язки.");
if (costOverPrice.length === 0) console.log('  (жодного)');
for (const p of costOverPrice.sort((a, b) => b.ratio - a.ratio)) {
    console.log(`  ${p.name} (${p.slug}) — ціна ${money(p.price)}, собівартість ${money(p.cost_price)}, це ${p.ratio.toFixed(1)}× ціни`);
}

console.log(`\nСЛАБКИЙ НЕЧІТКИЙ ЗБІГ, ПІДТВЕРДЖЕНИЙ ЛЮДИНОЮ — ${weakConfirmed.length}`);
console.log('  Оцінка нижче 0,8 означає, що назви збіглися приблизно. Підтвердження');
console.log('  знімає питання лише тоді, коли людина справді дивилася на пару.');
if (weakConfirmed.length === 0) console.log('  (жодного)');
for (const row of weakConfirmed) {
    console.log(`  ${Number(row.match_score).toFixed(2)}  ${row.site_product_name} → «${row.keycrm_name}»`);
}

console.log('\nЧОГО ЦЕЙ СКРИПТ НЕ ЛОВИТЬ');
console.log("  Ручні прив'язки без оцінки — а їх 530, і саме такою була фоторамка.");
console.log('  Оцінки в них немає за побудовою, тож перевірити пару можна лише очима');
console.log('  або непрямою ознакою, як у першій групі.');
console.log('  Пару, де обидва товари коштують приблизно однаково: розкид нижчий за');
console.log('  поріг, і помилка виглядає як норма.');
console.log("  Товар, якого немає в CRM узагалі: порожня прив'язка не є помилкою, і");
console.log('  скрипт про неї мовчить.');
console.log('  Застарілу собівартість: якщо число менше за ціну, воно виглядає');
console.log('  правдоподібно, хоч би скільки років йому було. Це до виробництва.');
console.log('\nРозбір — docs/catalogue-mapping.md.');

process.exit(priceConflicts.length > 0 ? 1 : 0);
