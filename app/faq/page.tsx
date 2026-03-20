'use client';

export default function FAQPage() {
  const faqs = [
    {
      q: 'Скільки часу займає виготовлення?',
      a: 'Терміни залежать від типу продукту: фотожурнали — 4–8 робочих днів, фотокниги — 14 робочих днів, книги побажань — 10 робочих днів. Після оформлення замовлення менеджер зв\'яжеться з вами упродовж 24 годин.',
    },
    {
      q: 'Яка мінімальна кількість сторінок?',
      a: 'Для фотокниги — від 6 сторінок. Для фотожурналу — від 12 до 100 сторінок.',
    },
    {
      q: 'Які формати та розміри доступні для фотокниг?',
      a: 'Доступні розміри: 20×20, 25×25, 20×30 (книжкова орієнтація), 30×20 (альбомна орієнтація), 30×30 см. Фотожурнали виготовляються у форматі A4.',
    },
    {
      q: 'Як надіслати фото для виготовлення?',
      a: 'Є кілька зручних варіантів: завантажте фото на Google Диск та надайте доступ на touch.memories3@gmail.com; надішліть файлами в Telegram t.me/touchmemories; або завантажте на dropmefiles.com.ua і надішліть нам посилання.',
    },
    {
      q: 'Скільки разів можна вносити правки в макет?',
      a: 'Кількість правок необмежена і безкоштовна. Ви можете переглядати макет та вносити зміни до моменту його фінального затвердження.',
    },
    {
      q: 'Як відбувається доставка?',
      a: 'Доставляємо по всій Україні та за кордон. Вартість доставки оплачує замовник відповідно до тарифів поштової служби.',
    },
    {
      q: 'Чи можна повернути або обміняти товар?',
      a: 'Відповідно до законодавства України, індивідуально виготовлені фототовари не підлягають поверненню або обміну. Якщо товар містить виробничий брак (не той розмір, відсутній елемент тощо) — ми виготовимо новий безкоштовно.',
    },
    {
      q: 'Скільки коштують продукти?',
      a: 'Фотокнига з друкованою обкладинкою — від 450 грн, з велюровою, шкірозамінником або тканиною — від 1 050 грн. Фотожурнал — від 475 грн. Книга побажань — від 559 грн.',
    },
    {
      q: 'Як з вами зв\'язатися?',
      a: 'Пишіть нам у Telegram @touchmemories, в Instagram @touch.memories або на email touch.memories3@gmail.com. Адреса: Тернопіль, вул. Київська 2.',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-serif font-bold mb-4">Питання та відповіді</h1>
        <p className="text-stone-500 mb-12">Відповіді на найпоширеніші запитання про наші продукти та послуги</p>
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <details key={i} className="border border-stone-200 rounded-xl overflow-hidden group">
              <summary className="flex items-center justify-between p-6 cursor-pointer font-semibold text-stone-900 hover:bg-stone-50">
                {faq.q}
                <span className="ml-4 text-stone-400 group-open:rotate-180 transition-transform">▼</span>
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
