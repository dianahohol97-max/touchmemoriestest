#!/usr/bin/env node
/**
 * Ланцюги й цикли серед постійних редиректів у next.config.ts.
 *
 * Навіщо. Редирект, який веде на адресу, що сама відповідає редиректом, —
 * це два кроки замість одного: сканер витрачає вдвічі більше запитів, а вага
 * старого посилання доходить до сторінки послабленою. Цикл гірший: браузер
 * показує ERR_TOO_MANY_REDIRECTS, а Google — помилку сканування, і сторінка
 * випадає з індексу зовсім.
 *
 * На вересень 2026 в конфізі жило й те, й те. Правила про категорії вели на
 * слаг бази (`/category/photobooks`), а сторінка категорії з нього слала на
 * публічний український слаг (`/category/fotoknygy`) — ланцюг на два кроки в
 * кожному з двох десятків правил. А пара `/category/vypuskni-knyhy` →
 * `/category/graduation-books` була замкненим колом, бо сторінка повертала
 * рівно назад. Знайшли це не з журналу помилок, а очима, тож перевірку варто
 * мати автоматичну.
 *
 * Запуск:  node scripts/redirect-chains.mjs
 *
 * Код повернення 1, якщо знайдено бодай один ланцюг або цикл.
 *
 * Скрипт нічого не завантажує з мережі та з бази: він читає next.config.ts і
 * lib/seo/categorySlugs.ts як текст. Тому він бачить лише те, що описано в
 * коді, — редирект, який робить сама сторінка на підставі даних із Supabase
 * (наприклад, порожня категорія веде в каталог), сюди не потрапляє.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Максимум кроків, які проходимо, перш ніж визнати шлях циклом. */
const MAX_HOPS = 10;

/** Локалі сайту — ними підставляємо параметр :locale у прикладах. */
const SAMPLE_LOCALE = 'uk';
/** Чим підставляємо решту параметрів (:slug, :path*) у прикладі адреси. */
const SAMPLE_SEGMENT = 'zrazok';

// ─────────────────────────────────────────────────────────────────────────────
// Читання правил
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Витягує пари source/destination із тіла redirects() у next.config.ts.
 *
 * Розбираємо текстом, а не імпортом: next.config.ts — це TypeScript-модуль,
 * і node його без збірки не виконає. Формат у файлі однорідний (обʼєкти з
 * рядковими source і destination), тож регулярного виразу вистачає. Разом із
 * правилом читаємо необовʼязковий блок has: [{ type: 'query', … }], бо саме
 * він і створив був найпідступніший цикл: Next.js переносить невикористані
 * параметри запиту в призначення сам, тож правило з destination рівним
 * власному source замикається через параметр, якого в самому правилі не видно.
 */
function parseRedirects() {
  const src = readFileSync(join(ROOT, 'next.config.ts'), 'utf8');
  const start = src.indexOf('async redirects()');
  if (start === -1) throw new Error('У next.config.ts не знайдено redirects()');
  const end = src.indexOf('async headers()', start);
  const body = src.slice(start, end === -1 ? src.length : end);

  const rules = [];
  // Обʼєкт правила: від "{" до "}", що містить source і destination.
  const objectRe = /\{\s*source:\s*'([^']+)'\s*,([\s\S]*?)\}\s*,\s*(?=\{|\]|\/\/|\n)/g;
  let m;
  while ((m = objectRe.exec(body))) {
    const source = m[1];
    const rest = m[2];
    const destMatch = /destination:\s*'([^']+)'/.exec(rest);
    if (!destMatch) continue;
    const permanent = /permanent:\s*true/.test(rest);
    const queryMatch = /type:\s*'query'\s*,\s*key:\s*'([^']+)'(?:\s*,\s*value:\s*'([^']+)')?/.exec(rest);
    rules.push({
      source,
      destination: destMatch[1],
      permanent,
      query: queryMatch ? { key: queryMatch[1], value: queryMatch[2] ?? null } : null,
    });
  }
  return rules;
}

/**
 * Публічний український слаг для слага бази — рівно та мапа, за якою сторінка
 * категорії робить власний permanentRedirect. Без неї ланцюги «правило веде на
 * слаг бази, а сторінка звідти веде далі» лишаються невидимими.
 */
function parseCategoryAliases() {
  const src = readFileSync(join(ROOT, 'lib/seo/categorySlugs.ts'), 'utf8');
  const start = src.indexOf('UA_TO_DB_CATEGORY');
  const body = src.slice(start, src.indexOf('}', start));
  const dbToUa = new Map();
  const re = /'([^']+)'\s*:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(body))) dbToUa.set(m[2], m[1]);
  return dbToUa;
}

// ─────────────────────────────────────────────────────────────────────────────
// Зіставлення адреси з правилом
// ─────────────────────────────────────────────────────────────────────────────

/** Перетворює шаблон Next.js (:locale(a|b), :slug, :path*) на регулярний вираз. */
function patternToRegex(pattern) {
  const names = [];
  let out = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch !== ':') {
      out += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      i += 1;
      continue;
    }
    // :name, далі необовʼязково (варіанти) і необовʼязково * або ?
    const nameMatch = /^:([A-Za-z0-9_]+)/.exec(pattern.slice(i));
    const name = nameMatch[1];
    i += nameMatch[0].length;
    let group = '[^/]+';
    if (pattern[i] === '(') {
      let depth = 0;
      const from = i;
      while (i < pattern.length) {
        if (pattern[i] === '(') depth += 1;
        if (pattern[i] === ')') {
          depth -= 1;
          if (depth === 0) { i += 1; break; }
        }
        i += 1;
      }
      group = pattern.slice(from + 1, i - 1);
    }
    if (pattern[i] === '*') {
      // :path* покриває і порожній хвіст, і кілька сегментів. Прибираємо
      // попередню косу риску з виводу, щоб /shop/:path* ловило і саме /shop.
      out = out.replace(/\/$/, '');
      out += `(?:/(${group}(?:/${group})*))?`;
      i += 1;
    } else if (pattern[i] === '?') {
      out += `(${group})?`;
      i += 1;
    } else {
      out += `(${group})`;
    }
    names.push(name);
  }
  return { re: new RegExp(`^${out}$`), names };
}

/** Перше правило, під яке підпадає адреса, або null. */
function firstMatch(rules, location) {
  for (const rule of rules) {
    if (rule.query) {
      const got = location.query[rule.query.key];
      if (got === undefined) continue;
      if (rule.query.value !== null && got !== rule.query.value) continue;
    }
    const { re, names } = patternToRegex(rule.source);
    const m = re.exec(location.path);
    if (!m) continue;
    const params = {};
    names.forEach((name, idx) => { params[name] = m[idx + 1]; });
    return { rule, params };
  }
  return null;
}

/** Підставляє захоплені параметри в шаблон призначення. */
function fillDestination(destination, params) {
  return destination.replace(/:([A-Za-z0-9_]+)\*?/g, (whole, name) => {
    const value = params[name];
    return value === undefined || value === null ? whole : value;
  });
}

/** Приклад конкретної адреси для шаблону source. */
function sampleFor(pattern) {
  return pattern.replace(/:([A-Za-z0-9_]+)(\(([^)]*)\))?(\*|\?)?/g, (whole, name, _g, variants, mod) => {
    if (variants) return variants.split('|')[0];
    if (name === 'locale') return SAMPLE_LOCALE;
    if (mod === '?') return '';
    return SAMPLE_SEGMENT;
  }).replace(/\/+$/, '') || '/';
}

// ─────────────────────────────────────────────────────────────────────────────
// Перевірка
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  const rules = parseRedirects();
  const dbToUa = parseCategoryAliases();

  /**
   * Редирект, який робить не конфіг, а сама сторінка категорії: слаг бази
   * веде на публічний український слаг. Для перевірки ланцюгів він рівно
   * такий самий 301, як і решта.
   */
  const pageLevel = (location) => {
    const m = /^\/(uk|en|ro|pl|de)\/category\/([^/]+)(\/[^/]+)?$/.exec(location.path);
    if (!m) return null;
    const ua = dbToUa.get(m[2]);
    if (!ua || ua === m[2]) return null;
    return {
      path: `/${m[1]}/category/${ua}${m[3] || ''}`,
      why: 'category/[slug]/page.tsx: слаг бази → публічний UA-слаг',
    };
  };

  const chains = [];
  const loops = [];
  const proxyHops = [];

  /**
   * Сторінкові адреси, які proxy.ts обслуговує без префікса локалі. Усе інше,
   * що приходить без /uk|/en|/ro|/pl|/de попереду, він віддає редиректом — тож
   * призначення без локалі коштує зайвого кроку так само, як ланцюг у конфізі.
   */
  const LOCALE_FREE_OK = /^\/(api|admin|tools|wedding|_next|sitemap|robots|constructor|order)\b|\.(xml|html|js|json)$/;

  for (const rule of rules) {
    const startPath = sampleFor(rule.source);
    const startQuery = rule.query ? { [rule.query.key]: rule.query.value ?? 'x' } : {};
    const startMatch = firstMatch(rules, { path: startPath, query: startQuery });
    // Правило перекрите іншим, що стоїть вище, — це окрема хвороба, не наша.
    if (!startMatch || startMatch.rule !== rule) continue;

    // Next.js переносить у призначення ті параметри запиту, яких немає в
    // шаблоні призначення. Саме через це destination, рівний власному source,
    // дає цикл.
    let location = {
      path: fillDestination(rule.destination, startMatch.params),
      query: { ...startQuery },
    };

    const trail = [{ path: startPath, query: startQuery }];
    const seen = new Set([`${startPath}?${JSON.stringify(startQuery)}`]);

    for (let hop = 0; hop < MAX_HOPS; hop += 1) {
      const key = `${location.path}?${JSON.stringify(location.query)}`;
      if (seen.has(key)) {
        loops.push({ rule, trail: [...trail, location] });
        break;
      }
      seen.add(key);
      trail.push(location);

      const next = firstMatch(rules, location);
      if (next) {
        location = {
          path: fillDestination(next.rule.destination, next.params),
          query: { ...location.query },
        };
        continue;
      }
      const viaPage = pageLevel(location);
      if (viaPage) {
        location = { path: viaPage.path, query: { ...location.query } };
        continue;
      }
      break;
    }

    // trail[0] — вихідна адреса, trail[1] — перше призначення. Усе, що
    // довше, означає, що перше призначення саме відповідає редиректом.
    if (trail.length > 2 && !loops.some((l) => l.rule === rule)) {
      chains.push({ rule, trail });
    }

    // Останній крок без префікса локалі — це ще один редирект, уже від proxy.ts.
    const last = trail[trail.length - 1].path;
    if (last !== '/' && !/^\/(uk|en|ro|pl|de)(\/|$)/.test(last) && !LOCALE_FREE_OK.test(last)) {
      proxyHops.push({ rule, last });
    }
  }

  const fmt = (step) => {
    const q = Object.keys(step.query || {}).length
      ? `?${Object.entries(step.query).map(([k, v]) => `${k}=${v}`).join('&')}`
      : '';
    return `${step.path}${q}`;
  };

  if (loops.length) {
    console.log(`\n❌ ЦИКЛИ (${loops.length}) — браузер віддасть ERR_TOO_MANY_REDIRECTS\n`);
    for (const l of loops) {
      console.log(`  ${l.rule.source}`);
      console.log(`     ${l.trail.map(fmt).join('\n  →  ')}\n`);
    }
  }

  if (chains.length) {
    console.log(`\n⚠️  ЛАНЦЮГИ (${chains.length}) — більш ніж один крок до сторінки з кодом 200\n`);
    for (const c of chains) {
      console.log(`  ${c.rule.source}`);
      console.log(`     ${c.trail.map(fmt).join('\n  →  ')}\n`);
    }
  }

  if (proxyHops.length) {
    console.log(`\n⚠️  БЕЗ ЛОКАЛІ (${proxyHops.length}) — proxy.ts додасть ще один редирект\n`);
    for (const p of proxyHops) {
      console.log(`  ${p.rule.source}  →  ${p.last}   (треба /uk${p.last})`);
    }
    console.log('');
  }

  const total = loops.length + chains.length + proxyHops.length;
  if (total === 0) {
    console.log(`\n✅ Перевірено правил: ${rules.length}. Жодного ланцюга, циклу чи зайвого кроку.\n`);
  }
  process.exit(total === 0 ? 0 : 1);
}

main();
