import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const domain = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua';

    const staticRoutes: MetadataRoute.Sitemap = [
        {
            url: domain,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1,
        },
        {
            url: `${domain}/products`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.9,
        },
        {
            url: `${domain}/blog`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.8,
        },
    ];

    const { data: products } = await supabase.from('products').select('slug, updated_at').eq('is_active', true);
    const productRoutes: MetadataRoute.Sitemap = (products || []).map(p => ({
        url: `${domain}/products/${p.slug}`,
        lastModified: new Date(p.updated_at),
        changeFrequency: 'weekly',
        priority: 0.8
    }));

    const { data: blogCategories } = await supabase.from('blog_categories').select('slug, updated_at').eq('is_active', true);
    const categoryRoutes: MetadataRoute.Sitemap = (blogCategories || []).map(c => ({
        url: `${domain}/blog/category/${c.slug}`,
        lastModified: new Date(c.updated_at),
        changeFrequency: 'weekly',
        priority: 0.5
    }));

    const { data: blogPosts } = await supabase.from('blog_posts').select('slug, updated_at').eq('is_published', true);
    const postRoutes: MetadataRoute.Sitemap = (blogPosts || []).map(p => ({
        url: `${domain}/blog/${p.slug}`,
        lastModified: new Date(p.updated_at),
        changeFrequency: 'monthly',
        priority: 0.7
    }));

    return [...staticRoutes, ...productRoutes, ...categoryRoutes, ...postRoutes];
}
