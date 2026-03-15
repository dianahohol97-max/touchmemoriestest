import styles from './page.module.css';
import { Navigation } from '@/components/ui/Navigation';
import { Hero } from '@/components/ui/Hero';
import { FeaturedProducts } from '@/components/ui/FeaturedProducts';
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
import { ConstructorSelection } from '@/components/ui/ConstructorSelection';


import { getAdminClient } from '@/lib/supabase/admin';

export const revalidate = 3600; // ISR revalidate every hour

export default async function Home() {
  const supabase = getAdminClient();
  const { data: products } = await supabase
    .from('products')
    .select('*, categories(name, slug)')
    .eq('is_active', true)
    .or('is_popular.eq.true,slug.eq.hliantsevyi-zhurnal')
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
          <FeaturedProducts products={products || []} />
        </SectionWrapper>

        <SectionWrapper name="categories_books" defaultOrder={25}>
          <ConstructorSelection />
        </SectionWrapper>


        <SectionWrapper name="how_it_works" defaultOrder={4}>
          <HowItWorks />
        </SectionWrapper>


        <SectionWrapper name="price_calculator" defaultOrder={6}>
          <PriceCalculator />
        </SectionWrapper>


        <SectionWrapper name="travel" defaultOrder={5}>
          <TravelSection travelPost={travelPost} />
        </SectionWrapper>

        <SectionWrapper name="photo_print" defaultOrder={29}>
          <PhotoPrintPromo />
        </SectionWrapper>

        <SectionWrapper name="social_proof" defaultOrder={40}>
          <SocialProof />
        </SectionWrapper>


        <SectionWrapper name="custom_book" defaultOrder={41}>
          <CustomBookPromo />
        </SectionWrapper>

        <SectionWrapper name="blog" defaultOrder={30}>
          <BlogSection posts={blogPosts || []} />
        </SectionWrapper>

        <SectionWrapper name="final_cta" defaultOrder={50}>
          <FinalCTA />
        </SectionWrapper>
      </main>
      <Footer categories={allCategories || []} />
    </div>
  );
}
