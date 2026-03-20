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
          <FeaturedProducts products={products || []} />
        </SectionWrapper>

        <SectionWrapper name="categories_books" defaultOrder={25}>
          <ConstructorSelection />
        </SectionWrapper>

        <SectionWrapper name="photo_print" defaultOrder={29}>
          <PhotoPrintPromo />
        </SectionWrapper>

        <SectionWrapper name="how_it_works" defaultOrder={31}>
          <HowItWorks />
        </SectionWrapper>

        <SectionWrapper name="gift_ideas" defaultOrder={35}>
          <GiftIdeas />
        </SectionWrapper>

<SectionWrapper name="travel" defaultOrder={36}>
                  {/* ─── Travel Book Feature Section (Redesigned) ─── */}
        <section className="py-20 bg-stone-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

              {/* LEFT COLUMN: Two stacked cards */}
              <div className="space-y-6">

                {/* TOP CARD — Топ локацій */}
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="aspect-video bg-gradient-to-br from-amber-100 to-stone-100 relative overflow-hidden">
                    <img
                      src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80"
                      alt="Топ локації для Travel Book"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <span className="inline-block bg-white text-stone-800 text-xs px-3 py-1 tracking-widest uppercase mb-2">
                        Натхнення
                      </span>
                      <h3 className="text-white text-xl font-serif leading-snug">
                        Топ-10 локацій України для твого Travel Book
                      </h3>
                    </div>
                  </div>
                  <div className="p-6">
                    <p className="text-stone-600 text-sm leading-relaxed mb-4">
                      Карпати, Буковель, Львів, Одеса, Київ — створи журнал своїх подорожей з найкрасивішими локаціями України.
                    </p>
                    <Link
                      href="/blog/top-locations-ukraine"
                      className="text-stone-900 font-semibold text-sm hover:text-stone-600 transition-colors inline-flex items-center gap-2"
                    >
                      Читати статтю
                      <span>→</span>
                    </Link>
                  </div>
                </div>

                {/* BOTTOM CARD — Travel Blog Article */}
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="aspect-video bg-gradient-to-br from-blue-100 to-stone-100 relative overflow-hidden">
                    <img
                      src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80"
                      alt="Тревел-бук vs фотоальбом"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <span className="inline-block bg-white text-stone-800 text-xs px-3 py-1 tracking-widest uppercase mb-2">
                        Travel
                      </span>
                      <h3 className="text-white text-xl font-serif leading-snug">
                        Тревел-бук vs фотоальбом: що обрати?
                      </h3>
                    </div>
                  </div>
                  <div className="p-6">
                    <p className="text-stone-600 text-sm leading-relaxed mb-4">
                      Розбираємо відмінності між класичним фотоальбомом і сучасним тревел-буком у форматі глянцевого журналу.
                    </p>
                    <Link
                      href="/blog/travelbook-vs-photoalbum"
                      className="text-stone-900 font-semibold text-sm hover:text-stone-600 transition-colors inline-flex items-center gap-2"
                    >
                      Читати статтю
                      <span>→</span>
                    </Link>
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: Travel Book content + constructor visualization */}
              <div className="lg:sticky lg:top-24">
                <div className="bg-white rounded-lg shadow-lg p-8">

                  {/* Label */}
                  <p className="text-xs text-amber-600 tracking-widest uppercase mb-4">
                    Новинка сезону
                  </p>

                  {/* Heading */}
                  <h2 className="text-4xl lg:text-5xl font-serif font-light text-stone-900 leading-tight mb-6">
                    Travel Book —<br />
                    <span className="italic text-stone-600">журнал твоєї подорожі</span>
                  </h2>

                  {/* Description */}
                  <p className="text-stone-600 text-lg leading-relaxed mb-8">
                    A4 формат, тверда обкладинка, 170г глянцевий папір. Ідеальний спосіб
                    зберегти спогади про подорожі у стильному виданні, яке ти створив сам.
                  </p>

                  {/* Features */}
                  <ul className="space-y-3 mb-8">
                    {[
                      'Формат A4 (21 × 29.7 см) — як справжній журнал',
                      'Від 12 до 80 сторінок на вибір',
                      'Виготовлення за 5–7 робочих днів',
                      'Доставка по всій Україні',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3 text-stone-700 text-sm">
                        <span className="text-amber-600 mt-0.5">✦</span>
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
                          className="absolute inset-0 w-full h-full object-cover opacity-70"
                        />

                        {/* Cover text overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-6">
                          <p className="text-white/60 text-xs tracking-widest uppercase mb-2">
                            EXPLORE
                          </p>
                          <p className="text-white text-xl leading-tight font-serif italic">
                            Моя подорож<br />до Карпат
                          </p>
                          <p className="text-amber-400/80 text-xs tracking-widest mt-2">
                            48°N · 24°E · 2025
                          </p>
                        </div>
                      </div>

                      {/* Price tag */}
                      <div className="absolute -top-3 -right-3 bg-amber-600 text-white px-4 py-2 text-center shadow-lg rounded-sm">
                        <p className="text-xs uppercase tracking-wider opacity-90">від</p>
                        <p className="text-2xl font-bold">550 ₴</p>
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
                  {/* ─── Blog / Inspiration Section ─── */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            {/* Header */}
            <div className="flex items-end justify-between mb-12">
              <div>
                <p className="text-xs text-stone-400 tracking-widest uppercase mb-3">
                  Натхнення
                </p>
                <h2 className="text-3xl lg:text-4xl font-serif font-light text-stone-800">
                  Ідеї та поради
                </h2>
              </div>
              <Link
                href="/blog"
                className="hidden sm:block text-sm text-stone-500 hover:text-stone-800 tracking-wider uppercase border-b border-stone-300 hover:border-stone-700 pb-0.5 transition-colors"
              >
                Всі статті →
              </Link>
            </div>

            {/* Magazine-style grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

              {/* Featured article — large */}
              <article className="md:col-span-7 group cursor-pointer">
                <Link href="/blog/iak-stvoryty-fotoknyhu">
                  <div className="relative overflow-hidden bg-stone-100" style={{ aspectRatio: '16/10' }}>
                    <img
                      src="https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&q=80"
                      alt="Як створити ідеальну фотокнигу"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <span className="inline-block bg-white text-stone-800 text-xs px-3 py-1 tracking-widest uppercase mb-3">
                        Гід
                      </span>
                      <h3 className="text-white text-xl lg:text-2xl font-serif leading-snug">
                        Як створити ідеальну фотокнигу: повний гід для початківців
                      </h3>
                      <p className="text-white/70 text-sm mt-2">5 хв читання</p>
                    </div>
                  </div>
                </Link>
              </article>

              {/* Two smaller articles */}
              <div className="md:col-span-5 flex flex-col gap-6">

                <article className="group cursor-pointer flex-1">
                  <Link href="/blog/travelbook-vs-photoalbum">
                    <div className="relative overflow-hidden bg-stone-100" style={{ aspectRatio: '16/9' }}>
                      <img
                        src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80"
                        alt="Тревел-бук"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <span className="inline-block bg-white text-stone-800 text-xs px-3 py-1 tracking-widest uppercase mb-3">
                          Travel
                        </span>
                        <h3 className="text-white text-base font-serif leading-snug">
                          Тревел-бук vs фотоальбом: що обрати для спогадів про подорож?
                        </h3>
                      </div>
                    </div>
                  </Link>
                </article>

                <article className="group cursor-pointer flex-1">
                  <Link href="/blog/vesil-ni-podarunky">
                    <div className="relative overflow-hidden bg-stone-100" style={{ aspectRatio: '16/9' }}>
                      <img
                        src="https://images.unsplash.com/photo-1472173148041-00294f0814a2?w=600&q=80"
                        alt="Весілля"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <span className="inline-block bg-white text-stone-800 text-xs px-3 py-1 tracking-widest uppercase mb-3">
                          Весілля
                        </span>
                        <h3 className="text-white text-base font-serif leading-snug">
                          Топ-5 ідей для весільного альбому, який захоплює подих
                        </h3>
                      </div>
                    </div>
                  </Link>
                </article>

              </div>
            </div>

            {/* Mobile "all articles" link */}
            <div className="mt-8 text-center sm:hidden">
              <Link
                href="/blog"
                className="text-sm text-stone-500 hover:text-stone-800 tracking-wider uppercase border-b border-stone-300 pb-0.5"
              >
                Всі статті →
              </Link>
            </div>

          </div>
        </section>
                </SectionWrapper>

        <SectionWrapper name="custom_book" defaultOrder={41}>
          <CustomBookPromo />
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
