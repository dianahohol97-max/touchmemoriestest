import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

/**
 * Production readiness health check.
 *
 * Returns boolean presence of every env var the app needs, the result of a
 * trivial Supabase reachability ping, and the current count of critical
 * tables. Never returns the env var values themselves — only whether they
 * are set — so this endpoint is safe to leave on but is still gated to
 * admin users so it can't be probed anonymously.
 *
 * Use this after a deploy to verify nothing fell out of env config:
 *   curl https://<host>/api/health -H "Cookie: <admin session cookie>"
 */
export async function GET() {
  // Admin only — the env var inventory is informational but still tells
  // an attacker which integrations are configured. Not worth leaking.
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const env = {
    // Critical — without these the app does not start
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,

    // Payments
    MONOBANK_TOKEN: !!process.env.MONOBANK_TOKEN,
    MONOBANK_TOKEN_INTL: !!process.env.MONOBANK_TOKEN_INTL,
    MONOBANK_PUB_KEY: !!process.env.MONOBANK_PUB_KEY,

    // Site URL — webhook redirect, email links
    NEXT_PUBLIC_SITE_URL: !!process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_APP_URL: !!process.env.NEXT_PUBLIC_APP_URL,

    // Email providers
    BREVO_API_KEY: !!process.env.BREVO_API_KEY,
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: !!process.env.RESEND_FROM_EMAIL,

    // Shipping
    NOVA_POSHTA_API_KEY: !!process.env.NOVA_POSHTA_API_KEY,
    NOVA_POSHTA_SENDER_REF: !!process.env.NOVA_POSHTA_SENDER_REF,

    // Fiscal receipts (legally required in UA)
    CHECKBOX_LICENSE_KEY: !!process.env.CHECKBOX_LICENSE_KEY,
    CHECKBOX_LOGIN: !!process.env.CHECKBOX_LOGIN,
    CHECKBOX_PASSWORD: !!process.env.CHECKBOX_PASSWORD,

    // Telegram notifications
    TELEGRAM_BOT_TOKEN: !!process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_DESIGNER_CHAT_ID: !!process.env.TELEGRAM_DESIGNER_CHAT_ID,

    // Cron security
    CRON_SECRET: !!process.env.CRON_SECRET,

    // AI / image gen (designer-service photo analysis, AI Portrait)
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    GOOGLE_AI_API_KEY: !!process.env.GOOGLE_AI_API_KEY,
    HUGGINGFACE_API_TOKEN: !!process.env.HUGGINGFACE_API_TOKEN,
    REPLICATE_API_TOKEN: !!process.env.REPLICATE_API_TOKEN,

    // Marketing / analytics
    NEXT_PUBLIC_GA_ID: !!process.env.NEXT_PUBLIC_GA_ID,
    NEXT_PUBLIC_FB_PIXEL_ID: !!process.env.NEXT_PUBLIC_FB_PIXEL_ID,
  };

  // Group by criticality
  const critical = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'MONOBANK_TOKEN', 'MONOBANK_PUB_KEY', 'CRON_SECRET', 'NEXT_PUBLIC_SITE_URL'];
  const high = ['MONOBANK_TOKEN_INTL', 'BREVO_API_KEY', 'NOVA_POSHTA_API_KEY', 'NOVA_POSHTA_SENDER_REF', 'CHECKBOX_LICENSE_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_DESIGNER_CHAT_ID'];
  
  const missingCritical = critical.filter(k => !(env as any)[k]);
  const missingHigh = high.filter(k => !(env as any)[k]);

  // Supabase reachability
  let supabaseOk = false;
  let supabaseErr: string | null = null;
  try {
    const admin = getAdminClient();
    const { error } = await admin.from('products').select('id', { count: 'exact', head: true }).limit(1);
    supabaseOk = !error;
    if (error) supabaseErr = error.message;
  } catch (e: any) {
    supabaseErr = e?.message || String(e);
  }

  // Critical table existence — fail loud if any of these are gone
  const criticalTables = ['orders', 'customers', 'products', 'order_history', 'design_briefs', 'order_files', 'certificates'];
  let tablesOk = true;
  let tablesErr: string | null = null;
  try {
    const admin = getAdminClient();
    for (const tbl of criticalTables) {
      const { error } = await admin.from(tbl).select('*', { count: 'exact', head: true }).limit(0);
      if (error) {
        tablesOk = false;
        tablesErr = `${tbl}: ${error.message}`;
        break;
      }
    }
  } catch (e: any) {
    tablesOk = false;
    tablesErr = e?.message || String(e);
  }

  const ready = missingCritical.length === 0 && supabaseOk && tablesOk;

  return NextResponse.json({
    ready,
    timestamp: new Date().toISOString(),
    env,
    supabase: { ok: supabaseOk, error: supabaseErr },
    tables: { ok: tablesOk, error: tablesErr, checked: criticalTables },
    summary: {
      missingCritical,
      missingHigh,
      criticalCount: critical.length,
      highCount: high.length,
    },
  });
}
