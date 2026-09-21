// auto-deploy: deploy-1781697900-redeploy
const nextConfig = {
  // Disable Partial Pre-Rendering globally — admin panel must never be statically cached
  experimental: {
    ppr: false,
    // Inline critical CSS for above-the-fold content and defer the rest.
    // This eliminates render-blocking CSS chunks from the critical path.
    // Safe: Next.js 14+ feature, falls back gracefully if critters isn't installed.
    optimizeCss: true, // critters installed — inlines critical CSS, removes render-blocking chunks
    // Disable CSS chunking — merge into fewer larger files loaded in parallel
    // rather than a chain (chunk1 → chunk2 → chunk3) that blocks LCP
    cssChunking: false,
  },
  // Required for @imgly/background-removal — Turbopack config (Next.js 16+)
  turbopack: {},
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 2678400, // 31 days — product/blog images rarely change
    // Explicit device breakpoints so Next generates only the sizes actually needed.
    // Avoids generating e.g. 3840px variants for a 600px product thumbnail.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384, 600],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
      },
      {
        protocol: 'https',
        hostname: 'yivfsicvaoewxrtkrfxr.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.touchmemories.ua',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  async rewrites() {
    return [
      // Stale PWA service workers: browsers that registered a SW from an old
      // deployment keep requesting the hashed /sw.<hash>.js forever (≈25
      // 404s/day). Serve them a kill-switch script that unregisters the SW
      // and clears its caches, so those clients stop knocking.
      {
        source: '/:file(sw\\..*\\.js)',
        destination: '/api/sw-cleanup',
      },
    ];
  },
  async redirects() {
    return [
      // Старі листи про скидання пароля.
      //
      // Модалка входу до 14.09.2026 слала людей на /auth/reset — адресу без
      // жодного маршруту, тобто в 404, і пароль ніхто не змінював. У самій
      // модалці це вже виправлено, але посилання з листа живе годинами, і ті
      // листи вже лежать у скриньках. Хтось відкриє такий завтра.
      //
      // permanent: false навмисно. Це тимчасова сумісність, а не адреса
      // сайту: постійний редирект браузер запам'ятовує назавжди, і зняти
      // його потім було б неможливо. Рядок можна прибрати, коли всі видані
      // посилання протермінуються, і шкоди від того, що він полежить довше,
      // немає.
      //
      // Локаль тут українська, бо в старому посиланні її немає взагалі, а
      // українська — мова сайту за замовчуванням. Параметр ?code= Next.js
      // переносить у призначення сам, і сторінка нового пароля його чекає.
      {
        source: '/auth/reset',
        destination: '/uk/reset-password',
        permanent: false,
      },
      // Root → default locale. permanent:true emits a 308 (was a 307 from a
      // Vercel dashboard rule). If a dashboard-level redirect still exists it
      // runs at the edge BEFORE this config — remove it so this one wins.
      {
        source: '/',
        destination: '/uk',
        permanent: true,
      },
      // Юридичні сторінки живуть у групі (legal): /privacy, /terms, /cookies,
      // /refund — вони читають legal_pages і мають справжній текст. Поруч є дві
      // старі сторінки-дублі, /privacy-policy і /public-offer: вони читають
      // site_content, де відповідних ключів немає, тож показують «Контент ще не
      // додано через адмін панель». На них не веде жодне посилання в коді, але
      // вони лишаються живими адресами, і стара, збережена кимось чи
      // проіндексована, приводила людину на порожню сторінку — саме там, де
      // вона шукала умови або політику. Тепер обидві ведуть на чинні документи.
      {
        source: '/public-offer',
        destination: '/uk/terms',
        permanent: true,
      },
      {
        source: '/privacy-policy',
        destination: '/uk/privacy',
        permanent: true,
      },
      {
        source: '/:locale(uk|en|ro|pl|de)/public-offer',
        destination: '/:locale/terms',
        permanent: true,
      },
      {
        source: '/:locale(uk|en|ro|pl|de)/privacy-policy',
        destination: '/:locale/privacy',
        permanent: true,
      },
      // GSC-found 404s: alias paths people/old links use → real slugs
      {
        source: '/:locale(uk|en|ro|pl|de)/contact',
        destination: '/:locale/kontakty',
        permanent: true,
      },
      {
        source: '/:locale(uk|en|ro|pl|de)/about',
        destination: '/:locale/pro-nas',
        permanent: true,
      },
      // Партнерська програма переїхала: /travel-agencies була однією сторінкою
      // на два різні запити (агенція шукала подарунок клієнту після туру,
      // блогер — відсоток із замовлення), тепер це хаб /partnery і дві профільні
      // сторінки. Адреса стара живе в пошуку й у листах партнерам, тож
      // permanent: true — 308 передає вагу на нову і не лишає 404.
      // Конкретніший /apply мусить стояти ПЕРЕД загальним правилом, інакше
      // заявка поїде на хаб і форму ніхто не побачить.
      {
        source: '/:locale(uk|en|ro|pl|de)/travel-agencies/apply',
        destination: '/:locale/partnery/apply',
        permanent: true,
      },
      {
        source: '/:locale(uk|en|ro|pl|de)/travel-agencies',
        destination: '/:locale/partnery',
        permanent: true,
      },
      // Те саме без локалі: посилання такого вигляду ходили в листах до того,
      // як локаль зʼявилася в адресах. Без цих двох рядків вони потрапили б у
      // редирект на локаль, а звідти в 404 — маршруту /travel-agencies більше
      // немає взагалі.
      {
        source: '/travel-agencies/apply',
        destination: '/uk/partnery/apply',
        permanent: true,
      },
      {
        source: '/travel-agencies',
        destination: '/uk/partnery',
        permanent: true,
      },
      // «Випускні книги» — категорія вимкнена (is_active = false, нуль активних
      // товарів). Тут стояв редирект /category/vypuskni-knyhy →
      // /category/graduation-books, і це був нескінченний цикл: `vypuskni-knyhy`
      // — це публічний український слаг із UA_TO_DB_CATEGORY, тож сторінка
      // категорії відповідала на `graduation-books` постійним редиректом назад
      // на `vypuskni-knyhy`, а next.config знову слав на `graduation-books`.
      // Браузер показував ERR_TOO_MANY_REDIRECTS, Google — помилку сканування.
      // Поки категорія порожня, обидві адреси ведуть одним кроком у каталог;
      // коли Діана додасть туди товар і ввімкне категорію, ці два рядки треба
      // прибрати, і публічною адресою знову стане /category/vypuskni-knyhy.
      {
        source: '/:locale(uk|en|ro|pl|de)/category/vypuskni-knyhy',
        destination: '/:locale/catalog',
        permanent: true,
      },
      {
        source: '/:locale(uk|en|ro|pl|de)/category/graduation-books',
        destination: '/:locale/catalog',
        permanent: true,
      },
      // Legacy product URLs. /[locale]/product/[slug] was an old duplicate
      // product page (removed — it 500ed in production and carried no
      // metadata), and blog content linked to /products/[slug] which never
      // existed as a route. Canonical product URL is /[locale]/catalog/[slug].
      {
        source: '/:locale(uk|en|ro|pl|de)/product/:slug',
        destination: '/:locale/catalog/:slug',
        permanent: true,
      },
      {
        source: '/:locale(uk|en|ro|pl|de)/products/:slug',
        destination: '/:locale/catalog/:slug',
        permanent: true,
      },
      {
        source: '/product/:slug',
        destination: '/uk/catalog/:slug',
        permanent: true,
      },
      {
        source: '/products/:slug',
        destination: '/uk/catalog/:slug',
        permanent: true,
      },
      // NB: the old-site /shop/* rules live at the BOTTOM of this array, next to
      // the per-product mapping table. A blanket `/shop/:path*` → `/uk/catalog`
      // used to sit right here, and because Next.js takes the FIRST matching
      // redirect, it swallowed every one of those ~60 hand-written product
      // mappings below — each ranking /shop/ URL was dumped on the generic
      // catalog instead of on its own product. Never reintroduce a broad
      // /shop/ rule above the specific ones.
      {
        source: '/constructor',
        destination: '/constructor/photobook',
        permanent: false,
      },
      // Безлокальні псевдоніми ведуть одразу на /uk/…, а не на шлях без локалі.
      // proxy.ts на адресу без префікса локалі відповідає ще одним редиректом,
      // тож /about → / → /uk було двома кроками замість одного, а людина з
      // наміром «про нас» узагалі опинялася на головній замість /pro-nas.
      {
        source: '/contacts',
        destination: '/uk/kontakty',
        permanent: true,
      },
      {
        source: '/about',
        destination: '/uk/pro-nas',
        permanent: true,
      },
      {
        source: '/delivery',
        destination: '/uk/oplata-i-dostavka',
        permanent: true,
      },
      // Wishbook duplicates → canonical.
      //
      // `guestbook-kids` свідомо НЕ в цьому списку. Це живий товар «Книга
      // побажань дитяча»: власний опис на три з половиною тисячі знаків, чотири
      // фото, свій meta_title про хрещення, і Діана редагувала його 20.08.2026 —
      // уже після того, як тут зʼявився редирект. Редирект робив зворотне тому,
      // чого ми хочемо: сторінка товару була недосяжна, хоча лежала в
      // sitemap.xml, тобто ми самі здавали Google адресу, яка відповідає 301.
      // Заразом це та сторінка, що відповідає запиту «книга побажань на 1 рік».
      // Слаги нижче — справді неіснуючі товари, їх редиректити правильно.
      { source: '/:locale(uk|en|pl|ro|de)/catalog/guestbook-wedding',       destination: '/:locale/catalog/wishbook', permanent: true },
      { source: '/:locale(uk|en|pl|ro|de)/catalog/knyha-pobazhan-dytyacha', destination: '/:locale/catalog/guestbook-kids', permanent: true },
      { source: '/:locale(uk|en|pl|ro|de)/catalog/knyha-pobazhan-vesillia', destination: '/:locale/catalog/wishbook', permanent: true },
      // Безлокальні варіанти ведуть одразу на /uk/…, а не на /catalog/…:
      // інакше спрацьовувало б загальне правило /catalog/:slug* → /uk/catalog/…
      // нижче, і виходив ланцюг із двох 301 замість одного.
      { source: '/catalog/guestbook-wedding',       destination: '/uk/catalog/wishbook', permanent: true },
      { source: '/catalog/knyha-pobazhan-dytyacha', destination: '/uk/catalog/guestbook-kids', permanent: true },
      { source: '/catalog/knyha-pobazhan-vesillia', destination: '/uk/catalog/wishbook', permanent: true },
      // Calendar duplicates → 2026 canonical
      { source: '/:locale(uk|en|pl|ro|de)/catalog/calendar-table',    destination: '/:locale/catalog/desk-calendar-2026', permanent: true },
      { source: '/:locale(uk|en|pl|ro|de)/catalog/calendar-wall-a3',  destination: '/:locale/catalog/wall-calendar-2026', permanent: true },
      { source: '/catalog/calendar-table',    destination: '/uk/catalog/desk-calendar-2026', permanent: true },
      { source: '/catalog/calendar-wall-a3',  destination: '/uk/catalog/wall-calendar-2026', permanent: true },
      // Stale constructor paths from the old site structure (/order/calendar/<type>)
      { source: '/:locale(uk|en|pl|ro|de)/order/calendar/wall', destination: '/:locale/order/wall-calendar', permanent: true },
      { source: '/:locale(uk|en|pl|ro|de)/order/calendar/desk', destination: '/:locale/order/desk-calendar', permanent: true },
      { source: '/order/calendar/wall', destination: '/uk/order/wall-calendar', permanent: true },
      { source: '/order/calendar/desk', destination: '/uk/order/desk-calendar', permanent: true },
      // Legacy sitemap filename → canonical sitemap
      { source: '/sitemap_pages.xml', destination: '/sitemap.xml', permanent: true },

      // Legacy category slugs (old Ukrainian names → канонічний публічний слаг).
      //
      // Призначення тут — саме UA-слаг із UA_TO_DB_CATEGORY, а не слаг у базі.
      // Раніше ці рядки вели на слаг бази (`photobooks`, `prints`, …), і виходив
      // ланцюг із двох 301: next.config слав на слаг бази, а сторінка категорії
      // додатково слала з нього на публічний UA-слаг. Кожен зайвий крок — це
      // втрачена вага посилання і зайвий запит для сканера, тож ведемо одразу
      // туди, де сторінка справді відповідає кодом 200.
      { source: '/:locale(uk|en|ro|de|pl)/category/fotoknyhy',         destination: '/:locale/category/fotoknygy',            permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/category/fotodruk',          destination: '/:locale/category/druk-foto',            permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/category/zhurnaly',          destination: '/:locale/category/hlyantsevi-zhurnaly',  permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/category/albomy',            destination: '/:locale/category/fotoalbomy',           permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/category/kalendari',         destination: '/:locale/category/fotokalendari',        permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/category/magnity',           destination: '/:locale/category/fotomahnity',          permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/category/travelbuky',        destination: '/:locale/category/trevel-buky',          permanent: true },


      // Google found these as alternate pages. Redirect to canonical clean URL.
      //
      // Призначення — публічний UA-слаг категорії, а не слаг бази: інакше тут
      // теж виходив ланцюг із двох 301 (див. коментар про застарілі слаги вище).
      // `gifts` і `graduation-books` вимкнені та порожні, тож ведуть у каталог.
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'photomagnets' }],    destination: '/:locale/category/fotomahnity',          permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'kids' }],            destination: '/:locale/category/dytyachi-fototovary',  permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'prints' }],          destination: '/:locale/category/druk-foto',            permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'accessories' }],     destination: '/:locale/category/aksesuary',            permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'scrapbook-albums' }], destination: '/:locale/category/albomy-dlya-vkleyky', permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'photobooks' }],      destination: '/:locale/category/fotoknygy',            permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'calendars' }],       destination: '/:locale/category/fotokalendari',        permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'guestbooks' }],      destination: '/:locale/category/knyha-pobazhan',       permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'travelbooks' }],     destination: '/:locale/category/trevel-buky',          permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'posters' }],         destination: '/:locale/category/postery',              permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'puzzles' }],         destination: '/:locale/category/pazly',                permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'hlyantsevi-zhurnaly' }], destination: '/:locale/category/hlyantsevi-zhurnaly', permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'photoalbomy-failykovi' }], destination: '/:locale/category/fotoalbomy',     permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'certificates' }],    destination: '/:locale/category/sertyfikaty',          permanent: true },
      // `gifts` і `graduation-books` навмисно НЕ мають тут рядка. Обидві
      // категорії вимкнені, тобто вести їх нема куди, а призначення
      // `/:locale/catalog` дало б нескінченний цикл: Next.js переносить
      // невикористані параметри запиту в призначення сам, тож /uk/catalog
      // ?category=gifts вело б рівно саме на себе. Без правила ці адреси просто
      // показують каталог, canonical вказує на /catalog без параметра, а
      // robots.txt і так закриває /*/catalog?*.

      // ── BLOG ?category= ────────────────────────────────────────────────────
      //
      // Тут стояло правило /:locale/blog з has: query 'category' і призначенням
      // /:locale/blog — тобто сторінка вела рівно сама на себе. Виглядало це як
      // прибирання параметра, а насправді було нескінченним циклом: Next.js
      // переносить у призначення ті параметри запиту, яких немає в шаблоні
      // призначення, тож /uk/blog?category=poradи віддавало 308 на
      // /uk/blog?category=poradи, і так до ERR_TOO_MANY_REDIRECTS. Знайшов це
      // scripts/redirect-chains.mjs.
      //
      // Правило не потрібне: сторінка блогу вже ставить canonical на /blog без
      // параметрів, а robots.txt закриває /*/blog?*. Окремих сторінок категорій
      // у блозі немає, тож параметр просто фільтрує список.


      // These were indexed by Google from the old Хорошоп/Prom platform.
      // Mapping them prevents 404 penalties and passes link equity to new URLs.

      // Category pages.
      //
      // Призначення — публічний UA-слаг категорії (той, що в sitemap і в
      // canonical), а не слаг бази. Доти тут стояли слаги бази, і кожна з цих
      // адрес віддавала 301 на сторінку, яка сама відповідала ще одним 301.
      // Для адрес, які реально ранжуються (а /shop/cat/albomi — одна з них),
      // зайвий крок коштує ваги посилання.
      { source: '/shop',                    destination: '/uk/catalog',                      permanent: true },
      { source: '/shop/cat/albomi',         destination: '/uk/category/fotoalbomy',          permanent: true },
      { source: '/shop/cat/fotozhurnal',    destination: '/uk/category/hlyantsevi-zhurnaly',  permanent: true },
      { source: '/shop/cat/fotoknyhy',      destination: '/uk/category/fotoknygy',           permanent: true },
      { source: '/shop/cat/fotodruk',       destination: '/uk/category/druk-foto',           permanent: true },
      { source: '/shop/cat/postory',        destination: '/uk/category/postery',             permanent: true },
      { source: '/shop/cat/kalendari',      destination: '/uk/category/fotokalendari',       permanent: true },
      { source: '/shop/cat/magnity',        destination: '/uk/category/fotomahnity',         permanent: true },
      { source: '/shop/cat/knyha-pobazhan', destination: '/uk/category/knyha-pobazhan',      permanent: true },
      // «Друк на полотні (холсті)» був окремим розділом старого магазину, а в
      // нас це один товар, тож ведемо на сам товар, а не на розділ аксесуарів.
      { source: '/shop/cat/druk-na-polotni-holsti', destination: '/uk/catalog/druk-na-polotni', permanent: true },
      { source: '/shop/cat/druk-na-polotni',        destination: '/uk/catalog/druk-na-polotni', permanent: true },
      // Категорія випускних книг вимкнена і порожня, тож ведемо в каталог: на
      // /category/vypuskni-knyhy сторінка віддала б 404.
      { source: '/shop/cat/vypuskni',       destination: '/uk/catalog',                      permanent: true },
      { source: '/shop/cat/albomy-dlya-vkleyuvannya', destination: '/uk/category/albomy-dlya-vkleyky', permanent: true },
      { source: '/shop/cat/pazly',          destination: '/uk/category/pazly',               permanent: true },
      { source: '/shop/cat/travelbook',     destination: '/uk/category/trevel-buky',         permanent: true },

      // Velour albums 200
      { source: '/shop/fajlikovij-velyurovij-albom-na-200-foto-blakitnogo-koloru', destination: '/uk/catalog/velour-album-200', permanent: true },
      { source: '/shop/fajlikovij-velyurovij-albom-na-200-foto-rozhevogo-koloru',  destination: '/uk/catalog/velour-album-200', permanent: true },
      { source: '/shop/fajlikovij-velyurovij-albom-na-200-foto-siroho-koloru',     destination: '/uk/catalog/velour-album-200', permanent: true },
      { source: '/shop/fajlikovij-velyurovij-albom-na-200-foto-biloho-koloru',     destination: '/uk/catalog/velour-album-200', permanent: true },
      { source: '/shop/fajlikovij-velyurovij-albom-na-200-foto',                   destination: '/uk/catalog/velour-album-200', permanent: true },

      // Wishbooks
      { source: '/shop/kniga-pobazhan-na-vesilla',  destination: '/uk/catalog/wishbook', permanent: true },
      { source: '/shop/knyga-pobajan',              destination: '/uk/catalog/wishbook', permanent: true },
      { source: '/shop/knyha-pobazhan',             destination: '/uk/catalog/wishbook', permanent: true },
      { source: '/shop/knyha-pobazhan-na-vesilla',  destination: '/uk/catalog/wishbook', permanent: true },

      // Albums 800
      { source: '/shop/albom-na-800-foto-chornij-photos', destination: '/uk/catalog/album-800', permanent: true },
      { source: '/shop/albom-na-800-foto',                destination: '/uk/catalog/album-800', permanent: true },

      // Photobooks
      { source: '/shop/fotoknyha-z-velyurovoyu-obkladynkoyu', destination: '/uk/catalog/photobook-velour',     permanent: true },
      { source: '/shop/fotoknyha-z-drukovanoyu-obkladynkoyu', destination: '/uk/catalog/photobook-printed',    permanent: true },
      { source: '/shop/fotoknyha-z-tkanynnoyu-obkladynkoyu',  destination: '/uk/catalog/photobook-fabric',     permanent: true },
      { source: '/shop/fotoknyha-zi-shkirzaminnykom',         destination: '/uk/catalog/photobook-leatherette', permanent: true },

      // Journals/magazines
      { source: '/shop/hlyancevyj-zhurnal',                  destination: '/uk/catalog/personalized-glossy-magazine', permanent: true },
      { source: '/shop/glyancevyj-zhurnal-m-yakoyu-obkladynkoyu', destination: '/uk/catalog/personalized-glossy-magazine', permanent: true },
      { source: '/shop/fotozhurnal-tverda-obkladynka',       destination: '/uk/catalog/fotozhurnal-tverd-obkladynka', permanent: true },

      // Photo print
      { source: '/shop/fotodruk-standartni-rozmiry',         destination: '/uk/catalog/photoprint-standard',    permanent: true },
      { source: '/shop/fotodruk-nestandartni-rozmiry',       destination: '/uk/catalog/photoprint-nonstandard', permanent: true },
      { source: '/shop/druk-na-polotni',                     destination: '/uk/catalog/druk-na-polotni',        permanent: true },

      // Calendars
      { source: '/shop/nastilnyj-fotoklendar',               destination: '/uk/catalog/desk-calendar-2026', permanent: true },
      { source: '/shop/nastinnyj-fotoklendar',               destination: '/uk/catalog/wall-calendar-2026', permanent: true },
      { source: '/shop/nastilnyj-fotokalendar-2026',         destination: '/uk/catalog/desk-calendar-2026', permanent: true },

      // Magnets
      { source: '/shop/fotomahnyty',                         destination: '/uk/catalog/photomagnets', permanent: true },
      { source: '/shop/fotomagnity',                         destination: '/uk/catalog/photomagnets', permanent: true },

      // Posters
      { source: '/shop/poster',                              destination: '/uk/catalog/poster',           permanent: true },
      { source: '/shop/poster-zoryanogo-neba',               destination: '/uk/catalog/poster-star-map',  permanent: true },

      // Travelbook
      { source: '/shop/travelbook',                          destination: '/uk/catalog/travelbook-20x30', permanent: true },
      { source: '/shop/trevel-buk',                         destination: '/uk/catalog/travelbook-20x30', permanent: true },

      // Puzzles
      { source: '/shop/fotopazl-a4',                        destination: '/uk/catalog/puzzle-20x30', permanent: true },
      { source: '/shop/fotopazl-a5',                        destination: '/uk/catalog/puzzle-a5',    permanent: true },

      // Scrapbook
      { source: '/shop/albom-dlya-vkleyuvannya-foto',        destination: '/uk/catalog/scrapbook-white-pages', permanent: true },

      // Baby album
      { source: '/shop/pershyj-albom-malyuka',               destination: '/uk/catalog/baby-first-album', permanent: true },

      // Wedding newspaper
      { source: '/shop/vesil-na-hazeta',                     destination: '/uk/catalog/wedding-newspaper', permanent: true },

      // Gift certificate
      { source: '/shop/podarunkovyj-sertyfikat',             destination: '/uk/catalog/gift-certificate', permanent: true },

      // Additional old /shop/ products found in "Crawled — not indexed"
      { source: '/shop/fajlikovij-velyurovij-albom-na-200-foto-sinogo-koloru',  destination: '/uk/catalog/velour-album-200',    permanent: true },
      { source: '/shop/fajlikovij-velyurovij-albom-na-200-foto-sinioho-koloru', destination: '/uk/catalog/velour-album-200',    permanent: true },
      { source: '/shop/photomagnity',                        destination: '/uk/catalog/photomagnets',           permanent: true },
      { source: '/shop/cat/keyboards',                       destination: '/uk/catalog',                        permanent: true },
      { source: '/shop/videoramka',                          destination: '/uk/catalog/tsyfrova-fotoramka',     permanent: true },
      // Товар «Скотч двосторонній» існує — раніше ця адреса вела на головну.
      { source: '/shop/ckotch-dvostoronij',                  destination: '/uk/catalog/skotch-dvostoronnii',    permanent: true },
      { source: '/shop/skotch-dvostoronnij',                 destination: '/uk/catalog/skotch-dvostoronnii',    permanent: true },
      { source: '/shop/fotodruk-9h9',                        destination: '/uk/catalog/photoprint-nonstandard', permanent: true },
      { source: '/shop/kniga-pobazhan-na-vesillya',          destination: '/uk/catalog/wishbook',               permanent: true },

      // ── Адреси зі SEO-аудиту (вересень 2026), які ранжуються й досі ────────
      //
      // Тут навмисно є призначення виду /category/fotoalbomy/<N>-foto. Це не
      // «загальна категорія», а сторінка landing_pages рівно про той самий
      // запит: «Фотоальбоми на 200 фото» перелічує всі активні альбоми цього
      // розміру. Старі адреси були списком-добіркою, а не одним товаром, тож
      // відповідник один до одного — саме така сторінка, а не навмання вибраний
      // альбом із десятка однакових за розміром.
      { source: '/shop/fotoalbom-na-200-foto-10x15',          destination: '/uk/category/fotoalbomy/200-foto', permanent: true },
      { source: '/shop/fotoalbom-na-200-foto-10x15-kvitkovui', destination: '/uk/category/fotoalbomy/200-foto', permanent: true },
      { source: '/shop/albom-dlya-fotografij-na-200-foto-fotografhs-sirij', destination: '/uk/category/fotoalbomy/200-foto', permanent: true },
      { source: '/shop/albom-dlya-fotografij-na-300-foto-1',  destination: '/uk/category/fotoalbomy/300-foto', permanent: true },
      { source: '/shop/albom-dlya-fotografij-na-300-foto',    destination: '/uk/category/fotoalbomy/300-foto', permanent: true },
      // «Альбом з чорними сторінками та фотовікном» — точного відповідника в
      // каталозі НЕМАЄ: наш «Альбом для вклеювання фото» має білі сторінки й без
      // фотовікна, тобто відрізняється двома ознаками, які людина й шукала.
      // Ведемо на категорію альбомів для вклеювання — найвужча сторінка того ж
      // наміру. Цей випадок є в списку прогалин у ARCHITECTURE.md: щойно товар
      // із чорними сторінками зʼявиться, рядок треба перевести на нього.
      { source: '/shop/albom-z-chornimi-storinkami-ta-fotoviknom', destination: '/uk/category/albomy-dlya-vkleyky', permanent: true },
      { source: '/shop/albom-z-chornymy-storinkamy',              destination: '/uk/category/albomy-dlya-vkleyky', permanent: true },
      // Друк фото в стилі полароїд — окремий активний товар.
      { source: '/shop/polaroid',                             destination: '/uk/catalog/polaroid-print', permanent: true },
      { source: '/shop/druk-polaroid',                        destination: '/uk/catalog/polaroid-print', permanent: true },
      { source: '/shop/fotodruk-polaroid',                    destination: '/uk/catalog/polaroid-print', permanent: true },
      { source: '/shop/druk-foto-polaroid',                   destination: '/uk/catalog/polaroid-print', permanent: true },
      { source: '/shop/druk-na-polotni-holsti',               destination: '/uk/catalog/druk-na-polotni', permanent: true },

      // /blog, /catalog, /category without locale → /uk/...
      { source: '/blog',          destination: '/uk/blog',           permanent: true },
      { source: '/blog/:slug*',   destination: '/uk/blog/:slug*',    permanent: true },
      { source: '/catalog',       destination: '/uk/catalog',        permanent: true },
      { source: '/catalog/:slug*', destination: '/uk/catalog/:slug*', permanent: true },
      { source: '/category/:slug*', destination: '/uk/category/:slug*', permanent: true },

      // Short address for the colouring tool, worth sharing out loud. The
      // locale-prefixed form of the tool itself is handled by a rewrite in
      // rewrites(), never a redirect — see the comment there.
      { source: '/rozmalovka',                         destination: '/tools/rozmalovka.html', permanent: false },
      { source: '/:locale(uk|en|ro|pl|de)/rozmalovka', destination: '/tools/rozmalovka.html', permanent: false },

      // Catch-all: усе, що лишилося з /shop/, — у каталог, а не на головну.
      //
      // Цей рядок МУСИТЬ бути останнім серед правил про /shop/: Next.js бере
      // перший збіг, тож будь-яке ширше правило вище знеструмлює всю таблицю
      // відповідників. Саме так ми й втратили її на кілька місяців.
      //
      // Призначення — /uk/catalog, а не /uk. Головна сторінка розповідає про
      // бренд, каталог показує товари, а сюди потрапляє людина, яка шукала
      // конкретну річ. Кожну адресу, що приходить сюди й має покази в Search
      // Console, треба виносити рядком вище, до її власного товару: каталог —
      // це запасний варіант для решти, а не відповідь на запит.
      { source: '/shop/:path*',                              destination: '/uk/catalog', permanent: true },

      // Old root paths without /shop/ prefix (some indexed without it)
      { source: '/&',  destination: '/uk', permanent: true },
      { source: '/$',  destination: '/uk', permanent: true },
    ];
  },
  async headers() {
    // Baseline security headers applied to every response. Skipped CSP for
    // now — the editor uses inline styles, dangerouslySetInnerHTML for SVG,
    // analytics inline scripts, and adopting a strict CSP without breaking
    // these is its own project. The headers below are the easy wins.
    return [
      {
        source: '/:path*',
        headers: [
          // HSTS — force HTTPS for two years incl. subdomains. Vercel terminates
          // TLS, so this is safe to set globally.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // Don't allow MIME sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Don't let other origins iframe us (clickjacking)
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Strip referrer on cross-origin navigation
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Disable browser features we don't use
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self), interest-cohort=()' },
        ],
      },
      {
        // Standalone tools are single files that change with every fix, and a
        // browser holding an old copy looks exactly like a deploy that did not
        // happen. Revalidate on each visit so what you see is what was shipped.
        source: '/tools/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, must-revalidate' },
        ],
      },
      {
        // Public catalog and category pages — allow CDN + Google caching
        source: '/:locale(uk|en|ro|de|pl)/:path(catalog|category|blog)/:rest*',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=60' },
        ],
      },
      {
        // Home page per locale
        source: '/:locale(uk|en|ro|de|pl)',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=60' },
        ],
      },
      {
        // Wishlist and track — personal pages, no SEO value
        source: '/:locale(uk|en|ro|de|pl)/:path(wishlist|track)',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        // Blog tag pages — thin content
        source: '/:locale(uk|en|ro|de|pl)/blog/tag/:tag*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, follow' },
        ],
      },
      {
        // Admin must never be cached at the CDN edge. Belt-and-braces alongside
        // the experimental.ppr=false above.
        source: '/admin/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
}

export default nextConfig
