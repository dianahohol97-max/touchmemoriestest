'use client';

import { Star } from 'lucide-react';
import { getLocalized } from '@/lib/i18n/localize';
import styles from './ProductDetailsTabs.module.css';

/**
 * ProductDetailsTabs — the "Description / Specs / Reviews" tab block on product
 * detail pages. Extracted from ProductClient.tsx so the same block can be
 * rendered in two places (under the gallery on desktop, after the grid on
 * mobile) while sharing the same activeTab state.
 *
 * The desktop/mobile placement is controlled via CSS-driven .tabsDesktop /
 * .tabsMobile wrapper classes in the parent — this component itself doesn't
 * know which placement it is in.
 */

type ActiveTab = 'description' | 'specs' | 'reviews';

type Spec = {
  label?: string;
  key?: string;
  name?: string;
  value?: string;
  [k: string]: any;
};

type ProductForTabs = {
  description?: string | null;
  translations?: any;
  specs?: Spec[];
};

interface ProductDetailsTabsProps {
  product: ProductForTabs;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  locale: string;
  t: (key: string) => string;
  /** Optional top border. Defaults to true. Set false when rendered inside the
   *  gallery column where the gallery itself provides visual separation. */
  showTopBorder?: boolean;
}

export function ProductDetailsTabs({
  product,
  activeTab,
  setActiveTab,
  locale,
  t,
  showTopBorder = true,
}: ProductDetailsTabsProps) {
  const tabButtonStyle = (isActive: boolean) => ({
    background: 'none',
    border: 'none',
    borderBottom: isActive ? '3px solid var(--primary)' : '3px solid transparent',
    paddingBottom: '16px',
    fontSize: '18px',
    fontWeight: isActive ? 800 : 500,
    color: isActive ? '#263A99' : '#64748b',
    cursor: 'pointer',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap' as const,
  });

  return (
    <div
      style={{
        borderTop: showTopBorder ? '1px solid #e2e8f0' : 'none',
        paddingTop: showTopBorder ? '60px' : '24px',
        marginBottom: '40px',
      }}
    >
      {/* Tab buttons */}
      <div
        style={{
          display: 'flex',
          gap: '40px',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '40px',
          overflowX: 'auto',
        }}
        className={styles.customScrollbar}
      >
        <button
          onClick={() => setActiveTab('description')}
          className={styles.tabBtn}
          style={tabButtonStyle(activeTab === 'description')}
        >
          {t('product_page.description_tab')}
        </button>

        {product.specs && product.specs.length > 0 && (
          <button
            onClick={() => setActiveTab('specs')}
            className={styles.tabBtn}
            style={tabButtonStyle(activeTab === 'specs')}
          >
            {t('product_page.specs_tab')}
          </button>
        )}

        <button
          onClick={() => setActiveTab('reviews')}
          className={styles.tabBtn}
          style={tabButtonStyle(activeTab === 'reviews')}
        >
          {t('product_page.reviews_tab')}
        </button>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'description' &&
          (() => {
            const localizedDesc = getLocalized(product, locale, 'description');
            return localizedDesc ? (
              <div
                style={{
                  maxWidth: '800px',
                  lineHeight: 1.8,
                  fontSize: '16px',
                  color: '#475569',
                }}
                dangerouslySetInnerHTML={{ __html: localizedDesc }}
              />
            ) : (
              <div className="text-slate-500 py-8">
                {t('product_page.no_description')}
              </div>
            );
          })()}

        {activeTab === 'specs' && product.specs && product.specs.length > 0 && (
          <div style={{ maxWidth: 600 }}>
            {product.specs.map((spec: Spec, idx: number) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 16,
                  padding: '14px 0',
                  borderBottom:
                    idx < (product.specs?.length ?? 0) - 1
                      ? '1px solid #f1f5f9'
                      : 'none',
                }}
              >
                <div
                  style={{
                    minWidth: 160,
                    fontSize: 14,
                    color: '#64748b',
                    fontWeight: 500,
                    flexShrink: 0,
                  }}
                >
                  {locale !== 'uk' && spec[`label_${locale}`]
                    ? spec[`label_${locale}`]
                    : spec.label || spec.key || spec.name}
                </div>
                <div
                  style={{
                    flex: 1,
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#1e2d7d',
                  }}
                >
                  {locale !== 'uk' && spec[`value_${locale}`]
                    ? spec[`value_${locale}`]
                    : spec.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '32px',
            }}
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  backgroundColor: '#f8f9fa',
                  padding: '24px',
                  borderRadius: '3px',
                  border: '1px solid #f1f5f9',
                }}
              >
                <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} size={16} fill="#fbbf24" color="#fbbf24" />
                  ))}
                </div>
                <p
                  style={{
                    fontSize: '15px',
                    color: '#475569',
                    lineHeight: 1.6,
                    marginBottom: '16px',
                  }}
                >
                  {t('product_page.review_text')}
                </p>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#263A99' }}>
                  {t('product_page.review_author')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
