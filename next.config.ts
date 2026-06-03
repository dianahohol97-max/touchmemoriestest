// auto-deploy: deploy-1775103223
const nextConfig = {
  // Disable Partial Pre-Rendering globally — admin panel must never be statically cached
  experimental: {
    ppr: false,
  },
  // Required for @imgly/background-removal — Turbopack config (Next.js 16+)
  turbopack: {},
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 2678400, // 31 days — product/blog images rarely change
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
