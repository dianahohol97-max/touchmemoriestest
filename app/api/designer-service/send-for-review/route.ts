import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendDesignReadyEmail } from '@/lib/designer-service/emails';
import { requireAdmin } from '@/lib/auth/guards';

export async function POST(request: NextRequest) {
  // Designers / admins only — this endpoint marks a design as ready and emails
  // the customer. If left open, anyone could spam customers with "design ready"
  // notifications and flip brief.status by guessing brief IDs.
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const { briefId, projectId } = await request.json();

    if (!briefId || !projectId) {
      return NextResponse.json(
        { error: 'Brief ID and project ID are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get brief with order details
    const { data: brief, error: briefError } = await supabase
      .from('design_briefs')
      .select(`
        *,
        order:orders(
          id,
          order_number,
          customer:customers(name, email)
        )
      `)
      .eq('id', briefId)
      .single();

    if (briefError || !brief) {
      return NextResponse.json(
        { error: 'Brief not found' },
        { status: 404 }
      );
    }

    // Check if revision already exists for this project
    const { data: existingRevision } = await supabase
      .from('design_revisions')
      .select('id, revision_number')
      .eq('order_id', (brief as any).order.id)
      .eq('project_id', projectId)
      .single();

    let revisionToken;
    let revisionNumber = 0;

    if (existingRevision) {
      // Update existing revision
      revisionToken = (existingRevision as any).client_token;
      revisionNumber = existingRevision.revision_number;

      await supabase
        .from('design_revisions')
        .update({
          sent_to_client_at: new Date().toISOString(),
          client_decision: null,
          client_comments: [],
          general_feedback: '',
          reviewed_at: null,
        })
        .eq('id', existingRevision.id);
    } else {
      // Get latest revision number
      const { data: latestRevision } = await supabase
        .from('design_revisions')
        .select('revision_number')
        .eq('order_id', (brief as any).order.id)
        .order('revision_number', { ascending: false })
        .limit(1)
        .single();

      revisionNumber = latestRevision ? latestRevision.revision_number + 1 : 1;

      // Create new revision
      const { data: newRevision, error: revisionError } = await supabase
        .from('design_revisions')
        .insert({
          order_id: (brief as any).order.id,
          revision_number: revisionNumber,
          project_id: projectId,
          sent_to_client_at: new Date().toISOString(),
          revision_count: revisionNumber - 1,
        })
        .select('client_token')
        .single();

      if (revisionError) {
        console.error('Error creating revision:', revisionError);
        return NextResponse.json(
          { error: 'Failed to create revision' },
          { status: 500 }
        );
      }

      revisionToken = newRevision.client_token;
    }

    // Update brief status
    await supabase
      .from('design_briefs')
      .update({ status: 'sent_for_review' })
      .eq('id', briefId);

    // Send email to customer
    const order = (brief as any).order;
    const emailResult = await sendDesignReadyEmail({
      customerEmail: order.customer.email,
      customerName: order.customer.name,
      orderNumber: order.order_number,
      reviewToken: revisionToken,
    });

    if (!emailResult.success) {
      console.error('Failed to send design ready email:', emailResult.error);
    }

    return NextResponse.json({
      success: true,
      revisionToken,
      revisionNumber,
      emailSent: emailResult.success,
    });
  } catch (error) {
    console.error('Error sending for review:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
