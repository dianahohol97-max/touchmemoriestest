import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { parseZipAttemptFinish, parseZipAttemptStart } from '@/lib/photographers/zip-attempt';

export const dynamic = 'force-dynamic';

/**
 * Журнал спроб «Завантажити все» (таблиця gallery_zip_attempts, міграція
 * 20260926). Дві дії:
 *
 * - `start` — ДО першого байта: рядок без результату. Якщо вкладка впаде,
 *   рядок таким і залишиться, і саме це нам треба бачити.
 * - `finish` — результат. Приймає і sendBeacon (text/plain), бо на закритті
 *   сторінки звичайний fetch уже не доходить.
 *
 * Auth — невгадуваний client_token галереї, як і в /track. Приймаємо лише
 * перелічені значення й числа; жодних IP, User-Agent чи іншого про людину.
 * `zip_downloads` на галереї рахує завершені архіви, як і раніше: `stream` і
 * `single` — одразу, `parts` — коли клієнт каже, що зібрав усі частини.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let body: any = {};
  try { body = JSON.parse(await req.text()); } catch { /* порожнє тіло */ }

  const admin = getAdminClient();
  const { data: gallery } = await admin
    .from('photographer_galleries')
    .select('id, expires_at, files_purged_at')
    .eq('client_token', token)
    .maybeSingle();
  if (!gallery) return NextResponse.json({ error: 'Галерею не знайдено' }, { status: 404 });

  if (body?.action === 'start') {
    if (gallery.files_purged_at || new Date(gallery.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Термін зберігання минув' }, { status: 410 });
    }
    const row = parseZipAttemptStart(body);
    if (!row) return NextResponse.json({ error: 'Некоректні дані' }, { status: 400 });
    const { data, error } = await admin
      .from('gallery_zip_attempts')
      .insert({ ...row, gallery_id: gallery.id })
      .select('id')
      .single();
    if (error) {
      console.error('[gallery/zip-attempt] start failed:', error.message);
      return NextResponse.json({ error: 'Не вдалося записати' }, { status: 500 });
    }
    return NextResponse.json({ id: data.id });
  }

  if (body?.action === 'finish') {
    const fin = parseZipAttemptFinish(body);
    if (!fin) return NextResponse.json({ error: 'Некоректні дані' }, { status: 400 });
    // Тільки своєї галереї і тільки відкриту: закритий результат не
    // переписується, тож повторний beacon нічого не зіпсує.
    const { data: updated, error } = await admin
      .from('gallery_zip_attempts')
      .update({
        finished_at: new Date().toISOString(),
        outcome: fin.outcome,
        files_via_proxy: fin.files_via_proxy,
        error: fin.error,
      })
      .eq('id', fin.id)
      .eq('gallery_id', gallery.id)
      .is('finished_at', null)
      .select('id, method')
      .maybeSingle();
    if (error) {
      console.error('[gallery/zip-attempt] finish failed:', error.message);
      return NextResponse.json({ error: 'Не вдалося записати' }, { status: 500 });
    }
    if (updated && fin.outcome === 'completed' && (updated.method !== 'parts' || fin.all_parts_done)) {
      await admin.rpc('increment_gallery_zip_downloads', { gallery: gallery.id });
    }
    return NextResponse.json({ ok: true, updated: !!updated });
  }

  return NextResponse.json({ error: 'Невідома дія' }, { status: 400 });
}
