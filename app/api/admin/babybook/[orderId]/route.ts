import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';
import { getEngineConfig, BABYBOOK } from '@/lib/babybook/config';

export const dynamic = 'force-dynamic';

// GET /api/admin/babybook/[orderId] → brief + design_briefs stage tracking + engine state
export async function GET(_req: Request, { params }: { params: Promise<{ orderId: string }> }) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const { orderId } = await params;
    const admin = getAdminClient();

    const { data: brief } = await admin
        .from('babybook_briefs')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();

    const { data: designBrief } = await admin
        .from('design_briefs')
        .select('babybook_order_slug, babybook_stage, babybook_stages')
        .eq('order_id', orderId)
        .maybeSingle();

    // Signed URLs for any uploaded photos so the designer can view them.
    let childPhotoUrls: string[] = [];
    if (brief?.child_photos?.length) {
        const { data: signed } = await admin.storage
            .from('design-briefs')
            .createSignedUrls(brief.child_photos, 60 * 60);
        childPhotoUrls = (signed || []).map((s: any) => s.signedUrl).filter(Boolean);
    }

    const engine = getEngineConfig();

    return NextResponse.json({
        brief: brief || null,
        stage: designBrief?.babybook_stage || null,
        stages: designBrief?.babybook_stages || {},
        engineSlug: designBrief?.babybook_order_slug || null,
        childPhotoUrls,
        engineEnabled: engine.enabled,
        cabinUrl: engine.enabled && designBrief?.babybook_order_slug
            ? `${engine.url}/cabin/${designBrief.babybook_order_slug}`
            : null,
        spec: { pages: BABYBOOK.pages, spreads: BABYBOOK.spreads, stages: BABYBOOK.stages },
    });
}
