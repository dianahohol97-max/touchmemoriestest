import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST — create or update designer project
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { order_id, canvas_data, title, format, cover_type, page_count, thumbnail_url, action } = body;

  if (!order_id) return NextResponse.json({ error: 'order_id required' }, { status: 400 });

  // Get order info (customer_id, product)
  const { data: order } = await supabase
    .from('orders')
    .select('id, customer_id, product_id, designer_project_id, with_designer, items')
    .eq('id', order_id)
    .single();

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  // Check if project already exists for this order
  let projectId = order.designer_project_id;

  if (projectId) {
    // Update existing project
    const updateData: any = { updated_at: new Date().toISOString() };
    if (canvas_data !== undefined) updateData.canvas_data = canvas_data;
    if (thumbnail_url) updateData.thumbnail_url = thumbnail_url;
    if (title) updateData.title = title;
    if (format) updateData.format = format;
    if (cover_type) updateData.cover_type = cover_type;
    if (page_count) updateData.page_count = page_count;

    if (action === 'send_for_review') {
      updateData.status = 'sent_for_review';
      updateData.sent_for_review_at = new Date().toISOString();
      // Update brief status too
      await supabase.from('design_briefs')
        .update({ status: 'sent_for_review', updated_at: new Date().toISOString() })
        .eq('order_id', order_id);
    } else if (action === 'save') {
      updateData.status = 'in_progress';
    }

    await supabase.from('customer_projects').update(updateData).eq('id', projectId);
  } else {
    // Create new project
    const productName = (order.items as any[])?.[0]?.name || 'Проект';
    const { data: newProject } = await supabase
      .from('customer_projects')
      .insert({
        customer_id: order.customer_id,
        order_id,
        designer_id: user.id,
        title: title || `Макет: ${productName}`,
        format: format || '',
        cover_type: cover_type || '',
        page_count: page_count || 0,
        canvas_data: canvas_data || {},
        thumbnail_url: thumbnail_url || null,
        status: action === 'send_for_review' ? 'sent_for_review' : 'in_progress',
        share_token: crypto.randomUUID(),
        sent_for_review_at: action === 'send_for_review' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (!newProject) return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    projectId = newProject.id;

    // Link project to order
    await supabase.from('orders').update({ designer_project_id: projectId }).eq('id', order_id);

    if (action === 'send_for_review') {
      await supabase.from('design_briefs')
        .update({ status: 'sent_for_review', updated_at: new Date().toISOString() })
        .eq('order_id', order_id);
    }
  }

  // Fetch updated project with share_token
  const { data: project } = await supabase
    .from('customer_projects')
    .select('*')
    .eq('id', projectId)
    .single();

  return NextResponse.json({ ok: true, project });
}

// GET — get project by order_id
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orderId = req.nextUrl.searchParams.get('order_id');
  if (!orderId) return NextResponse.json({ error: 'order_id required' }, { status: 400 });

  const { data: order } = await supabase
    .from('orders').select('designer_project_id').eq('id', orderId).single();

  if (!order?.designer_project_id) return NextResponse.json({ project: null });

  const { data: project } = await supabase
    .from('customer_projects').select('*').eq('id', order.designer_project_id).single();

  return NextResponse.json({ project });
}
