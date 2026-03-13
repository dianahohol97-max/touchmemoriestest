import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com';

function escapeXml(unsafe: string) {
    if (!unsafe) return '';
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
        return c;
    });
}

export async function GET() {
    const supabase = getAdminClient();
    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .eq('is_active', true);

        if (error) throw error;

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>TouchMemories</title>
    <link>${SITE_URL}</link>
    <description>Преміальні фотокниги та подарунки</description>`;

        for (const product of products || []) {
            let availability = 'in_stock';
            if (product.track_inventory && product.stock_available <= 0) {
                availability = 'out_of_stock';
            }

            const imageLink = product.images?.[0] || `${SITE_URL}/placeholder.png`;

            xml += `
    <item>
      <g:id>${product.id}</g:id>
      <g:title>${escapeXml(product.name)}</g:title>
      <g:description>${escapeXml(product.description || product.name)}</g:description>
      <g:link>${SITE_URL}/product/${product.slug}</g:link>
      <g:image_link>${escapeXml(imageLink)}</g:image_link>
      <g:condition>new</g:condition>
      <g:availability>${availability}</g:availability>
      <g:price>${product.price} UAH</g:price>
      <g:brand>TouchMemories</g:brand>
      <g:identifier_exists>no</g:identifier_exists>
    </item>`;
        }

        xml += `
  </channel>
</rss>`;

        return new NextResponse(xml, {
            status: 200,
            headers: {
                'Content-Type': 'application/xml',
                'Cache-Control': 's-maxage=3600, stale-while-revalidate',
            },
        });
    } catch (e: any) {
        return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><error>${escapeXml(e.message)}</error>`, {
            status: 500,
            headers: { 'Content-Type': 'application/xml' }
        });
    }
}
