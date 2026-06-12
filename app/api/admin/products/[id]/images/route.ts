import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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
  // Verify the caller is a logged-in admin
  const cookieClient = await createClient();
  const { data: { user } } = await cookieClient.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminClient = getAdminClient();
  const { data: adminRow } = await adminClient
    .from('admin_users')
    .select('id')
    .eq('email', user.email.toLowerCase())
    .maybeSingle();
  if (!adminRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { images } = body;
  if (!Array.isArray(images)) {
    return NextResponse.json({ error: 'images must be an array' }, { status: 400 });
  }

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
