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
        className="inline-block bg-white text-stone-900 px-8 py-3 text-sm tracking-widest uppercase font-medium hover:bg-stone-100 transition-colors"
      >
        Дізнатись більше
      </Link>
      <a
        href="/constructor/travelbook"
        onClick={handleCreateClick}
        className="inline-block border border-stone-600 text-stone-300 px-8 py-3 text-sm tracking-widest uppercase hover:border-stone-400 hover:text-white transition-colors cursor-pointer"
      >
        Створити свій
      </a>
    </div>
  );
}
