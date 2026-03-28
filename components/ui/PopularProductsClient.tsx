'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  sale_price: number | null;
  price_from: boolean;
  images: string[];
}

interface SectionContent {
  heading: string | null;
  subheading: string | null;
  cta_text: string | null;
  cta_url: string | null;
}

interface PopularProductsClientProps {
  products: Product[];
  sectionContent?: SectionContent;
}

export function PopularProductsClient({ products, sectionContent }: PopularProductsClientProps) {
  const heading = sectionContent?.heading || 'Популярні продукти';
  const ctaText = sectionContent?.cta_text || 'Переглянути всі продукти →';
  const ctaUrl  = sectionContent?.cta_url  || '/catalog';

  const CARD_WIDTH = 260;
  const GAP = 20;
  const STEP = CARD_WIDTH + GAP;

  const [offset, setOffset] = useState(0);
  const maxOffset = Math.max(0, products.length * STEP - GAP - 4 * STEP);

  const scrollLeft  = () => setOffset(o => Math.max(0, o - STEP));
  const scrollRight = () => setOffset(o => Math.min(maxOffset, o + STEP));

  if (products.length === 0) return null;

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">

        <div className="flex items-center justify-between mb-10">
          <h2 className="font-heading font-bold text-3xl md:text-4xl text-[#1a1a2e]">
            {heading}
          </h2>
          <div className="flex gap-3">
            <button
              onClick={scrollLeft}
              disabled={offset === 0}
              aria-label="Previous"
              style={{
                width: '44px', height: '44px', borderRadius: '50%',
                background: '#1e2d7d', color: '#fff', border: 'none',
                cursor: offset === 0 ? 'not-allowed' : 'pointer',
                opacity: offset === 0 ? 0.35 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(38,58,153,0.3)', transition: 'all 0.2s', flexShrink: 0,
              }}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={scrollRight}
              disabled={offset >= maxOffset}
              aria-label="Next"
              style={{
                width: '44px', height: '44px', borderRadius: '50%',
                background: '#1e2d7d', color: '#fff', border: 'none',
                cursor: offset >= maxOffset ? 'not-allowed' : 'pointer',
                opacity: offset >= maxOffset ? 0.35 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(38,58,153,0.3)', transition: 'all 0.2s', flexShrink: 0,
              }}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div style={{ overflow: 'hidden' }}>
          <div
            style={{
              display: 'flex', gap: `${GAP}px`,
              transform: `translateX(-${offset}px)`,
              transition: 'transform 0.4s cubic-bezier(0.23,1,0.32,1)',
            }}
          >
            {products.map((product) => (
              <Link
                key={product.id}
                href={`/catalog/${product.slug}`}
                style={{
                  flexShrink: 0, width: `${CARD_WIDTH}px`,
                  background: '#ffffff', borderRadius: '12px', overflow: 'hidden',
                  boxShadow: '0 4px 20px rgba(38,58,153,0.07)',
                  textDecoration: 'none', display: 'block',
                  transition: 'transform 0.25s, box-shadow 0.25s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 32px rgba(38,58,153,0.14)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = '';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(38,58,153,0.07)';
                }}
              >
                <div style={{ aspectRatio: '3/4', background: '#f0f2ff', overflow: 'hidden' }}>
                  {product.images?.[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>
                      📸
                    </div>
                  )}
                </div>

                <div style={{ padding: '14px 16px' }}>
                  <h3 style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1a1a2e', lineHeight: 1.35, marginBottom: '6px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {product.name}
                  </h3>
                  <p style={{ fontWeight: 800, fontSize: '1rem', color: '#1e2d7d' }}>
                    {product.price_from ? 'від ' : ''}
                    {(product.sale_price ?? product.price).toLocaleString('uk-UA')} ₴
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="text-center mt-10">
          <Link href={ctaUrl} className="inline-flex items-center gap-2 text-[#1e2d7d] font-semibold hover:underline text-sm">
            {ctaText}
          </Link>
        </div>

      </div>
    </section>
  );
}
