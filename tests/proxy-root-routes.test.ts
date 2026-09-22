import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Кожен кореневий маршрут має бути виключений із локального префікса.
 *
 * ІСТОРІЯ, ЯКА ПОВТОРИЛАСЯ ДВІЧІ. `proxy.ts` дописує до адреси код мови, а
 * виключення тримає списком префіксів. Кореневий файл, якого в тому списку
 * немає, їде на `/uk/<шлях>`, де маршруту не існує, і сайт віддає 404.
 *
 * 21.09.2026 так два місяці лежав `llms.txt`: асистенти отримували 307 і
 * слідом 404 замість картки сайту. У коментарі поруч тоді написали, що
 * наступний кореневий файл доведеться дописати так само.
 *
 * 22.09.2026 це сталося слово в слово: разом із блогом приїхали
 * `/blog-sitemap.xml` та `/indexnow-key.txt`, і жоден не потрапив у список.
 * `/sitemap-index.xml` урятувався випадково, бо починається на `/sitemap`.
 * Мапу блогу `robots.txt` називав роботам, а вона відповідала 404.
 *
 * Коментар не спрацював двічі поспіль, тому тепер тут стоїть перевірка.
 * Помилка мовчазна: код є, маршрут є, збірка проходить, і видно її лише
 * запитом ззовні — тобто тоді, коли її вже побачив робот.
 */

/** Папки в `app/`, які віддають кореневу адресу: `app/<назва>/route.ts`. */
function rootRoutes(): string[] {
    const appDir = resolve('app');
    const found: string[] = [];

    for (const name of readdirSync(appDir)) {
        // `[locale]` — це локалізовані сторінки, їм префікс і потрібен.
        // `api` та `admin` уже стоять у списку окремими префіксами.
        if (name === '[locale]' || name === 'api' || name === 'admin') continue;

        const dir = join(appDir, name);
        if (!statSync(dir).isDirectory()) continue;
        if (existsSync(join(dir, 'route.ts')) || existsSync(join(dir, 'route.tsx'))) {
            found.push(`/${name}`);
        }
    }

    return found;
}

/** Префікси зі `SKIP_PREFIXES` у `proxy.ts`, прочитані з самого файлу. */
function skipPrefixes(): string[] {
    const source = readFileSync(resolve('proxy.ts'), 'utf8');
    const block = /const SKIP_PREFIXES = \[([\s\S]*?)\];/.exec(source);
    if (!block) throw new Error('у proxy.ts більше немає SKIP_PREFIXES — перевірка застаріла');

    // Рядки в лапках, але не ті, що всередині коментарів: коментарі тут
    // довгі й містять адреси в лапках, які списком не є.
    return block[1]
        .split('\n')
        .filter(line => !line.trim().startsWith('//'))
        .flatMap(line => [...line.matchAll(/'([^']+)'/g)].map(m => m[1]));
}

describe('кореневі маршрути не їдуть під код мови', () => {
    const routes = rootRoutes();
    const prefixes = skipPrefixes();

    it('маршрути знайшлися — інакше перевірка перестала щось перевіряти', () => {
        expect(routes.length).toBeGreaterThanOrEqual(4);
    });

    it('список виключень прочитався', () => {
        expect(prefixes).toContain('/api');
        expect(prefixes).toContain('/llms.txt');
    });

    it.each(routes)('%s виключений у proxy.ts', (route) => {
        const covered = prefixes.some(prefix => route.startsWith(prefix));
        expect(
            covered,
            `${route} не підпадає під жоден префікс у SKIP_PREFIXES — запит поїде на /uk${route} і віддасть 404`,
        ).toBe(true);
    });

    it('robots.txt і sitemap.xml теж під захистом', () => {
        // Вони створюються файлами `app/robots.ts` і `app/sitemap.ts`, а не
        // папкою з `route.ts`, тож у переліку вище їх немає — але зламатися
        // вони можуть так само.
        for (const path of ['/robots.txt', '/sitemap.xml']) {
            expect(prefixes.some(prefix => path.startsWith(prefix)), path).toBe(true);
        }
    });
});
