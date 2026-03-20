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
    <div className="flex flex-wrap gap-4">
      <Link
        href="/catalog/travelbook-21x21"
        className="inline-block bg-white text-[#263a99] px-8 py-3.5 rounded-full font-bold shadow-[0_4px_16px_rgba(0,0,0,0.15)] hover:bg-[#eef0fb] hover:-translate-y-0.5 transition-all duration-200"
      >
        Дізнатись більше
      </Link>
      <a
        href="/constructor/travelbook"
        onClick={handleCreateClick}
        className="inline-block border-2 border-white/30 text-white px-8 py-3.5 rounded-full font-bold hover:border-white hover:bg-white/10 transition-all duration-200 cursor-pointer"
      >
        Створити свій
      </a>
    </div>
  );
}
