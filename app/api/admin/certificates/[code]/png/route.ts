import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { renderCertificatePng } from '@/lib/certificates/renderCertificatePng';

// next/og needs the Node runtime; rendering takes ~1s.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/admin/certificates/[code]/png[?download=1]
 * Brand gift-certificate PNG (2400×1600). Inline by default; `download=1`
 * sets a Content-Disposition so the browser saves certificate-<CODE>.png.
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { code } = await params;
  const supabase = getAdminClient();
  const { data: cert, error } = await supabase
    .from('certificates')
    .select('code, certificate_type, amount, product_name, valid_until')
    .eq('code', code)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!cert) return NextResponse.json({ error: 'Сертифікат не знайдено' }, { status: 404 });

  const png = await renderCertificatePng(cert);
  const download = new URL(req.url).searchParams.get('download') === '1';
  return new NextResponse(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, no-store',
      ...(download ? { 'Content-Disposition': `attachment; filename="certificate-${cert.code}.png"` } : {}),
    },
  });
}
