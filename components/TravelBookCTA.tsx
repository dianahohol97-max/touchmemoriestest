'use client';
import React from 'react';
import Link from 'next/link';

export function TravelBookCTA() {
  return (
    <div className="flex gap-3 flex-wrap">
      <Link
        href="https://pro.fotobookplus.com/ua/"
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 bg-[#1e2d7d] text-white text-center px-6 py-3 rounded-lg font-semibold hover:bg-[#263a99] transition-colors duration-200"
      >
        Відкрити конструктор
      </Link>
      <Link
        href="/order"
        className="flex-1 border-2 border-[#1e2d7d] text-[#1e2d7d] bg-white hover:bg-[#f0f2f8] font-semibold px-6 py-3 rounded-lg transition-colors text-center"
      >
        Оформити з дизайнером
      </Link>
    </div>
  );
}
