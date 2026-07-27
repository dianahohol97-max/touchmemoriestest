import styles from './page.module.css';
import { getServerT } from '@/lib/i18n/server';
import { Navigation } from '@/components/ui/Navigation';
import { Hero } from '@/components/ui/Hero';
import PopularProducts from '@/components/ui/PopularProducts';

import { Categories } from '@/components/ui/Categories';
import { HowItWorks } from '@/components/ui/HowItWorks';
import { BlogSection } from '@/components/ui/BlogSection';
import { SocialProof } from '@/components/ui/SocialProof';
// import { TextReviews } from '@/components/ui/TextReviews'; // hidden from homepage (2026-06), data kept in DB
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
import LandingLinks from '@/components/seo/LandingLinks';
import type { Metadata } from 'next';
import { getCanonicalUrl, getAlternateLanguages, type Locale } from '@/lib/seo/locales';

export const revalidate = 14400; // Cache for 4 hours — homepage content rarely changes

// Home owns its canonical + hreflang. (The locale layout no longer emits
// alternates — see the note there — so the homepage must set them itself, and
// title/description/OG still merge in from the layout.)
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    alternates: {
      canonical: getCanonicalUrl(locale as Locale),
      languages: getAlternateLanguages(),
    },
  };
}

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
          .select('id, name, slug, price, price_from, sale_price, short_description, images, is_popular, popular_order, category_id, translations, categories(name, slug, translations)')
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
          .select('*, translations, category:blog_categories(name, slug)')
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
          <Hero locale={locale} />
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
        <section className="py-12 md:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Blog heading — moved up from the removed standalone "Ідеї та поради" section */}
            <div className="flex items-end justify-between mb-8 md:mb-12">
              <h2 className="text-3xl lg:text-4xl font-heading font-black text-primary tracking-tight">
                {t('home.ideas_tips')}
              </h2>
              <Link
                href="/blog"
                className="text-sm font-bold text-primary/50 hover:text-primary tracking-widest uppercase transition-colors"
              >
                {t('home.all_articles')}
              </Link>
            </div>
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
                        className="relative rounded-sm overflow-hidden shadow-2xl"
                        style={{ aspectRatio: '210/297' }}
                      >
                        <img
                          src="/images/travelbooks-hero.jpg"
                          alt="Тревелбуки touch.memories — Austria, Italy, France, Czech, Greece"
                          loading="lazy"
                          decoding="async"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
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

        {/* Text reviews section hidden from homepage per request (2026-06).
            The reviews themselves are NOT deleted — they remain in the `reviews`
            DB table and a backup lives at docs/homepage-reviews-backup.md.
            Re-enable by uncommenting this block and the TextReviews import. */}
        {/* <SectionWrapper name="text_reviews" defaultOrder={38}>
          <TextReviews />
        </SectionWrapper> */}


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
      <LandingLinks locale={locale} />
      <Footer categories={allCategories || []} />
    </div>
  );
}
