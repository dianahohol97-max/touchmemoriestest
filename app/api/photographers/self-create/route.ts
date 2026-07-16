import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Self-service gallery cabinet for ANY logged-in user (product decision:
 * galleries + landing are open to everyone; only the 10% B2B discount is
 * approval-gated). Creates a photographers row linked to the caller's
 * customer account, or returns the existing one — idempotent.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Увійдіть в акаунт' }, { status: 401 });

  const admin = getAdminClient();
  const { data: customer } = await admin
    .from('customers')
    .select('id, email, name, first_name, last_name')
    .or(`auth_user_id.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle();

  const email = (customer?.email || user.email || '').toLowerCase();
  if (!email) return NextResponse.json({ error: 'В акаунті немає email' }, { status: 400 });

  const { data: existing } = await admin
    .from('photographers')
    .select('id, cabinet_token, slug, customer_id')
    .or(`${customer ? `customer_id.eq.${customer.id},` : ''}email.ilike.${email}`)
    .maybeSingle();

  if (existing) {
    if (!existing.customer_id && customer) {
      await admin.from('photographers').update({ customer_id: customer.id }).eq('id', existing.id);
    }
    return NextResponse.json({ photographer: { cabinet_token: existing.cabinet_token, slug: existing.slug } });
  }

  const name = (customer?.name
    || [customer?.first_name, customer?.last_name].filter(Boolean).join(' ')
    || email.split('@')[0]).trim();
  const baseSlug = name.toLowerCase()
    .replace(/[^a-z0-9а-яіїєґ]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/[а-яіїєґ]/gi, '')
    .replace(/^-+|-+$/g, '') || 'photographer';

  const { data: created, error } = await admin
    .from('photographers')
    .insert({
      name,
      email,
      slug: `${baseSlug}-${String(Date.now()).slice(-5)}`,
      customer_id: customer?.id || null,
    })
    .select('cabinet_token, slug')
    .single();
  if (error || !created) {
    return NextResponse.json({ error: error?.message || 'Не вдалося створити кабінет' }, { status: 500 });
  }
  return NextResponse.json({ photographer: { cabinet_token: created.cabinet_token, slug: created.slug } });
}
