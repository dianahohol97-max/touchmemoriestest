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
      // Root → default locale. permanent:true emits a 308 (was a 307 from a
      // Vercel dashboard rule). If a dashboard-level redirect still exists it
      // runs at the edge BEFORE this config — remove it so this one wins.
      {
        source: '/',
        destination: '/uk',
        permanent: true,
      },
      {
        source: '/public-offer',
        destination: '/uk/public-offer',
        permanent: true,
      },
      {
        source: '/constructor',
        destination: '/constructor/photobook',
        permanent: false,
      },
      {
        source: '/contacts',
        destination: '/kontakty',
        permanent: true,
      },
      {
        source: '/about',
        destination: '/',
        permanent: false,
      },
      {
        source: '/delivery',
        destination: '/',
        permanent: false,
      },
      // Wishbook duplicates → canonical
      { source: '/:locale(uk|en|pl|ro|de)/catalog/guestbook-wedding',       destination: '/:locale/catalog/wishbook', permanent: true },
      { source: '/:locale(uk|en|pl|ro|de)/catalog/guestbook-kids',          destination: '/:locale/catalog/wishbook', permanent: true },
      { source: '/:locale(uk|en|pl|ro|de)/catalog/knyha-pobazhan-dytyacha', destination: '/:locale/catalog/wishbook', permanent: true },
      { source: '/:locale(uk|en|pl|ro|de)/catalog/knyha-pobazhan-vesillia', destination: '/:locale/catalog/wishbook', permanent: true },
      { source: '/catalog/guestbook-wedding',       destination: '/catalog/wishbook', permanent: true },
      { source: '/catalog/guestbook-kids',          destination: '/catalog/wishbook', permanent: true },
      { source: '/catalog/knyha-pobazhan-dytyacha', destination: '/catalog/wishbook', permanent: true },
      { source: '/catalog/knyha-pobazhan-vesillia', destination: '/catalog/wishbook', permanent: true },
      // Calendar duplicates → 2026 canonical
      { source: '/:locale(uk|en|pl|ro|de)/catalog/calendar-table',    destination: '/:locale/catalog/desk-calendar-2026', permanent: true },
      { source: '/:locale(uk|en|pl|ro|de)/catalog/calendar-wall-a3',  destination: '/:locale/catalog/wall-calendar-2026', permanent: true },
      { source: '/catalog/calendar-table',    destination: '/catalog/desk-calendar-2026', permanent: true },
      { source: '/catalog/calendar-wall-a3',  destination: '/catalog/wall-calendar-2026', permanent: true },
      // Stale constructor paths from the old site structure (/order/calendar/<type>)
      { source: '/:locale(uk|en|pl|ro|de)/order/calendar/wall', destination: '/:locale/order/wall-calendar', permanent: true },
      { source: '/:locale(uk|en|pl|ro|de)/order/calendar/desk', destination: '/:locale/order/desk-calendar', permanent: true },
      { source: '/order/calendar/wall', destination: '/order/wall-calendar', permanent: true },
      { source: '/order/calendar/desk', destination: '/order/desk-calendar', permanent: true },
      // Legacy sitemap filename → canonical sitemap
      { source: '/sitemap_pages.xml', destination: '/sitemap.xml', permanent: true },

      // Legacy category slugs (old Ukrainian names → new English slugs)
      { source: '/:locale(uk|en|ro|de|pl)/category/fotoknyhy',         destination: '/:locale/category/photobooks',           permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/category/fotodruk',          destination: '/:locale/category/prints',               permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/category/zhurnaly',          destination: '/:locale/category/hlyantsevi-zhurnaly',  permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/category/albomy',            destination: '/:locale/category/photoalbomy-failykovi', permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/category/kalendari',         destination: '/:locale/category/calendars',            permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/category/magnity',           destination: '/:locale/category/photomagnets',         permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/category/travelbuky',        destination: '/:locale/category/travelbooks',          permanent: true },


      // Google found these as alternate pages. Redirect to canonical clean URL.
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'photomagnets' }],    destination: '/:locale/category/photomagnets',         permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'kids' }],            destination: '/:locale/category/kids',                 permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'prints' }],          destination: '/:locale/category/prints',               permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'accessories' }],     destination: '/:locale/category/accessories',           permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'scrapbook-albums' }], destination: '/:locale/category/scrapbook-albums',     permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'photobooks' }],      destination: '/:locale/category/photobooks',           permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'calendars' }],       destination: '/:locale/category/calendars',            permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'guestbooks' }],      destination: '/:locale/category/guestbooks',           permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'travelbooks' }],     destination: '/:locale/category/travelbooks',          permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'posters' }],         destination: '/:locale/category/posters',              permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'puzzles' }],         destination: '/:locale/category/puzzles',              permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'hlyantsevi-zhurnaly' }], destination: '/:locale/category/hlyantsevi-zhurnaly', permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'photoalbomy-failykovi' }], destination: '/:locale/category/photoalbomy-failykovi', permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'graduation-books' }], destination: '/:locale/category/graduation-books',   permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'gifts' }],           destination: '/:locale/category/gifts',                permanent: true },
      { source: '/:locale(uk|en|ro|de|pl)/catalog', has: [{ type: 'query', key: 'category', value: 'certificates' }],    destination: '/:locale/category/certificates',         permanent: true },

      // ── BLOG ?category= query params → /blog (no separate category pages) ─
      { source: '/:locale(uk|en|ro|de|pl)/blog', has: [{ type: 'query', key: 'category' }], destination: '/:locale/blog', permanent: true },


      // These were indexed by Google from the old Хорошоп/Prom platform.
      // Mapping them prevents 404 penalties and passes link equity to new URLs.

      // Category pages
      { source: '/shop',                    destination: '/uk',                              permanent: true },
      { source: '/shop/cat/albomi',         destination: '/uk/category/photoalbomy-failykovi', permanent: true },
      { source: '/shop/cat/fotozhurnal',    destination: '/uk/category/hlyantsevi-zhurnaly',  permanent: true },
      { source: '/shop/cat/fotoknyhy',      destination: '/uk/category/photobooks',           permanent: true },
      { source: '/shop/cat/fotodruk',       destination: '/uk/category/prints',               permanent: true },
      { source: '/shop/cat/postory',        destination: '/uk/category/posters',              permanent: true },
      { source: '/shop/cat/kalendari',      destination: '/uk/category/calendars',            permanent: true },
      { source: '/shop/cat/magnity',        destination: '/uk/category/photomagnets',         permanent: true },
      { source: '/shop/cat/knyha-pobazhan', destination: '/uk/category/guestbooks',           permanent: true },
      { source: '/shop/cat/vypuskni',       destination: '/uk/category/graduation-books',     permanent: true },

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
      { source: '/shop/albom-dlya-fotografij-na-200-foto-fotografhs-sirij',     destination: '/uk/catalog/velour-album-200',    permanent: true },
      { source: '/shop/fotoalbom-na-200-foto-10x15-kvitkovui', destination: '/uk/catalog/velour-album-200',    permanent: true },
      { source: '/shop/cat/keyboards',                       destination: '/uk',                                permanent: true },
      { source: '/shop/videoramka',                          destination: '/uk/catalog/tsyfrova-fotoramka',     permanent: true },
      { source: '/shop/ckotch-dvostoronij',                  destination: '/uk',                                permanent: true },
      { source: '/shop/fotodruk-9h9',                        destination: '/uk/catalog/photoprint-nonstandard', permanent: true },
      { source: '/shop/kniga-pobazhan-na-vesillya',          destination: '/uk/catalog/wishbook',               permanent: true },

      // /blog, /catalog, /category without locale → /uk/...
      { source: '/blog',          destination: '/uk/blog',           permanent: true },
      { source: '/blog/:slug*',   destination: '/uk/blog/:slug*',    permanent: true },
      { source: '/catalog',       destination: '/uk/catalog',        permanent: true },
      { source: '/catalog/:slug*', destination: '/uk/catalog/:slug*', permanent: true },
      { source: '/category/:slug*', destination: '/uk/category/:slug*', permanent: true },

      // Catch-all: any remaining /shop/ path → home
      { source: '/shop/:path*',                              destination: '/uk', permanent: true },

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
