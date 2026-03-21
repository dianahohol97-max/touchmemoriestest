'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, Image, Palette } from 'lucide-react';

export default function PhotobookConstructor() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Назад</span>
          </button>
          <h1 className="text-xl font-bold text-gray-900">Конструктор фотокниги</h1>
          <div className="w-24" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
            <BookOpen size={40} className="text-blue-600" />
          </div>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Конструктор фотокниги
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Створіть свою ідеальну фотокнигу в нашому онлайн-конструкторі.
            Обирайте формат, макети та додавайте свої найкращі моменти.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
              <Image size={24} className="text-green-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Додайте фото</h3>
            <p className="text-sm text-gray-600">
              Завантажте ваші улюблені фотографії
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full mb-4">
              <Palette size={24} className="text-purple-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Оберіть дизайн</h3>
            <p className="text-sm text-gray-600">
              Виберіть стиль та макети сторінок
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-orange-100 rounded-full mb-4">
              <BookOpen size={24} className="text-orange-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Створіть книгу</h3>
            <p className="text-sm text-gray-600">
              Отримайте преміальну фотокнигу
            </p>
          </div>
        </div>

        {/* Coming Soon Notice */}
        <div className="bg-white rounded-lg border border-blue-200 p-8 text-center">
          <div className="inline-block bg-blue-100 text-blue-800 text-sm font-semibold px-4 py-2 rounded-full mb-4">
            Незабаром
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            Конструктор у розробці
          </h3>
          <p className="text-gray-600 mb-6">
            Ми працюємо над створенням найкращого конструктора фотокниг.
            А поки що, ви можете оформити замовлення з нашим дизайнером.
          </p>
          <button
            onClick={() => router.push('/kontakty')}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-full font-bold hover:bg-blue-700 transition-colors"
          >
            Зв'язатися з дизайнером
          </button>
        </div>
      </main>
    </div>
  );
}
