import { NextResponse } from 'next/server';
import { requireSection } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// PATCH /api/admin/products/[id]/images
// Body: { images: string[] }
// Updates the images array for a product using the service-role key
// so RLS policies on the products table never block the write.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Право на каталог, а не членство в admin_users. Тут стояла ще одна перевірка
  // поверх guard-а: email мусив бути в admin_users, а це четверо з чотирнадцяти
  // активних співробітників. Роут існував саме для того, щоб обійти RLS, і сам
  // же відтворював її обмеження — фото товару могли міняти тільки ті самі
  // четверо, решта отримувала Forbidden без пояснення.
  const guard = await requireSection('catalog', 'edit');
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await req.json();
  const { images } = body;
  if (!Array.isArray(images)) {
    return NextResponse.json({ error: 'images must be an array' }, { status: 400 });
  }

  const adminClient = getAdminClient();
  const { error } = await adminClient
    .from('products')
    .update({ images })
    .eq('id', id);

  if (error) {
    console.error('Product images update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, images });
}
