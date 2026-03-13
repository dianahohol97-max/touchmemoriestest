import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const domain = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua';

    const { data: posts } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(20);

    const generateRssItem = (post: any) => `
        <item>
            <guid>${domain}/blog/${post.slug}</guid>
            <title><![CDATA[${post.title}]]></title>
            <link>${domain}/blog/${post.slug}</link>
            <description><![CDATA[${post.excerpt}]]></description>
            <pubDate>${new Date(post.published_at).toUTCString()}</pubDate>
        </item>
    `;

    const rssString = `<?xml version="1.0" encoding="UTF-8" ?>
        <rss version="2.0">
            <channel>
                <title>TouchMemories Блог</title>
                <link>${domain}/blog</link>
                <description>Останні статті, ідеї для подарунків та поради від TouchMemories</description>
                <language>uk</language>
                ${posts?.map(generateRssItem).join('')}
            </channel>
        </rss>
    `;

    return new NextResponse(rssString.trim(), {
        headers: {
            'Content-Type': 'text/xml; charset=utf-8',
        },
    });
}
