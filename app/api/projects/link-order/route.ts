import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

/**
 * Link pre-payment projects to their order.
 *
 * Some constructors (wall calendar, and other cart-first products) save the
 * project row at add-to-cart time, before an order exists, storing the cart
 * item id in cart_payload.id. At checkout we stamp the real order_id onto those
 * projects so the Monobank webhook → /api/print/render-order can find the design
 * and render it. Book editors set order_id themselves, so they're unaffected.
 *
 * Auth: the caller is the checkout page on behalf of the buyer. We only update
 * projects whose cart_payload.id matches one of the order's cart items AND that
 * have no order_id yet, so this can't reassign someone else's design.
 *
 * ── Замовлення зі збереженого дизайну («Мої дизайни» → «Замовити») ──────────
 *
 * Такій позиції акаунт видає новий id (`{старий}_{Date.now()}`), інакше два
 * замовлення того самого дизайну злиплися б в одну позицію кошика. Суфікс
 * розривав обидва механізми привʼязки: export_{id} у sessionStorage не існує
 * (дизайн замовляють іншого дня, в іншій сесії), а пошук за cart_payload->>id
 * не знаходить нічого, бо там лежить старий id. Замовлення приходило без
 * файлів для друку і без привʼязаного дизайну — і ніхто про це не дізнавався.
 *
 * Тому акаунт кладе id проєкту в metadata.source_project_id, оформлення
 * передає його сюди як sourceProjectIds, і далі:
 *   • проєкт ще не привʼязаний → просто ставимо order_id;
 *   • уже привʼязаний до старого замовлення → КЛОНУЄМО рядок під нове
 *     (рішення Diana, 2026-08-31). Кожне замовлення тримає власний дизайн, тож
 *     старе лишається придатним до передруку — один рядок не може мати два
 *     order_id, а перепривʼязка знищила б історію.
 *
 * Далі з uploaded_photos дизайну збираємо order_files для нового замовлення:
 * там, де лежать реальні шляхи у сховищі ({path, bucket}), виробництво отримує
 * ті самі файли, що й первинне замовлення. Там, де шляхів немає (зоряна мапа
 * зберігає лише прев'ю на 600px), рахуємо позицію в withoutFiles — оформлення
 * за цим числом ставить на замовлення гучне попередження.
 */

/**
 * Категорія та тип, під якими файли дизайну лягають у order_files.
 *
 * Для фотодруку це не косметика. Адмінська картка відбирає готові відбитки за
 * file_category через isPrintSetCategory, а генератор зведених аркушів бере
 * рівно ті самі три категорії. Категорія 'photo-upload', яку цей роут ставив
 * усьому підряд, у той перелік не входить: відновлені файли полароїда впали б
 * не в ту секцію картки і не потрапили б у розкадровку взагалі. Тому для
 * друк-наборів ставимо ту саму категорію й тип, що й конструктор під час
 * звичайного оформлення, а решта дизайнів лишається як була.
 */
function fileKindFor(productType: unknown, slug: unknown): { category: string; type: string } {
  if (String(productType || '').toLowerCase() !== 'photo-print') {
    return { category: 'photo-upload', type: 'upload' };
  }
  const sl = String(slug || '').toLowerCase();
  if (sl === 'polaroid-print') return { category: 'polaroid-print', type: 'export' };
  if (sl === 'photomagnets') return { category: 'photomagnets', type: 'export' };
  return { category: 'photo-print', type: 'export' };
}

/** Дістає з uploaded_photos лише записи з придатним шляхом у сховищі. */
function storagePathsOf(uploaded: unknown): { path: string; bucket: string }[] {
  if (!Array.isArray(uploaded)) return [];
  const out: { path: string; bucket: string }[] = [];
  for (const entry of uploaded) {
    if (!entry || typeof entry !== 'object') continue;
    const path = (entry as any).path;
    // data: URL прев'ю та порожні значення шляхом не є.
    if (typeof path !== 'string' || !path || path.startsWith('data:')) continue;
    const bucket = typeof (entry as any).bucket === 'string' && (entry as any).bucket
      ? (entry as any).bucket
      : 'order-files';
    out.push({ path, bucket });
  }
  return out;
}

/**
 * Кладе файли дизайну в order_files замовлення. Повертає false, коли класти
 * нема чого або вставка не вдалася — виклик рахує це у withoutFiles.
 *
 * Ідемпотентна: повторний виклик link-order (друга спроба оформлення) не
 * задублює вже приліплені шляхи.
 */
async function attachDesignFiles(
  admin: ReturnType<typeof getAdminClient>,
  orderId: string,
  proj: { id: string; product_type?: unknown; uploaded_photos?: unknown; cart_payload?: any },
): Promise<boolean> {
  const paths = storagePathsOf(proj.uploaded_photos);
  if (paths.length === 0) return false;

  const { data: existing } = await admin
    .from('order_files')
    .select('file_path')
    .eq('order_id', orderId);
  const already = new Set((existing || []).map((r: any) => r.file_path));

  const kind = fileKindFor(proj.product_type, proj.cart_payload?.slug);
  const rows = paths
    .filter(p => !already.has(p.path))
    .map((p, i) => ({
      order_id: orderId,
      file_path: p.path,
      file_name: p.path.split('/').pop() || `design_${i + 1}`,
      file_type: kind.type,
      file_category: kind.category,
      product_type: kind.type === 'export' ? 'photoprint' : (proj.product_type || 'design'),
      bucket_name: p.bucket,
      page_number: i + 1,
    }));

  if (rows.length === 0) return true;

  const { error } = await admin.from('order_files').insert(rows);
  if (error) {
    console.error('[link-order] order_files insert failed', { orderId, projectId: proj.id, error: error.message });
    return false;
  }
  return true;
}

export async function POST(request: NextRequest) {
  const { orderId, cartItemIds, sourceProjectIds } = await request.json().catch(() => ({}));
  if (!orderId || !Array.isArray(cartItemIds) || cartItemIds.length === 0) {
    return NextResponse.json({ error: 'orderId and cartItemIds required' }, { status: 400 });
  }

  const admin = getAdminClient();
  let linked = 0;
  let cloned = 0;
  let withoutFiles = 0;

  for (const itemId of cartItemIds) {
    if (!itemId) continue;
    // Match by the cart item id stored in cart_payload, only when not yet linked.
    const { data, error } = await admin
      .from('projects')
      .update({ order_id: orderId })
      .eq('cart_payload->>id', itemId)
      .is('order_id', null)
      .select('id, product_type, uploaded_photos, cart_payload');
    if (error) {
      console.error('[link-order] update failed', { orderId, itemId, error: error.message });
      continue;
    }
    linked += data?.length || 0;

    // ФАЙЛИ ПОТРІБНІ Й ТУТ, не лише в гілці збережених дизайнів нижче.
    // TM-001255: клієнтка склала полароїд 28 серпня, позиція пролежала в
    // кошику до 31-го й була оформлена вже в іншій сесії. Проєкт до замовлення
    // привʼязався саме цією гілкою, а order_files не створив ніхто: sessionStorage
    // з export_{id} за три дні зник, а source_project_id у позиції не було, бо
    // замовляли з кошика, а не з «Моїх дизайнів». Замовлення прийшло оплачене й
    // абсолютно порожнє, хоча всі 20 відбитків лежали у сховищі та були прописані
    // в uploaded_photos проєкту. Тепер файли чіпляються з будь-якого шляху
    // привʼязки; функція ідемпотентна, тож звичайне оформлення, де конструктор
    // уже все зареєстрував, нічого не задублює.
    // Навмисно НЕ рахуємо тут withoutFiles. Ця гілка — страховка, а не
    // основний шлях: у звичайному оформленні файли реєструє сам конструктор зі
    // свого sessionStorage і має власне повідомлення про збій. Багато проєктів
    // тут узагалі не мають і не повинні мати шляхів у сховищі — настінний
    // календар зберігається ще на етапі «додати в кошик», задовго до будь-якого
    // завантаження. Рахувати їх як «дизайн без файлів» означало б чіпляти гучне
    // попередження про несправний експорт на кожне таке замовлення.
    for (const proj of data || []) {
      await attachDesignFiles(admin, orderId, proj as any);
    }
  }

  // Замовлення зі збережених дизайнів.
  const sourceIds: string[] = Array.isArray(sourceProjectIds)
    ? sourceProjectIds.filter((x: unknown): x is string => typeof x === 'string' && !!x).slice(0, 50)
    : [];

  for (const projectId of sourceIds) {
    const { data: proj, error: readErr } = await admin
      .from('projects')
      .select('id, user_id, product_type, format, cover_type, total_pages, pages_data, cover_data, uploaded_photos, overlays_data, cart_payload, name, order_id')
      .eq('id', projectId)
      .maybeSingle();

    if (readErr || !proj) {
      console.error('[link-order] source project not found', { orderId, projectId, error: readErr?.message });
      continue;
    }

    let designRowId = proj.id as string;

    if (!proj.order_id) {
      const { error: stampErr } = await admin
        .from('projects')
        .update({ order_id: orderId, updated_at: new Date().toISOString() })
        .eq('id', proj.id)
        .is('order_id', null);
      if (stampErr) {
        console.error('[link-order] stamp failed', { orderId, projectId, error: stampErr.message });
        continue;
      }
      linked++;
    } else if (proj.order_id === orderId) {
      // Уже привʼязаний саме до цього замовлення — повторний виклик.
      linked++;
    } else {
      const { data: copy, error: cloneErr } = await admin
        .from('projects')
        .insert({
          user_id: proj.user_id,
          product_type: proj.product_type,
          format: proj.format,
          cover_type: proj.cover_type,
          total_pages: proj.total_pages,
          pages_data: proj.pages_data,
          cover_data: proj.cover_data,
          uploaded_photos: proj.uploaded_photos,
          overlays_data: proj.overlays_data,
          cart_payload: proj.cart_payload,
          name: proj.name,
          status: 'draft',
          order_id: orderId,
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .maybeSingle();
      if (cloneErr || !copy) {
        console.error('[link-order] clone failed', { orderId, projectId, error: cloneErr?.message });
        continue;
      }
      designRowId = copy.id as string;
      cloned++;
    }

    // Файли для друку з дизайну — до нового замовлення.
    if (!(await attachDesignFiles(admin, orderId, proj))) withoutFiles++;
  }

  return NextResponse.json({ ok: true, linked, cloned, withoutFiles });
}
