import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { registerExportFiles, pruneStaleExports, pruneExportsOfDetachedProjects } from '@/lib/print/register-export-files';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/print/render-complete — the render service's completion callback.
 *
 * Big books (40+ spreads) render longer than render-order's maxDuration, so
 * the function awaiting the render dies before it can index the files: the
 * whole набір sat in storage while order_files had zero rows and the admin
 * showed «немає макета» (TM-001113). The Railway service now reports its own
 * completion here with the uploaded paths; registration is idempotent, so when
 * BOTH paths survive (small book: render-order registers AND this callback
 * fires) the second write is a harmless no-op replacement.
 *
 * Auth: the shared PRINT_RENDER_TOKEN — the same secret the service already
 * uses to read /api/print/[projectId].
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get('x-render-token') || '';
  const expected = process.env.PRINT_RENDER_TOKEN || '';
  if (!expected || token !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as any));
  const projectId = String(body?.projectId || '');
  const uploaded: string[] = Array.isArray(body?.uploaded)
    ? body.uploaded.filter((p: unknown) => typeof p === 'string' && p.length > 0)
    : [];
  if (!projectId || uploaded.length === 0) {
    return NextResponse.json({ error: 'projectId and uploaded[] required' }, { status: 400 });
  }

  const admin = getAdminClient();
  const { data: project, error } = await admin
    .from('projects')
    .select('id, order_id, product_type')
    .eq('id', projectId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 });
  if (!project.order_id) {
    // Draft render with no order yet — nothing to index against.
    return NextResponse.json({ ok: true, note: 'project has no order' });
  }

  const insertError = await registerExportFiles(admin, project.order_id, project.product_type, uploaded);
  // Прибирати можна ТІЛЬКИ файли цього макета. Цей колбек приходить від сервісу
  // на кожен окремий виріб, і без обмеження він зносив макети сусідніх книг
  // того самого замовлення — саме так TM-001234 двічі втратило вже готову
  // книгу, поки перерендерювали іншу.
  await pruneStaleExports(admin, project.order_id, uploaded, [String(project.id)]);
  // Файли макетів, від'єднаних від замовлення — див. коментар до функції.
  // Цей шлях так само буває останнім у сценарії виправлення дизайнером.
  // Тільки коли новий набір справді приїхав: інакше знімемо старі рядки й
  // лишимо замовлення без жодного файлу.
  if (uploaded.length > 0) await pruneExportsOfDetachedProjects(admin, project.order_id);

  // A successful render supersedes any «РЕНДЕР НЕ ВДАВСЯ» note the timed-out
  // path may have written on the order.
  try {
    const { data: cur } = await admin.from('orders').select('notes').eq('id', project.order_id).maybeSingle();
    if (cur?.notes && cur.notes.includes('РЕНДЕР НЕ ВДАВСЯ')) {
      const cleaned = cur.notes
        .split('\n\n')
        .filter((block: string) => !block.includes('РЕНДЕР НЕ ВДАВСЯ'))
        .join('\n\n')
        .trim();
      await admin.from('orders').update({ notes: cleaned || null }).eq('id', project.order_id);
    }
  } catch { /* cosmetic — never fail the callback on it */ }

  console.log('[render-complete] indexed', {
    projectId,
    orderId: project.order_id,
    files: uploaded.length,
    insertError,
    // Which service build produced the render — the fastest way to spot a
    // stale Railway deploy in the logs.
    serviceCommit: String(body?.serviceCommit || 'unknown'),
  });
  return NextResponse.json({ ok: !insertError, files: uploaded.length, insertError });
}
