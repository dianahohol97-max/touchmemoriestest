'use client';
import { useT } from '@/lib/i18n/context';
import React, { useState } from 'react';
import Link from 'next/link';
import DesignerConfigModal from './DesignerConfigModal';

export function TravelBookCTA() {
  const t = useT();
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  return (
    <>
      <div className="flex gap-3 flex-wrap">
        <Link
          href="/order/book?product=travelbook-20x30"
          className="flex-1 bg-[#1e2d7d] text-white text-center px-6 py-3 rounded-full font-semibold hover:bg-[#263a99] transition-colors duration-200"
        >
          {t('ui.open_constructor')}
        </Link>
        <button
          onClick={() => setIsConfigModalOpen(true)}
          className="flex-1 border-2 border-[#1e2d7d] text-[#1e2d7d] bg-white hover:bg-[#f0f2f8] font-semibold px-6 py-3 rounded-xl transition-colors text-center"
        >
          {t('ui.order_with_designer')}
        </button>
      </div>

      <DesignerConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        productType="travelbook"
        productName="Travel Book"
      />
    </>
  );
}
