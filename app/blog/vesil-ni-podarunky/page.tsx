'use client';

export default function BlogPost3() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <a href="/blog" className="text-sm text-stone-500 hover:text-stone-900 mb-8 inline-block">← Всі статті</a>
        <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Весілля</span>
        <h1 className="text-4xl font-serif font-bold mt-3 mb-6">Топ-5 ідей для весільного альбому, який захоплює подих</h1>
        <p className="text-stone-500 text-sm mb-10">6 хв читання</p>
        <div className="space-y-6 text-stone-700">
          <p>Весільний альбом — це перша книга вашої сім'ї. Вона буде стояти на полиці та чекати, поки ваші діти і онуки захочуть побачити той самий день з нових очей.</p>
          <h2 className="text-xl font-bold text-stone-900 mt-8">1. Класичний хронологічний стиль</h2>
          <p>Від підготовки до першого танцю — розкажіть день так, як він відбувався. Хронологія допомагає заново пережити кожну емоцію.</p>
          <h2 className="text-xl font-bold text-stone-900 mt-8">2. Чорно-білий альбом</h2>
          <p>Монохром надає весільним фото вічну класику. Такий альбом не застаріє через 30 років.</p>
        </div>
        <div className="mt-16 p-8 bg-stone-50 rounded-2xl text-center">
          <p className="font-semibold text-stone-900 mb-4">Створіть свій весільний альбом</p>
          <a href="/constructor/photobook" className="inline-block px-6 py-3 bg-stone-900 text-white rounded-full font-semibold hover:bg-stone-700 transition-colors">Відкрити конструктор</a>
        </div>
      </div>
    </div>
  );
}
