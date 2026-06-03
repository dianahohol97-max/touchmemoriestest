'use client';
import { useT } from '@/lib/i18n/context';
import { FAQ_ITEMS } from '@/lib/faq';

export default function FAQPage() {
  const t = useT();

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-serif font-bold mb-4">{t('faq.title')}</h1>
        <p className="text-stone-500 mb-12">Відповіді на найпоширеніші запитання про наші продукти та послуги</p>
        <div className="space-y-4">
          {FAQ_ITEMS.map((faq, i) => (
            <details key={i} className="border border-stone-200 rounded-xl overflow-hidden group">
              <summary className="flex items-center justify-between p-6 cursor-pointer font-semibold text-stone-900 hover:bg-stone-50">
                {faq.q}
                <span className="ml-4 text-stone-400 group-open:rotate-180 transition-transform"></span>
              </summary>
              <div className="px-6 pb-6 text-stone-600 leading-relaxed">{faq.a}</div>
            </details>
          ))}
        </div>
        <div className="mt-16 p-8 bg-stone-50 rounded-2xl text-center">
          <p className="text-stone-700 mb-4">Не знайшли відповідь на своє запитання?</p>
          <a href="/kontakty" className="inline-block px-6 py-3 bg-stone-900 text-white rounded-full font-semibold hover:bg-stone-700 transition-colors">
            Написати нам
          </a>
        </div>
      </div>
    </div>
  );
}
