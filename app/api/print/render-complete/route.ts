import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { registerExportFiles, pruneStaleExports, pruneExportsOfDetachedProjects } from '@/lib/print/register-export-files';
import { RENDER_BUILD_KEY } from '@/lib/print/render-build';
import { failedSpreadCount, isRenderComplete } from '@/lib/print/render-result';

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

  const insertError = await registerExportFiles(admin, project.order_id, project.product_type, uploaded, project.id);

  /**
   * Прибирати старі файли можна ТІЛЬКИ після повного макета.
   *
   * Умова та сама, що в /api/print/render-order, і саме її тут бракувало.
   * Колбек читав лише `uploaded` і ніколи не дивився в `failed`, хоча сервіс
   * шле обидва поля, тож частковий прогін приходив сюди як звичайний успіх:
   * прибирання вважало застарілим усе, чого немає в неповному наборі, і
   * зносило сторінки, які вже лежали цілі. TM-001342 (Diana, 22.09.2026) —
   * дизайнер натиснув «перегенерувати» на книзі з двадцяти сторінок, прогін
   * приніс частину, і в теці лишилося те, що привіз саме він. Клієнтці поїхав
   * PDF із п'ятнадцяти сторінок замість двадцяти: обкладинка і сторінки з 06
   * до 20, а перших п'яти не було взагалі. Помітили це аж тоді, коли друкарня
   * сказала, що кількість сторінок непарна.
   *
   * Вартість помилки несиметрична рівно так само, як у render-order: зайвий
   * старий файл прибирається руками за хвилину, а видалений треба рендерити
   * наново, і поки цього ніхто не зробив, замовлення стоїть із діркою в
   * макеті. Тому сумнів тлумачиться на користь «неповний».
   */
  const complete = isRenderComplete(body);
  const failed = failedSpreadCount(body);
  if (complete) {
    // Прибирати можна ТІЛЬКИ файли цього макета. Цей колбек приходить від сервісу
    // на кожен окремий виріб, і без обмеження він зносив макети сусідніх книг
    // того самого замовлення — саме так TM-001234 двічі втратило вже готову
    // книгу, поки перерендерювали іншу.
    await pruneStaleExports(admin, project.order_id, uploaded, [String(project.id)]);
    // Файли макетів, від'єднаних від замовлення — див. коментар до функції.
    // Цей шлях так само буває останнім у сценарії виправлення дизайнером.
    await pruneExportsOfDetachedProjects(admin, project.order_id);
  } else {
    console.error('[render-complete] неповний макет — старі файли лишаємо', {
      projectId, orderId: project.order_id, uploaded: uploaded.length, failed,
    });
  }

  // A successful render supersedes any «РЕНДЕР НЕ ВДАВСЯ» note the timed-out
  // path may have written on the order. Неповний прогін її НЕ знімає: він і є
  // той випадок, про який вона попереджає.
  try {
    const { data: cur } = await admin.from('orders').select('notes').eq('id', project.order_id).maybeSingle();
    if (complete && cur?.notes && cur.notes.includes('РЕНДЕР НЕ ВДАВСЯ')) {
      const cleaned = cur.notes
        .split('\n\n')
        .filter((block: string) => !block.includes('РЕНДЕР НЕ ВДАВСЯ'))
        .join('\n\n')
        .trim();
      await admin.from('orders').update({ notes: cleaned || null }).eq('id', project.order_id);
    }
  } catch { /* cosmetic — never fail the callback on it */ }

  /**
   * Яка збірка сервісу це зробила — у settings, а не лише в консоль.
   *
   * Головне тут не комміт, а ЧАС. Railway розкочується автоматично разом із
   * GitHub, тож код сервісу зазвичай свіжий — а от чи рендер після виправлення
   * запускали, не бачив ніхто. TM-001254 через це чекало три дні: лікування
   * білої лінії стояло на місці з шістнадцятого вересня, а файли лишалися від
   * дев'ятого, бо перегенерацію так і не запустили. Виправлення змінює те, що
   * рендер ВИРОБЛЯЄ, і не чіпає того, що вже лежить у сховищі.
   *
   * Пишеться без await і з повним ковтанням помилок: це діагностика, і
   * вона не має права зіпсувати колбек, який щойно зареєстрував макет.
   */
  try {
    void admin.from('settings').upsert({
      key: RENDER_BUILD_KEY,
      value: {
        commit: String(body?.serviceCommit || 'unknown'),
        at: new Date().toISOString(),
        projectId,
        files: uploaded.length,
        // Скільки аркушів не зібралося. Без цього числа «останній рендер
        // сьогодні» в адмінці виглядає однаково і для цілого макета, і для
        // того, що привіз половину.
        failed,
      },
      updated_at: new Date().toISOString(),
    }).then(() => {}, () => {});
  } catch { /* діагностика ніколи не ламає рендер */ }

  console.log('[render-complete] indexed', {
    projectId,
    orderId: project.order_id,
    files: uploaded.length,
    failed,
    complete,
    insertError,
    // Which service build produced the render — the fastest way to spot a
    // stale Railway deploy in the logs.
    serviceCommit: String(body?.serviceCommit || 'unknown'),
  });
  return NextResponse.json({ ok: !insertError, files: uploaded.length, failed, complete, insertError });
}
