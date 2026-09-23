/**
 * Сторож шрифтів друкованого аркуша — чисте правило.
 *
 * Навіщо. Аркуш для друку знімає headless Chromium на Railway, і шрифти качає
 * він сам. Єдина перевірка перед знімком була `await document.fonts.ready`, а
 * вона не означає «шрифти на місці»: вона означає «завантаження, яке йшло,
 * закінчилося», і резолвиться однаково — і коли файл приїхав, і коли він упав.
 * Виміряно в тому самому Chromium, що працює на Railway: якщо таблиця стилів
 * не доїхала зовсім, `document.fonts` порожній, а `document.fonts.check()` для
 * будь-якої родини відповідає `true`, бо фолбек-шрифт «завантажений». Тобто ні
 * наявна перевірка, ні очевидна наступна не ловлять нічого. У другому досліді
 * впала САМЕ кирилична підмножина при живій латинській: одна грань `error`,
 * сусідня `loaded`, і аркуш виходить наполовину авторським, наполовину
 * системним. Клієнт цього не побачить до самої друкарні.
 *
 * Що робить це правило. Воно дивиться не на родини, а на СИМВОЛИ: для кожного
 * знака, набраного на аркуші, питає, чи є грань тієї родини, яка його покриває,
 * і чи вона справді `loaded`. Інакше кажучи, «шрифт завантажився» — це не «файл
 * прийшов», а «прийшов той файл, у якому лежать ці літери».
 *
 * Чотири висновки, і два з них зупиняють аркуш:
 *
 *   • `css-missing` — родина є в нашому пакеті, але в документі немає жодної її
 *     грані. Наш CSS не доїхав. ЗУПИНЯЄ, бо друга спроба це лікує.
 *   • `not-loaded` — грань оголошена, покриває ці символи, але її статус не
 *     `loaded`. Файл не доїхав. ЗУПИНЯЄ з тієї ж причини.
 *   • `unknown-family` — макет просить родину, якої в пакеті немає взагалі
 *     (Georgia зі старої панелі, Kyiv Type Sans, якої Google не віддає). Повтор
 *     не допоможе ніколи, тож це ЗВІТ, а не зупинка.
 *   • `no-glyphs` — родина наша, але гліфів для цих символів немає ніде
 *     (кирилиця в Lato чи Poppins, емодзі в підписі). Теж ЗВІТ: відмова зробила
 *     б такі макети недрукованими назавжди, а полагодити їх можна лише іншим
 *     шрифтом у самому макеті.
 *
 * ЦЕ ДЗЕРКАЛО. Та сама логіка живе в `render-service/server.ts` — сервіс
 * збирається окремим Docker-образом, який копіює тільки `server.ts` і
 * `tsconfig.json`, тож імпортувати звідси він не може. Той самий візерунок, що
 * вже стоїть на `pageHasContent` із `lib/print/forzat-expectation.ts`. Тести
 * тут (`tests/font-audit.test.ts`) пиняють обидві копії: міняючи одну, міняй
 * другу, бо розбіжність означає або мовчазну підміну шрифта в друці, або
 * зупинений рендер справного макета.
 */

/** Стан грані так, як його віддає FontFaceSet. */
export type FaceStatus = 'unloaded' | 'loading' | 'loaded' | 'error';

/** Одна `@font-face`, зібрана зі сторінки. */
export interface DeclaredFace {
    family: string;
    status: FaceStatus;
    /** Рядок `unicode-range` як у CSS; порожній означає «покриває все». */
    unicodeRange: string;
}

/** Родина і символи, набрані нею на цьому аркуші. */
export interface UsedFont {
    family: string;
    /** Увесь текст, набраний цією родиною; повтори значення не мають. */
    text: string;
}

export type FontProblemKind = 'css-missing' | 'not-loaded' | 'unknown-family' | 'no-glyphs';

export interface FontProblem {
    kind: FontProblemKind;
    family: string;
    /** Символи, яких це стосується, без повторів і в порядку появи. */
    chars: string;
}

/**
 * Назви, які не є шрифтом: узагальнені сімейства CSS і системні псевдоніми.
 * Макет, який просить `serif`, просить не конкретне накреслення, а «хай браузер
 * обере», і питати з нього нічого.
 */
const GENERIC_FAMILIES = new Set([
    'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
    'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji',
    'fangsong', 'inherit', 'initial', 'revert', 'unset', '',
]);

/** Назва родини в порівнюваному вигляді: без лапок, без зайвих пробілів, без регістру. */
export function normalizeFamily(name: string): string {
    return String(name ?? '')
        .trim()
        .replace(/^['"]|['"]$/g, '')
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

/** Чи це узагальнене сімейство, з якого нема чого питати. */
export function isGenericFamily(name: string): boolean {
    return GENERIC_FAMILIES.has(normalizeFamily(name));
}

/**
 * `unicode-range` у пари чисел.
 *
 * Google віддає прості форми — `U+0301`, `U+0400-045F`, — але CSS дозволяє ще
 * й шаблон `U+4??`, і він тут розгортається чесно, бо грань із шаблоном покриває
 * цілий блок, і вважати інакше означало б зупиняти справний аркуш.
 *
 * Порожній рядок віддає один діапазон на весь простір: саме так поводиться
 * грань без `unicode-range`, і саме тому така грань перекриває решту підмножин
 * тієї ж родини.
 */
export function parseUnicodeRange(spec: string): Array<[number, number]> {
    const text = String(spec ?? '').trim();
    if (!text) return [[0, 0x10ffff]];
    const out: Array<[number, number]> = [];
    for (const piece of text.split(',')) {
        const token = piece.trim().replace(/^u\+/i, '');
        if (!token) continue;
        if (token.includes('-')) {
            const [a, b] = token.split('-');
            const lo = parseInt(a, 16);
            const hi = parseInt(b, 16);
            if (Number.isFinite(lo) && Number.isFinite(hi)) out.push([lo, hi]);
            continue;
        }
        if (token.includes('?')) {
            const lo = parseInt(token.replace(/\?/g, '0'), 16);
            const hi = parseInt(token.replace(/\?/g, 'F'), 16);
            if (Number.isFinite(lo) && Number.isFinite(hi)) out.push([lo, hi]);
            continue;
        }
        const one = parseInt(token, 16);
        if (Number.isFinite(one)) out.push([one, one]);
    }
    return out;
}

/** Чи покриває набір діапазонів цей кодпоінт. */
export function rangesCover(ranges: Array<[number, number]>, cp: number): boolean {
    for (const [lo, hi] of ranges) if (cp >= lo && cp <= hi) return true;
    return false;
}

/**
 * Символи, з яких нема чого питати.
 *
 * Пробіли, переноси і м'який перенос малюються нічим, і вимагати для них гліф
 * означало б валити аркуш через звичайний пробіл у родині без пробілу в
 * підмножині. Селектор варіації і ZWJ — службові знаки емодзі-послідовностей.
 */
function isIgnorableCodePoint(cp: number): boolean {
    return cp === 0x20 || cp === 0x09 || cp === 0x0a || cp === 0x0d
        || cp === 0xa0 || cp === 0xad || cp === 0x200b || cp === 0x200d
        || cp === 0xfe0e || cp === 0xfe0f || cp === 0xfeff;
}

/** Висновок зупиняє аркуш, чи лише йде у звіт. */
export function isBlockingProblem(kind: FontProblemKind): boolean {
    return kind === 'css-missing' || kind === 'not-loaded';
}

/**
 * Головне правило.
 *
 * `packFamilies` — перелік родин, які МИ зобов'язані віддати (те, що зібрав
 * `scripts/build-editor-fonts.py`). Саме він відрізняє «наш файл не доїхав» від
 * «такої родини в нас ніколи не було»: перше лікується повтором, друге — ні, і
 * плутати їх означало б або вічно валити два старі макети з Georgia, або мовчки
 * друкувати книжку не тим шрифтом.
 */
export function auditSheetFonts(
    used: UsedFont[],
    declared: DeclaredFace[],
    packFamilies: string[],
): FontProblem[] {
    const pack = new Set(packFamilies.map(normalizeFamily));

    // Грані родини разом із розібраним діапазоном — розбираємо один раз на
    // грань, а не один раз на символ: на форзаці з довгим текстом це різниця
    // між сотнями і сотнями тисяч розборів.
    const byFamily = new Map<string, Array<{ status: FaceStatus; ranges: Array<[number, number]> }>>();
    for (const face of declared) {
        const key = normalizeFamily(face.family);
        if (!byFamily.has(key)) byFamily.set(key, []);
        byFamily.get(key)!.push({ status: face.status, ranges: parseUnicodeRange(face.unicodeRange) });
    }

    const problems: FontProblem[] = [];

    for (const item of used) {
        const family = String(item.family ?? '').trim().replace(/^['"]|['"]$/g, '');
        if (!family || isGenericFamily(family)) continue;
        const key = normalizeFamily(family);
        const faces = byFamily.get(key) || [];

        const record = (kind: FontProblemKind, chars: string) => {
            if (!chars) return;
            const dedupe = `${kind}\u0000${key}`;
            const existing = problems.find(p => `${p.kind}\u0000${normalizeFamily(p.family)}` === dedupe);
            if (existing) {
                const merged = existing.chars + chars;
                existing.chars = [...new Set([...merged])].join('');
                return;
            }
            problems.push({ kind, family, chars });
        };

        if (faces.length === 0) {
            // Жодної грані. Або не доїхав наш CSS, або родини в нас і не було.
            const kind: FontProblemKind = pack.has(key) ? 'css-missing' : 'unknown-family';
            record(kind, distinctPrintable(item.text));
            continue;
        }

        const notLoaded: string[] = [];
        const noGlyphs: string[] = [];
        const checked = new Set<number>();
        for (const ch of String(item.text ?? '')) {
            const cp = ch.codePointAt(0)!;
            if (isIgnorableCodePoint(cp) || checked.has(cp)) continue;
            checked.add(cp);
            let covered = false;
            let loaded = false;
            for (const face of faces) {
                if (!rangesCover(face.ranges, cp)) continue;
                covered = true;
                if (face.status === 'loaded') { loaded = true; break; }
            }
            if (loaded) continue;
            if (covered) notLoaded.push(ch);
            else noGlyphs.push(ch);
        }
        record('not-loaded', notLoaded.join(''));
        record('no-glyphs', noGlyphs.join(''));
    }

    // Спершу те, що зупиняє: у повідомленні про невдалий аркуш першим має
    // стояти те, через що він невдалий.
    return problems.sort((a, b) => Number(isBlockingProblem(b.kind)) - Number(isBlockingProblem(a.kind)));
}

function distinctPrintable(text: string): string {
    const out: string[] = [];
    const seen = new Set<number>();
    for (const ch of String(text ?? '')) {
        const cp = ch.codePointAt(0)!;
        if (isIgnorableCodePoint(cp) || seen.has(cp)) continue;
        seen.add(cp);
        out.push(ch);
    }
    return out.join('');
}

/** Перші кілька символів у лапках — щоб причина називала, що саме не намалювалося. */
function sampleOf(chars: string): string {
    const list = [...chars];
    const head = list.slice(0, 8).join('');
    return list.length > 8 ? `«${head}…»` : `«${head}»`;
}

/**
 * Як назвати символи, яких бракує.
 *
 * Перша спроба друкувала сам набір різних символів, і виходило «Старпнел…» —
 * на вигляд одруківка, а не діагноз. Майже завжди це ціла писемність, тож її і
 * називаємо; мішанину показуємо як є, бо тоді доведеться дивитися очима.
 */
function describeChars(chars: string): string {
    const list = [...chars];
    if (!list.length) return 'частина тексту';
    const isCyr = (c: string) => /[\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F]/.test(c);
    const isLat = (c: string) => /[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/.test(c);
    // Дивимося тільки на ЛІТЕРИ: цифри, розділові знаки і пробіли є в кожній
    // підмножині й нічого не кажуть про писемність. Літера, яка не належить до
    // жодної з двох — грецька, іврит, ієрогліф — одразу повертає нас до
    // переліку символів, бо назвати таку мішанину одним словом чесно не вийде.
    const letters = list.filter(c => /\p{L}/u.test(c));
    if (!letters.length) return `символи ${sampleOf(chars)}`;
    if (letters.every(isCyr)) return 'кирилиця';
    if (letters.every(isLat)) return 'латиниця';
    return `символи ${sampleOf(chars)}`;
}

/**
 * Причина, яку бачить людина. Формулювання дослівне з вимоги: аркуш, який не
 * зібрався через шрифт, має називати шрифт, а не «рендер не вдався».
 */
export function describeFontProblem(problem: FontProblem): string {
    switch (problem.kind) {
        case 'css-missing':
            return `шрифт не завантажився: ${problem.family} — сторінка не отримала жодної його грані`;
        case 'not-loaded':
            return `шрифт не завантажився: ${problem.family} — не приїхав файл, у якому ${describeChars(problem.chars)}`;
        case 'unknown-family':
            return `шрифт ${problem.family} не входить у наш набір — ${describeChars(problem.chars)} надрукується системним шрифтом`;
        case 'no-glyphs':
            return `шрифт ${problem.family} не має гліфів — ${describeChars(problem.chars)} надрукується іншим шрифтом`;
    }
}

/** Рядок для помилки аркуша: лише те, що зупиняє, через «;». */
export function blockingFontReason(problems: FontProblem[]): string | null {
    const blocking = problems.filter(p => isBlockingProblem(p.kind));
    if (!blocking.length) return null;
    return blocking.map(describeFontProblem).join('; ');
}

/** Рядок для журналу і колбеку: те, що не зупиняє, але має бути названим. */
export function reportedFontNotes(problems: FontProblem[]): string[] {
    return problems.filter(p => !isBlockingProblem(p.kind)).map(describeFontProblem);
}
