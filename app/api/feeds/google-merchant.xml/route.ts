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

// Google Merchant keeps recommending "add cover material + photo capacity" for
// the photo-album category. We don't store those as clean columns, but the name,
// description and cover options carry them — derive them here so the feed exposes
// g:material + g:product_detail (structured highlights) and mentions them in the
// description. Conservative: when a value can't be detected confidently we emit
// nothing for that product rather than guessing.
function detectCoverMaterial(hay: string): string | null {
    const s = hay.toLowerCase();
    if (/велюр|velour/.test(s)) return 'Велюр';
    if (/оксамит|velvet|aksamit/.test(s)) return 'Оксамит';
    if (/екошкір|еко-шкір|шкір|leather|kunstleder|skóra|skora/.test(s)) return 'Екошкіра';
    if (/друкован|printed|bedruckt|drukowan/.test(s)) return 'Друкована';
    if (/тканин|fabric|stoff|tkanina/.test(s)) return 'Тканина';
    return null;
}

function detectPhotoCapacity(hay: string): string | null {
    // "на 500 фото", "500 фото", "500 zdjęć", "500 Fotos", "500 photos".
    const m = hay.match(/на\s*(\d{2,4})\s*фото/i) || hay.match(/(\d{2,4})\s*(?:фото|zdj[ęe]ć|foto|photos?)/i);
    const n = m ? parseInt(m[1], 10) : NaN;
    return Number.isFinite(n) && n >= 20 && n <= 5000 ? `${n} фото` : null;
}

export async function GET() {
    const supabase = getAdminClient();
    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('id, name, slug, description, short_description, price, sale_price, price_from, images, track_inventory, stock_available, product_type, options, categories(name)')
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
            let desc = String(product.description || product.short_description || product.name || '')
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            // Derive the two attributes Merchant Center asks for from everything
            // we know about the product (name + description + cover options).
            const haystack = `${product.name || ''} ${desc} ${JSON.stringify(product.options || [])}`;
            const coverMaterial = detectCoverMaterial(haystack);
            const photoCapacity = detectPhotoCapacity(`${product.name || ''} ${desc}`);

            // Surface the detected specs in the description too (Google flags this
            // as "add to description"), but only the bits not already written there.
            const extraBits: string[] = [];
            if (coverMaterial && !new RegExp(coverMaterial, 'i').test(desc)) {
                extraBits.push(`Матеріал обкладинки: ${coverMaterial}`);
            }
            if (photoCapacity && !new RegExp(photoCapacity.replace(/[^0-9]/g, ''), 'i').test(desc)) {
                extraBits.push(`Кількість фото: ${photoCapacity}`);
            }
            if (extraBits.length) {
                desc = `${desc} · ${extraBits.join(' · ')}`.trim();
            }
            desc = desc.slice(0, 4900);

            const productType = (product.categories as any)?.name || '';
            const regular = Number(product.price || 0).toFixed(2);
            const sale =
                product.sale_price && Number(product.sale_price) > 0 && Number(product.sale_price) < Number(product.price)
                    ? Number(product.sale_price).toFixed(2)
                    : null;

            // Structured highlights Google reads as "product details" / attributes.
            const details = [
                coverMaterial ? { name: 'Матеріал обкладинки', value: coverMaterial } : null,
                photoCapacity ? { name: 'Кількість фото', value: photoCapacity } : null,
            ].filter(Boolean) as { name: string; value: string }[];
            const detailXml = details.map(d => `
      <g:product_detail>
        <g:section_name>Характеристики</g:section_name>
        <g:attribute_name>${escapeXml(d.name)}</g:attribute_name>
        <g:attribute_value>${escapeXml(d.value)}</g:attribute_value>
      </g:product_detail>`).join('');

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
      <g:product_type>${escapeXml(productType)}</g:product_type>` : ''}${coverMaterial ? `
      <g:material>${escapeXml(coverMaterial)}</g:material>` : ''}${detailXml}
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
