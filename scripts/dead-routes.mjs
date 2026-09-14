#!/usr/bin/env node
/**
 * Маршрути в app/api, на які ніхто не посилається.
 *
 * Привід: 14.09.2026 прив'язку гостьових замовлень вставили в
 * /api/auth/register, і вона не спрацювала жодного разу, бо той маршрут не
 * викликав ніхто. Виявилося це лише тоді, коли пішли рахувати результат.
 *
 * Запуск:  node scripts/dead-routes.mjs
 *
 * Нульова кількість згадувань ще не означає «видаляй». Маршрут можуть смикати
 * ззовні — Make.com, ManyChat, робот Google, закладка менеджера. Розбір і
 * поточний список живуть у docs/dead-routes.md, цей скрипт лише перезаміряє.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve, sep } from 'node:path';

const ROOT = resolve(process.cwd());
const SKIP = new Set(['node_modules', '.next', '.git', 'dist', 'build', '.vercel']);
const SOURCE = /\.(ts|tsx|js|jsx|mjs|json|md|sql|sh|ya?ml)$/;

/**
 * Файл, який перелічує самі ці маршрути, згадкою не рахується — інакше він
 * обнуляв би власний список.
 */
const SELF = ['docs/dead-routes.md'];

function walk(dir, out = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (SKIP.has(entry.name)) continue;
            walk(join(dir, entry.name), out);
        } else {
            out.push(join(dir, entry.name));
        }
    }
    return out;
}

const all = walk(ROOT);

const routes = all
    .filter((p) => /route\.(ts|tsx|js)$/.test(p) && p.includes(`${sep}app${sep}api${sep}`))
    .map((p) => ({ file: p, path: '/' + relative(join(ROOT, 'app'), dirname(p)).split(sep).join('/') }));

const corpus = all
    .filter((p) => SOURCE.test(p))
    .filter((p) => !SELF.some((self) => p.endsWith(self.split('/').join(sep))))
    .map((p) => ({ file: p, dir: dirname(p), text: readFileSync(p, 'utf8') }));

/** Динамічний сегмент обрізається: /api/x/[id]/y шукається як /api/x/. */
const needle = (routePath) => {
    const i = routePath.indexOf('/[');
    return i === -1 ? routePath : routePath.slice(0, i + 1);
};

const dead = [];
for (const route of routes) {
    const n = needle(route.path);
    const own = dirname(route.file);
    // Згадування всередині власної теки маршруту не рахуються: коментар у
    // самому файлі — це не виклик.
    const hits = corpus.filter((c) => c.dir !== own && c.text.includes(n));
    if (hits.length === 0) dead.push(route.path);
}

console.log(`Маршрутів усього: ${routes.length}`);
console.log(`Без жодного згадування поза власною текою: ${dead.length}`);
for (const p of dead.sort()) console.log('  ' + p);
console.log('\nСписок сирий. Згадка в ARCHITECTURE.md або в коментарі до міграції');
console.log('тут рахується як згадка, хоча викликом не є, тож живий маршрут може');
console.log('у список не потрапити. Розбір і поточні висновки — docs/dead-routes.md.');
