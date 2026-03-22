'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { goToConstructor } from '@/lib/constructorRouting';

export function TravelBookCTA() {
  const router = useRouter();

  const handleCreateClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const url = goToConstructor({ productType: 'travelbook' });
    router.push(url);
  };

  return (
    <div className="flex gap-3 flex-wrap">
      <a
        href="/constructor/travelbook"
        onClick={handleCreateClick}
        className="flex-1 bg-[#1e2d7d] text-white text-center px-6 py-3 rounded-lg font-semibold hover:bg-[#263a99] transition-colors duration-200 cursor-pointer"
      >
        Відкрити конструктор
      </a>
      <Link
        href="/kontakty"
        className="flex-1 border-2 border-[#1e2d7d] text-[#1e2d7d] bg-white hover:bg-[#f0f2f8] font-semibold px-6 py-3 rounded-lg transition-colors text-center"
      >
        Оформити з дизайнером
      </Link>
    </div>
  );
}
