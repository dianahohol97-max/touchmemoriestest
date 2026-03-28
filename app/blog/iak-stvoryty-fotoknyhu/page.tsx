'use client';

export default function BlogPost1() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <a href="/blog" className="text-sm text-stone-500 hover:text-stone-900 mb-8 inline-block">← Всі статті</a>
        <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Поради</span>
        <h1 className="text-4xl font-serif font-bold mt-3 mb-6">Як створити ідеальну фотокнигу: 7 порад від дизайнерів</h1>
        <p className="text-stone-500 text-sm mb-10">8 хв читання</p>
        <div className="prose prose-stone max-w-none space-y-6 text-stone-700">
          <p>Фотокнига — це не просто набір фотографій. Це розповідь, яка живе десятиліттями. Ось 7 перевірених порад, які допоможуть вам створити книгу, від якої буде складно відірватись.</p>
          <h2 className="text-xl font-bold text-stone-900 mt-8">1. Оберіть тему та розкажіть історію</h2>
          <p>Найкращі фотокниги мають чітку тему: весілля, подорож, рік у фото, дитинство. Обираючи фото, запитайте себе — чи розповідає ця сторінка частину загальної історії?</p>
          <h2 className="text-xl font-bold text-stone-900 mt-8">2. Не перевантажуйте сторінки</h2>
          <p>Золоте правило: максимум 4–6 фото на розворот. Дайте кожному знімку простір для дихання. Білий простір — це не пустота, це елегантність.</p>
          <h2 className="text-xl font-bold text-stone-900 mt-8">3. Використовуйте якісні фото</h2>
          <p>Для гарного друку потрібні фото від 300 DPI. Наш конструктор автоматично попередить, якщо роздільна здатність фото недостатня для якісного результату.</p>
        </div>
        <div className="mt-16 p-8 bg-stone-50 rounded-2xl text-center">
          <p className="font-semibold text-stone-900 mb-4">Готові створити свою фотокнигу?</p>
          <a href="/order/book?product=photobook-velour" className="inline-block px-6 py-3 bg-stone-900 text-white rounded-full font-semibold hover:bg-stone-700 transition-colors">Відкрити конструктор</a>
        </div>
      </div>
    </div>
  );
}
