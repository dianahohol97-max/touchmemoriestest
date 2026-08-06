/**
 * Пошук пошти ліда на його ж сайті (Diana, 2026-08-06: «в жодного ліда не
 * показує емейла, а для мене емейли найважливіші»).
 *
 * Google Places не віддає пошту взагалі — такого поля в їхньому API не існує,
 * тому зібрані з Google контакти приходять із телефоном і сайтом. Але пошта
 * майже завжди опублікована на самому сайті: у підвалі, на сторінці контактів
 * або в посиланні mailto. Цей модуль її звідти дістає.
 *
 * Ходимо лише по публічних сторінках і беремо лише те, що бізнес сам виклав
 * для звʼязку.
 */

const UA = 'Mozilla/5.0 (compatible; TouchMemoriesBot/1.0; +https://touchmemories.com.ua)';

/** Сторінки, де контакти лежать найчастіше. Пробуємо після головної. */
const CONTACT_PATHS = ['/contacts', '/contact', '/kontakty', '/kontakti', '/about', '/pro-nas'];

/**
 * Розширення файлів, які регулярка ловить як «домен»: logo@2x.png виглядає як
 * пошта, якщо не відсікти. Це найчастіше джерело сміття.
 */
const FILE_TLDS = /\.(png|jpe?g|webp|gif|svg|css|js|ico|woff2?|ttf|mp4|pdf)$/i;

/** Технічні адреси, які нічого не дають менеджеру. */
const JUNK_PATTERNS = [
  /@sentry\./i, /@wixpress\.com$/i, /@sentry\.wixpress/i, /@example\./i,
  /@domain\./i, /@email\./i, /@yourdomain/i, /@site\./i, /@test\./i,
  /^no-?reply@/i, /^donotreply@/i, /^postmaster@/i, /^abuse@/i,
  /^u003e/i, /\.(png|jpg|gif)@/i,
];

/** Префікси, які майже завжди і є контактною поштою бізнесу. */
const GOOD_PREFIXES = ['info', 'hello', 'contact', 'office', 'mail', 'studio', 'order', 'sales', 'booking', 'admin'];

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export function extractEmails(html: string): string[] {
  const found = new Set<string>();

  // mailto — найнадійніше джерело: бізнес сам поставив це посилання.
  const mailtoRe = /mailto:([^"'?\s>]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = mailtoRe.exec(html))) {
    const raw = decodeURIComponent(m[1] || '').trim().toLowerCase();
    if (raw.includes('@')) found.add(raw);
  }

  (html.match(EMAIL_RE) || []).forEach(e => found.add(e.trim().toLowerCase()));

  return [...found].filter(isPlausibleEmail);
}

export function isPlausibleEmail(email: string): boolean {
  if (!email || email.length > 120 || (email.match(/@/g) || []).length !== 1) return false;
  if (FILE_TLDS.test(email)) return false;
  if (JUNK_PATTERNS.some(p => p.test(email))) return false;
  const [local, domain] = email.split('@');
  if (!local || !domain || local.length > 64) return false;
  // Домен без крапки або з крапкою в кінці — це уламок розмітки, не адреса.
  if (!domain.includes('.') || domain.endsWith('.') || domain.startsWith('.')) return false;
  return true;
}

/**
 * Яку з кількох знайдених адрес узяти. Спершу ту, що на домені самого сайту —
 * чужі адреси на сторінці зазвичай належать розробнику або сервісу підтримки.
 * Далі — за впізнаваним префіксом, і лише потім будь-яку.
 */
export function pickBestEmail(emails: string[], siteHost: string): string | null {
  if (emails.length === 0) return null;
  const host = siteHost.replace(/^www\./i, '').toLowerCase();
  const rootDomain = host.split('.').slice(-2).join('.');

  const score = (email: string) => {
    const domain = email.split('@')[1] || '';
    const local = email.split('@')[0] || '';
    let s = 0;
    if (domain === host || domain === `www.${host}`) s += 100;
    else if (domain.endsWith(rootDomain)) s += 80;
    if (GOOD_PREFIXES.includes(local)) s += 30;
    else if (GOOD_PREFIXES.some(p => local.startsWith(p))) s += 15;
    // Пошта на безкоштовному сервісі — нормальна для малого бізнесу, але
    // поступається власному домену.
    if (/@(gmail|ukr\.net|i\.ua|meta\.ua|outlook|hotmail|yahoo|icloud)\./i.test(email)) s += 10;
    return s;
  };

  return [...emails].sort((a, b) => score(b) - score(a))[0] || null;
}

async function fetchText(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    if (!type.includes('html') && !type.includes('text')) return null;
    // Досить перших 600 КБ: контакти лежать у підвалі, а не в кінці великих
    // сторінок з галереями.
    const text = await res.text();
    return text.slice(0, 600_000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function normalizeSiteUrl(raw: string): URL | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  try {
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
}

/**
 * Знайти пошту на сайті ліда. Спершу головна, і лише якщо там нічого — типові
 * сторінки контактів, максимум дві, щоб один повільний сайт не зʼїв увесь час
 * запиту.
 */
export async function findEmailOnSite(
  website: string,
  opts: { timeoutMs?: number; maxExtraPages?: number } = {},
): Promise<{ email: string | null; checkedPages: number }> {
  const timeoutMs = opts.timeoutMs ?? 8000;
  const maxExtra = opts.maxExtraPages ?? 2;

  const base = normalizeSiteUrl(website);
  if (!base) return { email: null, checkedPages: 0 };

  let checkedPages = 0;

  const html = await fetchText(base.toString(), timeoutMs);
  checkedPages += 1;
  if (html) {
    const best = pickBestEmail(extractEmails(html), base.hostname);
    if (best) return { email: best, checkedPages };
  }

  for (const path of CONTACT_PATHS.slice(0, maxExtra)) {
    const pageHtml = await fetchText(new URL(path, base).toString(), timeoutMs);
    checkedPages += 1;
    if (!pageHtml) continue;
    const best = pickBestEmail(extractEmails(pageHtml), base.hostname);
    if (best) return { email: best, checkedPages };
  }

  return { email: null, checkedPages };
}
