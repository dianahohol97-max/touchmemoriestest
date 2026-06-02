/**
 * Runtime base URL for server-to-server and external-callback use:
 * the Monobank webhook target, the post-payment redirect, and internal
 * fire-and-forget self-calls.
 *
 * This is deliberately SEPARATE from lib/seo getBaseUrl(), which returns the
 * canonical brand domain (touchmemories.com.ua) for SEO/emails. That domain
 * is only correct once it is actually attached to this Vercel project — until
 * then it serves a different host. A webhook or redirect URL must point at a
 * host that is guaranteed to be serving THIS deployment right now, otherwise
 * payments can't be confirmed and customers land on a stranger's 404.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_SITE_URL — explicit override (set this once the custom
 *      domain is verified live; it then wins everywhere).
 *   2. VERCEL_PROJECT_PRODUCTION_URL — the project's stable production host
 *      (e.g. touchmemories1.vercel.app). Always serves the app; ideal for a
 *      webhook target that may fire across later deploys.
 *   3. VERCEL_URL — the per-deployment host (still publicly reachable).
 *   4. the known production vercel.app host as a last resort.
 */
export function getRuntimeBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;

  const dep = process.env.VERCEL_URL;
  if (dep) return `https://${dep.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;

  return 'https://touchmemories1.vercel.app';
}
