import styles from './page.module.css';
import { getServerT } from '@/lib/i18n/server';
import { getLocalized } from '@/lib/i18n/localize';
import { Navigation } from '@/components/ui/Navigation';
import { Hero } from '@/components/ui/Hero';
import PopularProducts from '@/components/ui/PopularProducts';

import { Categories } from '@/components/ui/Categories';
import { HowItWorks } from '@/components/ui/HowItWorks';
import { BlogSection } from '@/components/ui/BlogSection';
import { SocialProof } from '@/components/ui/SocialProof';
import { FinalCTA } from '@/components/ui/FinalCTA';
import { Footer } from '@/components/ui/Footer';
import { TravelSection } from '@/components/ui/TravelSection';
import { createClient } from '@supabase/supabase-js'
import { SectionWrapper } from '@/components/ui/SectionWrapper';
import { DynamicText } from '@/components/ui/DynamicText';
import { DynamicPromo } from '@/components/ui/DynamicPromo';
import { PhotoPrintPromo } from '@/components/ui/PhotoPrintPromo';
import { CustomBookPromo } from '@/components/ui/CustomBookPromo';
import { ConstructorSelection } from '@/components/ui/ConstructorSelection'
import { GiftIdeas } from '@/components/ui/GiftIdeas';
import { WeddingSection } from '@/components/ui/WeddingSection';
import Link from 'next/link';
import { TravelBookCTA } from '@/components/TravelBookCTA';


import { getAdminClient } from '@/lib/supabase/admin';

export const revalidate = 3600; // Cache for 1 hour — revalidate on deploy

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getServerT(locale);
  let products: any[] = [];
  let categories: any[] = [];
  let allCategories: any[] = [];
  let travelArticles: any[] = [];
  let featuredBlogPosts: any[] = [];
  let blocks: any[] = [];

  try {
    const supabase = getAdminClient();
    console.log('[Homepage] supabase client exists:', !!supabase);

    if (!supabase) {
      console.error('[Homepage] FATAL: Supabase client is null - env vars missing');
    } else {
      // Run all queries in parallel for maximum speed
      const [
        { data: p, error: pe },
        { data: c },
        { data: ac },
        { data: ta },
        { data: fb },
        { data: b },
      ] = await Promise.all([
        supabase
          .from('products')
          .select('*, categories(name, slug, translations)')
          .eq('is_active', true)
          .eq('is_popular', true)
          .order('popular_order', { ascending: true })
          .limit(8),
        supabase
          .from('categories')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .limit(3),
        supabase
          .from('categories')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
        supabase
          .from('featured_articles')
          .select('*')
          .eq('section', 'travel')
          .eq('is_active', true)
          .order('position', { ascending: true })
          .limit(2),
        supabase
          .from('blog_posts')
          .select('*, translations, category:blog_categories(name, slug, translations)')
          .eq('is_published', true)
          .eq('is_featured', true)
          .order('published_at', { ascending: false })
          .limit(3),
        supabase
          .from('site_blocks')
          .select('*')
          .order('position_order', { ascending: true }),
      ]);

      if (pe) console.error('[Homepage] products error:', JSON.stringify(pe));
      products = p || [];
      categories = c || [];
      allCategories = ac || [];
      travelArticles = ta || [];
      featuredBlogPosts = fb || [];
      blocks = b || [];
    }
  } catch (err) {
    console.error('[Homepage] CAUGHT FATAL ERROR:', err);
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'white' }}>
      <Navigation />
      <main style={{ display: 'flex', flexDirection: 'column' }}>
        <SectionWrapper name="hero" defaultOrder={1}>
          <Hero />
        </SectionWrapper>

        <div style={{ order: 15 }}>
          <PopularProducts locale={locale} />
        </div>

        <SectionWrapper name="categories_books" defaultOrder={25}>
          <ConstructorSelection locale={locale} />
        </SectionWrapper>

        <SectionWrapper name="photo_print" defaultOrder={29}>
          <PhotoPrintPromo locale={locale} />
        </SectionWrapper>

        <SectionWrapper name="how_it_works" defaultOrder={31}>
          <HowItWorks locale={locale} />
        </SectionWrapper>

        <SectionWrapper name="gift_ideas" defaultOrder={35}>
          <GiftIdeas locale={locale} />
        </SectionWrapper>

<SectionWrapper name="travel" defaultOrder={36}>
                  {/*  Travel Book Feature Section (Redesigned)  */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

              {/* LEFT COLUMN: Two stacked cards */}
              <div className="space-y-6">

                {travelArticles && travelArticles.map((article: any) => (
                  <div key={article.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="aspect-video bg-gradient-to-br from-[#f0f3ff] to-stone-100 relative overflow-hidden">
                      <img
                        src={article.image_url || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80'}
                        alt={article.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-6">
                        {article.category_label && (
                          <span className="inline-block text-white text-[10px] font-bold px-3 py-1 rounded-md uppercase tracking-widest mb-2" style={{ background: "rgba(38,58,153,0.7)", backdropFilter: "blur(4px)", letterSpacing: "0.12em" }}>
                            {article.category_label}
                          </span>
                        )}
                        <h3 className="text-white hover:text-white/90 text-xl font-heading font-bold leading-snug transition-colors">
                          {article.title}
                        </h3>
                      </div>
                    </div>
                    <div className="p-6">
                      <p className="text-stone-600 text-sm leading-relaxed mb-4">
                        {article.description}
                      </p>
                      <Link
                        href={article.link_url || '#'}
                        className="text-stone-900 font-semibold text-sm hover:text-stone-600 transition-colors inline-flex items-center gap-2"
                      >
                        {t('home.read_article')}
                        <span>→</span>
                      </Link>
                    </div>
                  </div>
                ))}

              </div>

              {/* RIGHT COLUMN: Travel Book content + constructor visualization */}
              <div className="lg:sticky lg:top-24">
                <div className="bg-white rounded-xl shadow-sm p-8">

                  {/* Heading */}
                  <h2 className="text-4xl lg:text-5xl font-black text-[#1e2d7d] leading-tight mb-6">
                    {t('home.travelbook_title')}
                  </h2>

                  {/* Description */}
                  <p className="text-gray-700 text-lg leading-relaxed mb-8">
                    {t('home.travelbook_desc')}
                  </p>

                  {/* Features */}
                  <ul className="space-y-3 mb-8">
                    {[
                      t('home.tb_feat_1'),
                      t('home.tb_feat_2'),
                      t('home.tb_feat_3'),
                      t('home.tb_feat_4'),
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3 text-stone-700 text-sm">
                        <span className="text-[#4a5cc7] mt-0.5">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>

                  {/* Constructor Visualization */}
                  <div className="mb-8 relative">
                    <div className="relative mx-auto" style={{ maxWidth: 320 }}>
                      {/* Book spine shadow */}
                      <div className="absolute inset-0 bg-stone-900/20 blur-xl transform translate-x-3 translate-y-3 rounded-sm" />

                      {/* Book cover */}
                      <div
                        className="relative bg-gradient-to-br from-stone-700 to-stone-900 rounded-sm overflow-hidden shadow-2xl"
                        style={{ aspectRatio: '210/297' }}
                      >
                        {/* Photo overlay */}
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />
                        <img
                          src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80"
                          alt="Travel Book Preview"
                          loading="lazy"
                          decoding="async"
                          className="absolute inset-0 w-full h-full object-cover opacity-70"
                        />

                        {/* Cover text overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-6">
                          <p className="text-white text-xl leading-tight font-serif italic">
                            Моя подорож<br />до Карпат
                          </p>
                          <p className="text-[#4a5cc7]/80 text-xs tracking-widest mt-2">
                            48°N · 24°E · 2025
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CTA Buttons */}
                  <TravelBookCTA />

                </div>
              </div>

            </div>
          </div>
        </section>
                </SectionWrapper>

        <SectionWrapper name="social_proof" defaultOrder={37}>
          <SocialProof />
        </SectionWrapper>

<SectionWrapper name="blog" defaultOrder={39}>
                  {/*  Blog / Inspiration Section  */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            {/* Header */}
            <div className="flex items-end justify-between mb-12">
              <div>
                <h2 className="text-3xl lg:text-4xl font-heading font-black text-primary tracking-tight">
                  {t('home.ideas_tips')}
                </h2>
              </div>
              <Link
                href="/blog"
                className="hidden sm:block text-sm font-bold text-primary/50 hover:text-primary tracking-widest uppercase transition-colors"
              >
                {t('home.all_articles')}
              </Link>
            </div>

            {/* Magazine-style grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

              {/* Featured article — large */}
              {featuredBlogPosts && featuredBlogPosts[0] && (
                <article className="md:col-span-6 group cursor-pointer">
                  <Link href={`/blog/${featuredBlogPosts[0].slug}`}>
                    <div className="relative overflow-hidden bg-stone-100 rounded-xl" style={{ aspectRatio: '16/10' }}>
                      <img
                        src={featuredBlogPosts[0].featured_image || 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&q=80'}
                        alt={getLocalized(featuredBlogPosts[0], locale, 'title')}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-6">
                        {featuredBlogPosts[0].category && (
                          <span className="inline-block text-white text-xs uppercase mb-3" style={{ background: 'rgba(38,58,153,0.75)', borderRadius: '6px', padding: '4px 10px', letterSpacing: '0.1em' }}>
                            {getLocalized(featuredBlogPosts[0].category, locale, 'name')}
                          </span>
                        )}
                        <h3 className="text-white text-xl lg:text-2xl font-heading font-bold leading-snug">
                          {getLocalized(featuredBlogPosts[0], locale, 'title')}
                        </h3>
                        {featuredBlogPosts[0].read_time && (
                          <p className="text-white/70 text-sm mt-2">{featuredBlogPosts[0].read_time} {t('blog.min_read')}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                </article>
              )}

              {/* Two smaller articles */}
              <div className="md:col-span-6 flex flex-col gap-6">

                {featuredBlogPosts && featuredBlogPosts.slice(1, 3).map((post: any) => (
                  <article key={post.id} className="group cursor-pointer flex-1">
                    <Link href={`/blog/${post.slug}`}>
                      <div className="relative overflow-hidden bg-stone-100 rounded-xl" style={{ aspectRatio: '16/9' }}>
                        <img
                          src={post.featured_image || 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80'}
                          alt={getLocalized(post, locale, 'title')}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          {post.category && (
                            <span className="inline-block text-white text-xs uppercase mb-3" style={{ background: 'rgba(38,58,153,0.75)', borderRadius: '6px', padding: '4px 10px', letterSpacing: '0.1em' }}>
                              {getLocalized(post.category, locale, 'name')}
                            </span>
                          )}
                          <h3 className="text-white text-base font-heading font-bold leading-snug">
                            {getLocalized(post, locale, 'title')}
                          </h3>
                        </div>
                      </div>
                    </Link>
                  </article>
                ))}

              </div>
            </div>

            {/* Mobile "all articles" link */}
            <div className="mt-8 text-center sm:hidden">
              <Link
                href="/blog"
                className="text-sm text-stone-500 hover:text-stone-800 tracking-wider uppercase border-b border-stone-300 pb-0.5"
              >
                {t('home.all_articles')}
              </Link>
            </div>

          </div>
        </section>
                </SectionWrapper>

        <SectionWrapper name="custom_book" defaultOrder={41}>
          <CustomBookPromo locale={locale} />
        </SectionWrapper>

        <SectionWrapper name="wedding" defaultOrder={45}>
          <WeddingSection />
        </SectionWrapper>

        <SectionWrapper name="final_cta" defaultOrder={50}>
          <FinalCTA />
        </SectionWrapper>
      </main>
      <Footer categories={allCategories || []} />
    </div>
  );
}
