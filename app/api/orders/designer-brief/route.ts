import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Server-side submission for "хай дизайнер зробить" (designer-brief) orders.
 *
 * This flow used to insert directly into `orders` and `order_files` from the
 * browser. That bypassed the rule that customers never write to `orders`
 * directly (see /api/orders/submit) and required client write access to those
 * tables. We now accept the brief here and insert with the service role.
 *
 * Unlike /api/orders/submit this endpoint intentionally creates the order with
 * total = 0 — the customer has not built anything, so the manager prices it
 * after the designer lays the book out. (submit rejects total < 1, which is
 * why designer briefs need their own path.)
 *
 * Photo files are uploaded to the `order-files` storage bucket on the client;
 * here we only persist their metadata rows.
 */

interface FileItem {
  path: string;
  name: string;
  size?: number;
  type?: string;
}

interface DesignerBriefPayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  telegram?: string;
  productSlug?: string;
  size?: string;
  pages?: string | number;
  cover?: string;
  tracing?: string;
  color?: string;
  decoration?: string;
  decorationVariant?: string;
  price?: number | string;
  tripDestination?: string;
  orderComment?: string;
  coverComment?: string;
  deliveryMethod?: string;
  city?: string;
  branch?: string;
  paymentMethod?: 'full' | 'split' | string;
  contactMethod?: string;
  files?: FileItem[];
}

function isValidPhone(s: unknown): s is string {
  return typeof s === 'string' && /^\+?[0-9\s\-\(\)]{7,20}$/.test(s.trim());
}
function isValidEmail(s: unknown): s is string {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function deriveProductType(slug: string): string {
  const s = slug.toLowerCase();
  if (s.includes('travel')) return 'travelbook';
  if (s.includes('magazine') || s.includes('zhurnal') || s.includes('fotozhurnal')) return 'journal';
  if (s.includes('wish') || s.includes('pobazhan') || s.includes('guest')) return 'wishbook';
  if (s.includes('photobook') || s.includes('graduation')) return 'photobook';
  if (s.includes('journal')) return 'journal';
  if (s.includes('planner')) return 'planner';
  if (s.includes('poster')) return 'poster';
  if (s.includes('photoprint') || s.includes('polaroid')) return 'photoprint';
  return 'designer-brief';
}

export async function POST(request: NextRequest) {
  let body: DesignerBriefPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const firstName = (body.firstName || '').toString().trim();
  const lastName = (body.lastName || '').toString().trim();
  if (!firstName || firstName.length > 100 || !lastName || lastName.length > 100) {
    return NextResponse.json({ error: 'firstName/lastName required' }, { status: 400 });
  }
  if (!isValidPhone(body.phone)) {
    return NextResponse.json({ error: 'phone invalid' }, { status: 400 });
  }
  if (body.email && !isValidEmail(body.email)) {
    return NextResponse.json({ error: 'email invalid' }, { status: 400 });
  }
  const productSlug = (body.productSlug || '').toString().trim();
  if (!productSlug || productSlug.length > 200) {
    return NextResponse.json({ error: 'productSlug required' }, { status: 400 });
  }

  // Look up the real product so the admin can link it / price it later.
  const admin = getAdminClient();
  let productId: string | null = null;
  let productName = productSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  try {
    const { data: prod } = await admin
      .from('products')
      .select('id, name')
      .eq('slug', productSlug)
      .maybeSingle();
    if (prod) { productId = prod.id; productName = prod.name || productName; }
  } catch (e) {
    console.warn('designer-brief: product lookup failed', e);
  }

  const productType = deriveProductType(productSlug);
  const payment_type = body.paymentMethod === 'split' ? 'split' : 'full';

  // Price the customer saw in the configurator (carried via the ?price= param).
  // Lands the designer order with the SAME price as the constructor instead of 0;
  // the manager can still adjust it after the designer lays the book out.
  const estPrice = Math.max(0, Math.round(Number(body.price) || 0));

  const notes = [
    body.tripDestination && productSlug.toLowerCase().includes('travel')
      ? `Країна/місце подорожі: ${body.tripDestination}` : '',
    body.orderComment || '',
    body.coverComment || '',
  ].filter(Boolean).join('\n---\n').slice(0, 5000);

  const { data: order, error: orderError } = await admin
    .from('orders')
    .insert({
      // order_number from DB sequence default (TM-NNNNNN), read back via .select.
      customer_first_name: firstName,
      customer_last_name: lastName,
      customer_phone: (body.phone || '').toString().trim(),
      customer_email: body.email?.toString().trim() || null,
      customer_telegram: body.telegram?.toString().trim().slice(0, 200) || null,
      with_designer: true,
      items: [{
        product_id: productId,
        product_slug: productSlug,
        product_name: productName,
        size: body.size, pages: body.pages, cover: body.cover, tracing: body.tracing,
        color: body.color, decoration: body.decoration, decoration_variant: body.decorationVariant,
        price: estPrice,
        quantity: 1,
      }],
      notes: notes || null,
      delivery_method: body.deliveryMethod || 'nova_poshta',
      delivery_address: body.deliveryMethod === 'nova_poshta'
        ? { city: body.city, branch: body.branch }
        : { pickup: 'Тернопіль' },
      payment_type,
      order_status: 'new',
      payment_status: 'pending',
      custom_attributes: { contact_method: body.contactMethod || null },
      total: estPrice,    // carried from the configurator; manager may adjust
      subtotal: estPrice,
    })
    .select('id, order_number')
    .single();

  if (orderError || !order) {
    console.error('designer-brief insert error:', orderError);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }

  const files = Array.isArray(body.files) ? body.files.slice(0, 200) : [];
  if (files.length > 0) {
    const { error: filesError } = await admin.from('order_files').insert(
      files.map((it, idx) => ({
        order_id: order.id,
        file_path: it.path,
        file_name: it.name,
        file_type: 'upload',
        file_category: 'designer-brief',
        product_type: productType,
        bucket_name: 'order-files',
        file_size: it.size,
        mime_type: it.type,
        page_number: idx + 1,
      }))
    );
    if (filesError) console.error('designer-brief order_files error:', filesError);
  }

  return NextResponse.json({ success: true, order_id: order.id, order_number: order.order_number });
}
