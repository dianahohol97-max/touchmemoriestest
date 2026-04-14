import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const LOCALES = ['uk', 'en', 'ro', 'pl', 'de'];
const DOMAIN = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories1.vercel.app';

// Universal static routes (all locales)
const UNIVERSAL_PATHS = [
    { path: '', priority: 1.0, freq: 'daily' as const },
    { path: '/catalog', priority: 0.9, freq: 'daily' as const },
    { path: '/blog', priority: 0.8, freq: 'weekly' as const },
    { path: '/faq', priority: 0.5, freq: 'monthly' as const },
    { path: '/wedding', priority: 0.7, freq: 'monthly' as const },
];

// Ukrainian-only routes (UA-specific slug paths)
const UK_ONLY_PATHS = [
    { path: '/kontakty', priority: 0.6, freq: 'monthly' as const },
    { path: '/oplata-i-dostavka', priority: 0.6, freq: 'monthly' as const },
    { path: '/pro-nas', priority: 0.5, freq: 'monthly' as const },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const entries: MetadataRoute.Sitemap = [];
    const now = new Date();

    // Universal static pages for all locales
    for (const locale of LOCALES) {
        for (const { path, priority, freq } of UNIVERSAL_PATHS) {
            entries.push({
                url: `${DOMAIN}/${locale}${path}`,
                lastModified: now,
                changeFrequency: freq,
                priority,
            });
        }
    }

    // Ukrainian-only pages
    for (const { path, priority, freq } of UK_ONLY_PATHS) {
        entries.push({
            url: `${DOMAIN}/uk${path}`,
            lastModified: now,
            changeFrequency: freq,
            priority,
        });
    }

    // Dynamic product pages
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: products } = await supabase
            .from('products')
            .select('slug, updated_at')
            .eq('is_active', true);

        if (products) {
            for (const locale of LOCALES) {
                for (const product of products) {
                    entries.push({
                        url: `${DOMAIN}/${locale}/catalog/${product.slug}`,
                        lastModified: product.updated_at ? new Date(product.updated_at) : now,
                        changeFrequency: 'weekly',
                        priority: 0.8,
                    });
                }
            }
        }

        // Blog posts
        const { data: posts } = await supabase
            .from('blog_posts')
            .select('slug, updated_at')
            .eq('is_published', true);

        if (posts) {
            for (const locale of LOCALES) {
                for (const post of posts) {
                    entries.push({
                        url: `${DOMAIN}/${locale}/blog/${post.slug}`,
                        lastModified: post.updated_at ? new Date(post.updated_at) : now,
                        changeFrequency: 'monthly',
                        priority: 0.6,
                    });
                }
            }
        }
    } catch (e) {
        // Ignore DB errors in sitemap
    }

    return entries;
}
// i18n deploy trigger Wed Apr  1 15:42:51 UTC 2026
