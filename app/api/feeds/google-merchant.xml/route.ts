import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Must be the live domain. Falls back to the canonical host (not .com) so the
// feed is valid even if NEXT_PUBLIC_SITE_URL is unset.
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua').replace(/\/$/, '');

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
            .select('id, name, slug, description, short_description, price, sale_price, price_from, images, track_inventory, stock_available, product_type, categories(name)')
            .eq('is_active', true);

        if (error) throw error;

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>Touch.Memories</title>
    <link>${SITE_URL}</link>
    <description>Фотокниги, журнали та фотовироби на замовлення</description>`;

        for (const product of products || []) {
            let availability = 'in_stock';
            if (product.track_inventory && (product.stock_available ?? 0) <= 0) {
                availability = 'out_of_stock';
            }

            const imageLink = product.images?.[0] || `${SITE_URL}/placeholder.png`;
            const desc = String(product.description || product.short_description || product.name || '')
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 4900);
            const productType = (product.categories as any)?.name || '';
            const regular = Number(product.price || 0).toFixed(2);
            const sale =
                product.sale_price && Number(product.sale_price) > 0 && Number(product.sale_price) < Number(product.price)
                    ? Number(product.sale_price).toFixed(2)
                    : null;

            xml += `
    <item>
      <g:id>${product.id}</g:id>
      <g:title>${escapeXml(product.name)}</g:title>
      <g:description>${escapeXml(desc)}</g:description>
      <g:link>${SITE_URL}/uk/catalog/${product.slug}</g:link>
      <g:image_link>${escapeXml(imageLink)}</g:image_link>
      <g:condition>new</g:condition>
      <g:availability>${availability}</g:availability>
      <g:price>${regular} UAH</g:price>${sale ? `
      <g:sale_price>${sale} UAH</g:sale_price>` : ''}${productType ? `
      <g:product_type>${escapeXml(productType)}</g:product_type>` : ''}
      <g:brand>Touch.Memories</g:brand>
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
