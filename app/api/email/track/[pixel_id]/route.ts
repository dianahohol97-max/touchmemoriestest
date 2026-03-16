import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ pixel_id: string }> }
) {
    const { pixel_id } = await params;
    const supabase = getAdminClient();

    if (pixel_id) {
        // Fast-fire background update, no need to wait or block the response
        supabase
            .from('email_logs')
            .update({
                status: 'opened',
                opened_at: new Date().toISOString()
            })
            .eq('tracking_pixel_id', pixel_id)
            .is('opened_at', null) // Only update if not already opened
            .then((res: any) => {
                if (res.error) console.error('Tracking error:', res.error);
            });
    }

    // Return a 1x1 transparent GIF
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

    return new NextResponse(pixel, {
        headers: {
            'Content-Type': 'image/gif',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
        },
    });
}
