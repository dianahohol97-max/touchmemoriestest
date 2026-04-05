'use client';

import React from 'react';
import { ShoppingBag, Check } from 'lucide-react';
import { useT } from '@/lib/i18n/context';

export interface OrderSummaryOption {
  label: string;
  value: string;
  price?: number;
}

export interface OrderSummaryProps {
  productName: string;
  selectedOptions: OrderSummaryOption[];
  basePrice: number;
  totalPrice: number;
  isReady: boolean;
  onAddToCart: () => void;
  productionTime?: string;
  isSubmitting?: boolean;
  errorMessage?: string;
}

/**
 * Formats standard integers into Ukrainian hryvnia (UAH) format.
 * Automatically inserts non-breaking spaces for thousands.
 */
const formatUAH = (amount: number) => {
  return new Intl.NumberFormat('uk-UA', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' UAH';
};

/**
 * PriceBadge
 * Displays the current price and animates smoothly whenever the price changes.
 * Uses React keys to trigger Tailwind CSS CSS-animations on re-mounts.
 */
export function PriceBadge({ price }: { price: number }) {
  return (
    <div className="overflow-hidden h-[36px] flex items-end justify-end">
      <span 
        key={price}
        className="inline-block font-bold text-2xl tracking-tight text-gray-900 animate-in slide-in-from-bottom-2 fade-in fill-mode-both duration-300"
      >
        {formatUAH(price)}
      </span>
    </div>
  );
}

export default function OrderSummary({
  productName,
  selectedOptions,
  basePrice,
  totalPrice,
  isReady,
  onAddToCart,
  productionTime = '5–7 business days',
  isSubmitting = false,
  errorMessage
}: OrderSummaryProps) {
  const t = useT();
  return (
    <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-100 p-6 flex flex-col font-sans transition-all w-full max-w-sm relative overflow-hidden">
      {/* Optional decorative accent bar */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-400 to-teal-500 opacity-80" />
      
      <h3 className="text-xl font-bold text-gray-900 mb-6 mt-1">{productName}</h3>
      
      <div className="flex flex-col gap-3 mb-6 flex-grow">
        <div className="flex justify-between items-start text-sm">
          <span className="text-gray-500 tracking-wide">{t('order.base_price')}</span>
          <span className="font-medium text-gray-800">{formatUAH(basePrice)}</span>
        </div>

        {selectedOptions.map((opt, idx) => (
          <div key={idx} className="flex justify-between items-start text-sm group">
            <span className="text-gray-500 transition-colors group-hover:text-gray-700">
              {opt.label}: <span className="text-gray-900 font-medium ml-1">{opt.value}</span>
            </span>
            {opt.price ? (
              <span className="font-medium text-emerald-700 text-[11px] uppercase tracking-wide bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                +{formatUAH(opt.price)}
              </span>
            ) : null}
          </div>
        ))}
      </div>
      
      <div className="h-px bg-gray-100 w-full mb-6" />
      
      <div className="flex items-end justify-between mb-6">
        <span className="text-base font-semibold text-gray-900 pb-1">{t('order.total_label')}</span>
        <PriceBadge price={totalPrice} />
      </div>

      <button
        onClick={onAddToCart}
        disabled={!isReady || isSubmitting}
        className={`w-full py-3.5 px-4 rounded-xl font-semibold tracking-wide flex items-center justify-center transition-all duration-300 shadow-sm
          ${isReady && !isSubmitting
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-md hover:-translate-y-0.5 focus:ring-4 focus:ring-emerald-200 active:scale-[0.98]'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'}
        `}
      >
        {isSubmitting ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {t('order.processing')}
          </>
        ) : (
          <>
            <ShoppingBag size={18} className="mr-2" strokeWidth={2.5} />
            {t('order.place_order')}
          </>
        )}
      </button>

      {!isReady ? (
        <p className="text-center text-xs text-amber-700 font-medium mt-3 bg-amber-50 rounded-lg py-2 animate-in fade-in border border-amber-100">
          {t('order.fill_required')}
        </p>
      ) : errorMessage ? (
        <p className="text-center text-xs text-red-700 font-medium mt-3 bg-red-50 rounded-lg py-2 animate-in fade-in border border-red-100">
          {errorMessage}
        </p>
      ) : (
        <p className="text-center text-xs text-emerald-700 font-medium mt-3 bg-emerald-50 rounded-lg py-2 flex items-center justify-center gap-1.5 animate-in fade-in border border-emerald-100">
          <Check size={14} strokeWidth={2.5} />
          {t('order.ready_to_order')}
        </p>
      )}

      {productionTime && (
        <div className="mt-6 flex justify-center">
          <span className="text-[11px] text-gray-500 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-full inline-flex items-center uppercase tracking-wider font-medium">
            {t('order.production_time')} <span className="font-bold text-gray-700 ml-1.5">{productionTime}</span>
          </span>
        </div>
      )}
    </div>
  );
}
