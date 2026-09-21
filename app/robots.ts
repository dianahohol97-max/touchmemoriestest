import { MetadataRoute } from 'next';
import { getBaseUrl } from '@/lib/seo/locales';

/**
 * Приватні розділи, закриті від КОЖНОГО робота.
 *
 * Список винесено в константу, бо груп у robots.txt тепер дві: спільна «*» і
 * поіменна для ШІ-краулерів. Робот читає рівно ОДНУ групу — найточнішу за
 * назвою, — і решту ігнорує повністю. Тобто група `User-agent: GPTBot` з самим
 * лише `Allow: /` не додала б до спільних заборон нічого, а скасувала б їх усі:
 * GPTBot пішов би в /admin/, /account/ і в токенні сторінки з чужими фото.
 * Тому обидві групи віддають той самий перелік, і додавати заборону треба
 * тільки сюди.
 */
const DISALLOW = [
  '/admin/',
  '/api/',
  '/account/',
  '/checkout/',
  '/dyakuiemo',
  '/order/',
  '/review/',
  // Locale-prefixed variants (pages live under /uk, /en, /ro, /pl, /de)
  '/*/account',
  '/*/checkout',
  '/*/order',
  '/*/review',
  '/*/dyakuiemo',
  // Wishlist and order tracking — personal, no SEO value
  '/*/wishlist',
  '/*/track',
  // Catalog/blog with query params — canonical already handles these,
  // but disallowing prevents Google spending crawl budget on duplicates
  '/*/catalog?*',
  '/*/blog?*',
  // Blog tag pages — thin content, no direct SEO value
  '/*/blog/tag/*',
  // Private token pages: client photo galleries and photographer
  // cabinets (both also noindex). Public landings /*/photographer/{slug}
  // stay crawlable.
  '/*/gallery/',
  '/*/photographer/cabinet/',
  // Other token/personal pages (all also carry a noindex meta): design
  // briefs, partner cabinets, and the magazine-text brief.
  '/*/brief/',
  '/*/partner/',
  '/*/magazine-brief/',
  // Private authoring surface (also noindex).
  '/*/editor',
  // Весільні сторінки гостей: приватні фото, захищені лише тим, що
  // адресу не вгадати. Сторінка несе noindex, у sitemap її немає, і
  // тут стоїть та сама заборона, що й для галерей та брифів вище.
  // Сам слаг у robots.txt не потрапляє — лише спільний префікс.
  '/wedding/',
];

/**
 * Краулери, якими ШІ-асистенти читають сайт.
 *
 * НАВІЩО ПОІМЕНУВАТИ, якщо спільне правило їх і так не блокує. Мовчазний
 * дозвіл і свідомий дозвіл виглядають однаково лише для робота, але не для
 * людини: коли наступного разу хтось закриватиме сайт від скраперів одним
 * рядком, поіменна група покаже, що ці дев’ять заходять сюди навмисно.
 *
 * Окремо про партнерські сторінки. У переліку заборон вище є рядок з
 * «partner» зі скісною рискою на кінці — він закриває токенні кабінети
 * партнерів. Лендінги партнерської програми живуть за іншими адресами
 * (/partnery, /partnerska-programa-dlya-blogeriv,
 * /partnerska-programa-dlya-turagentstv), під цей шаблон не підпадають і
 * лишаються відкритими для всіх дев’яти. Саме ці сторінки ШІ-системи й
 * мають читати, разом з каталогом тревелбуків і журналів.
 *
 * Google-Extended — не краулер, а позначка для Gemini та AI Overviews: свого
 * обходу він не робить, лише дозволяє чи забороняє використання вже зібраного
 * Googlebot. Тому він тут разом з рештою.
 */
const AI_CRAWLERS = [
  'GPTBot',        // OpenAI — навчання і пошук ChatGPT
  'ChatGPT-User',  // OpenAI — перехід за посиланням на запит користувача
  'OAI-SearchBot', // OpenAI — індекс пошуку ChatGPT
  'PerplexityBot', // Perplexity
  'ClaudeBot',     // Anthropic — обхід для Claude
  'Claude-Web',    // Anthropic — застаріла назва, лишається для сумісності
  'anthropic-ai',  // Anthropic — застаріла назва, лишається для сумісності
  'Google-Extended', // Gemini та AI Overviews
  'CCBot',         // Common Crawl — джерело даних для багатьох моделей
];

export default function robots(): MetadataRoute.Robots {
  const base = getBaseUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOW,
      },
      {
        // Масив у userAgent Next віддає кількома рядками `User-agent:` над
        // однією групою правил — це і є спосіб описати спільні умови для
        // кількох роботів, не дублюючи перелік заборон дев'ять разів.
        userAgent: AI_CRAWLERS,
        allow: '/',
        disallow: DISALLOW,
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
