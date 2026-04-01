'use client';

export default function BlogPost2() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <a href="/blog" className="text-sm text-stone-500 hover:text-stone-900 mb-8 inline-block">← Всі статті</a>
        <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Travel</span>
        <h1 className="text-4xl font-serif font-bold mt-3 mb-6">Тревел-бук vs фотоальбом: що обрати для спогадів про подорож?</h1>
        <p className="text-stone-500 text-sm mb-10">5 хв читання</p>
        <div className="space-y-6 text-stone-700">
          <p>Ви повернулись з незабутньої подорожі та хочете зберегти ці спогади назавжди. Але що обрати — класичний фотоальбом чи сучасний тревел-бук?</p>
          <h2 className="text-xl font-bold text-stone-900 mt-8">Тревел-бук — для тих, хто любить розповідати</h2>
          <p>Тревел-бук — це книга-журнал у форматі A4. Поруч з фото можна додавати тексти, мапи, квитки та нотатки. Ідеально для тривалих подорожей, де кожен день — нова пригода.</p>
          <h2 className="text-xl font-bold text-stone-900 mt-8">Фотоальбом — для чистої естетики</h2>
          <p>Класичний фотоальбом 23×23 см фокусується на красі знімків. Мінімум тексту, максимум вражень. Ідеальний варіант для фотографів та любителів мінімалізму.</p>
        </div>
        <div className="mt-16 p-8 bg-stone-50 rounded-2xl text-center">
          <p className="font-semibold text-stone-900 mb-4">Обидва продукти доступні в нашому магазині</p>
          <a href="/catalog" className="inline-block px-6 py-3 bg-stone-900 text-white rounded-full font-semibold hover:bg-stone-700 transition-colors">Переглянути каталог</a>
        </div>
      </div>
    </div>
  );
}
