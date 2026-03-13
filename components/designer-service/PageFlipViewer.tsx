'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';

interface Page {
  pageNumber: number;
  imageUrl: string;
  hasComments?: boolean;
}

interface PageFlipViewerProps {
  pages: Page[];
  onPageClick?: (pageNumber: number) => void;
}

export default function PageFlipViewer({ pages, onPageClick }: PageFlipViewerProps) {
  const [currentPage, setCurrentPage] = useState(0);

  const handlePrevious = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 2); // Move 2 pages (spread)
    }
  };

  const handleNext = () => {
    if (currentPage < pages.length - 2) {
      setCurrentPage(currentPage + 2); // Move 2 pages (spread)
    }
  };

  const handlePageClick = (pageIndex: number) => {
    onPageClick?.(pages[pageIndex].pageNumber);
  };

  // Calculate current spread (two pages side by side)
  const leftPage = pages[currentPage];
  const rightPage = pages[currentPage + 1];

  return (
    <div className="flex flex-col items-center w-full">
      {/* Page Counter */}
      <div className="mb-4 text-sm text-gray-600">
        Сторінка {currentPage + 1}-{Math.min(currentPage + 2, pages.length)} з {pages.length}
      </div>

      {/* Main Viewer */}
      <div className="relative w-full max-w-6xl">
        {/* Book Container */}
        <div className="relative flex items-center justify-center bg-gray-100 rounded-lg shadow-2xl p-8">
          {/* Navigation Buttons */}
          <button
            onClick={handlePrevious}
            disabled={currentPage === 0}
            className={`absolute left-2 z-10 p-3 rounded-full bg-white shadow-lg hover:bg-gray-50 transition-all ${
              currentPage === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'
            }`}
            title="Попередня сторінка"
          >
            <ChevronLeft className="h-6 w-6 text-gray-700" />
          </button>

          {/* Pages Spread */}
          <div className="flex gap-4">
            {/* Left Page */}
            {leftPage && (
              <div
                onClick={() => handlePageClick(currentPage)}
                className="relative cursor-pointer group"
                style={{
                  width: '400px',
                  height: '400px',
                  transformStyle: 'preserve-3d',
                  transform: 'perspective(1000px) rotateY(5deg)',
                  transition: 'transform 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'perspective(1000px) rotateY(0deg) scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'perspective(1000px) rotateY(5deg)';
                }}
              >
                <div className="relative w-full h-full bg-white rounded-l-lg shadow-xl overflow-hidden">
                  <Image
                    src={leftPage.imageUrl}
                    alt={`Сторінка ${leftPage.pageNumber}`}
                    fill
                    className="object-cover"
                    sizes="400px"
                  />
                  {/* Comment Indicator */}
                  {leftPage.hasComments && (
                    <div className="absolute top-2 right-2 bg-blue-500 text-white p-2 rounded-full shadow-lg">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                  )}
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center">
                    <span className="text-white text-lg font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Клацніть, щоб залишити коментар
                    </span>
                  </div>
                </div>
                {/* Page Number */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-xs text-gray-500">
                  {leftPage.pageNumber}
                </div>
              </div>
            )}

            {/* Right Page */}
            {rightPage && (
              <div
                onClick={() => handlePageClick(currentPage + 1)}
                className="relative cursor-pointer group"
                style={{
                  width: '400px',
                  height: '400px',
                  transformStyle: 'preserve-3d',
                  transform: 'perspective(1000px) rotateY(-5deg)',
                  transition: 'transform 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'perspective(1000px) rotateY(0deg) scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'perspective(1000px) rotateY(-5deg)';
                }}
              >
                <div className="relative w-full h-full bg-white rounded-r-lg shadow-xl overflow-hidden">
                  <Image
                    src={rightPage.imageUrl}
                    alt={`Сторінка ${rightPage.pageNumber}`}
                    fill
                    className="object-cover"
                    sizes="400px"
                  />
                  {/* Comment Indicator */}
                  {rightPage.hasComments && (
                    <div className="absolute top-2 right-2 bg-blue-500 text-white p-2 rounded-full shadow-lg">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                  )}
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center">
                    <span className="text-white text-lg font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Клацніть, щоб залишити коментар
                    </span>
                  </div>
                </div>
                {/* Page Number */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-xs text-gray-500">
                  {rightPage.pageNumber}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleNext}
            disabled={currentPage >= pages.length - 2}
            className={`absolute right-2 z-10 p-3 rounded-full bg-white shadow-lg hover:bg-gray-50 transition-all ${
              currentPage >= pages.length - 2 ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'
            }`}
            title="Наступна сторінка"
          >
            <ChevronRight className="h-6 w-6 text-gray-700" />
          </button>
        </div>

        {/* Keyboard Hint */}
        <div className="mt-4 text-center text-xs text-gray-500">
          Використовуйте клавіші ← → для навігації
        </div>
      </div>

      {/* Thumbnail Navigation */}
      <div className="mt-6 w-full max-w-6xl">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {pages.map((page, index) => (
            <button
              key={page.pageNumber}
              onClick={() => setCurrentPage(index % 2 === 0 ? index : index - 1)}
              className={`relative flex-shrink-0 w-16 h-16 rounded border-2 transition-all ${
                index >= currentPage && index < currentPage + 2
                  ? 'border-blue-500 scale-110'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <Image
                src={page.imageUrl}
                alt={`Мініатюра ${page.pageNumber}`}
                fill
                className="object-cover rounded"
                sizes="64px"
              />
              {page.hasComments && (
                <div className="absolute -top-1 -right-1 bg-blue-500 w-3 h-3 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
