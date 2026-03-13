import { Navigation } from '@/components/ui/Navigation';
import { Hero } from '@/components/ui/Hero';
import { ProductStrip } from '@/components/ui/ProductStrip';
import { Categories } from '@/components/ui/Categories';
import { HowItWorks } from '@/components/ui/HowItWorks';
import { BlogSection } from '@/components/ui/BlogSection';
import { SocialProof } from '@/components/ui/SocialProof';
import { FinalCTA } from '@/components/ui/FinalCTA';
import { Footer } from '@/components/ui/Footer';
import { TravelSection } from '@/components/ui/TravelSection';
import PriceCalculator from '@/components/PriceCalculator';
import { createClient } from '@supabase/supabase-js';
import { SectionWrapper } from '@/components/ui/SectionWrapper';
import { DynamicText } from '@/components/ui/DynamicText';
import { DynamicPromo } from '@/components/ui/DynamicPromo';
import { PhotoPrintPromo } from '@/components/ui/PhotoPrintPromo';
import { CustomBookPromo } from '@/components/ui/CustomBookPromo';

import { getAdminClient } from '@/lib/supabase/admin';

export const revalidate = 3600; // ISR revalidate every hour

export default async function Home() {
  const supabase = getAdminClient();
  const { data: products } = await supabase
    .from('products')
    .select('*, categories(name, slug)')
    .eq('is_active', true)
    .eq('is_popular', true)
    .order('popular_order', { ascending: true })
    .limit(8);

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(3);

  const { data: allCategories } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  // Fetch featured travel blog post
  const { data: travelCategoryData } = await supabase
    .from('blog_categories')
    .select('id')
    .eq('slug', 'travel')
    .single();

  let travelPost = null;
  if (travelCategoryData) {
    const { data: travelPostData } = await supabase
      .from('blog_posts')
      .select(`
        *,
        category:blog_categories(name, slug)
      `)
      .eq('category_id', travelCategoryData.id)
      .eq('is_published', true)
      .eq('is_featured', true)
      .order('published_at', { ascending: false })
      .limit(1)
      .single();

    travelPost = travelPostData;
  }

  // Fetch blog posts for Blog section
  const { data: blogPosts } = await supabase
    .from('blog_posts')
    .select(`
      *,
      category:blog_categories(name, slug)
    `)
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .limit(6);

  const { data: blocks } = await supabase
    .from('site_blocks')
    .select('*')
    .order('position_order', { ascending: true });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'white' }}>
      <Navigation />
      <main style={{ display: 'flex', flexDirection: 'column' }}>
        <SectionWrapper name="hero" defaultOrder={1}>
          <Hero />
        </SectionWrapper>

        {/* Featured Products */}
        <SectionWrapper name="featured_products" defaultOrder={2}>
          {(() => {
            const block = blocks?.find((b: any) => b.block_name === 'featured_products');
            const style = block?.style_metadata || {};
            return (
              <section style={{
                padding: '40px 0 20px',
                backgroundColor: style.bg_color || 'transparent',
                borderRadius: style.border_radius || '0px'
              }}>
                <div className="container" style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <h2 style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '36px',
                    fontWeight: 900,
                    color: style.text_color || 'inherit'
                  }}>
                    <DynamicText contentKey="featured_title" fallback="Найпопулярніші товари" />
                  </h2>
                  <p style={{ color: style.text_color || '#666', opacity: style.text_color ? 1 : 0.8 }}>
                    <DynamicText contentKey="featured_subtitle" fallback="" />
                  </p>
                </div>
                <ProductStrip products={products || []} />
              </section>
            );
          })()}
        </SectionWrapper>

        <SectionWrapper name="categories" defaultOrder={3}>
          <Categories />
        </SectionWrapper>

        <SectionWrapper name="how_it_works" defaultOrder={4}>
          <HowItWorks />
        </SectionWrapper>

        <SectionWrapper name="photo_print" defaultOrder={29}>
          <PhotoPrintPromo />
        </SectionWrapper>

        <SectionWrapper name="blog" defaultOrder={30}>
          <BlogSection posts={blogPosts || []} />
        </SectionWrapper>

        <SectionWrapper name="travel" defaultOrder={5}>
          <TravelSection travelPost={travelPost} />
        </SectionWrapper>

        <SectionWrapper name="price_calculator" defaultOrder={6}>
          <PriceCalculator />
        </SectionWrapper>

        <SectionWrapper name="promo_special" defaultOrder={15}>
          <DynamicPromo blockName="promo_special" />
        </SectionWrapper>

        <SectionWrapper name="promo_holiday" defaultOrder={25}>
          <DynamicPromo blockName="promo_holiday" />
        </SectionWrapper>

        <SectionWrapper name="promo_holiday" defaultOrder={25}>
          <DynamicPromo blockName="promo_holiday" />
        </SectionWrapper>

        <SectionWrapper name="social_proof" defaultOrder={40}>
          <SocialProof />
        </SectionWrapper>

        <SectionWrapper name="custom_book" defaultOrder={41}>
          <CustomBookPromo />
        </SectionWrapper>

        <SectionWrapper name="promo_sale" defaultOrder={45}>
          <DynamicPromo blockName="promo_sale" />
        </SectionWrapper>

        <SectionWrapper name="final_cta" defaultOrder={50}>
          <FinalCTA />
        </SectionWrapper>
      </main>
      <Footer categories={allCategories || []} />
    </div>
  );
}
