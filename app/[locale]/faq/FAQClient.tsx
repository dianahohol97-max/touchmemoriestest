'use client';
import { useT } from '@/lib/i18n/context';

export default function FAQPage() {
  const t = useT();
  const faqs = [
    {
      category: 'Замовлення',
      q: 'Як відбувається процес замовлення?',
      a: 'Оберіть продукт на сайті та оформіть замовлення. Упродовж 24 годин менеджер зв\'яжеться з вами для уточнення деталей та узгодження макету.',
    },
    {
      category: 'Замовлення',
      q: 'Скільки часу займає виготовлення?',
      a: 'Терміни залежать від типу продукту: фотокниги — 14 робочих днів, фотожурнали — 4–8 робочих днів, книги побажань — 10 робочих днів.',
    },
    {
      category: 'Замовлення',
      q: 'Яка мінімальна кількість сторінок?',
      a: 'Для фотокниги — від 6 сторінок. Для фотожурналу — від 12 до 100 сторінок.',
    },
    {
      category: 'Замовлення',
      q: 'Скільки разів можна вносити правки в макет?',
      a: 'Кількість правок необмежена і безкоштовна. Ви можете вносити зміни до моменту фінального затвердження.',
    },
    {
      category: t('faq.cat_delivery'),
      q: 'Як відбувається доставка?',
      a: 'Доставляємо по всій Україні та за кордон. Вартість доставки оплачує замовник відповідно до тарифів поштової служби.',
    },
    {
      category: t('faq.cat_delivery'),
      q: 'Чи можна повернути товар?',
      a: 'Відповідно до законодавства України, індивідуально виготовлені товари не підлягають поверненню. Якщо є виробничий брак — виготовимо новий безкоштовно.',
    },
    {
      category: t('faq.cat_constructor'),
      q: 'Як надіслати фото для виготовлення?',
      a: 'Є кілька варіантів: Google Диск (доступ на touch.memories3@gmail.com), Telegram t.me/touchmemories, або dropmefiles.com.ua.',
    },
    {
      category: t('faq.cat_payment'),
      q: 'Яка способи оплати?',
      a: 'Оплата узгоджується з менеджером: передоплата або повна оплата. Приймаємо банківські перекази та онлайн-платежі.',
    },
    {
      category: 'Якість',
      q: 'Яка якість друку?',
      a: 'Ми використовуємо цифровий друк із гарантією якості 100 років. Папір 170 г/м², яскраві кольори, глянцеве або матове покриття на вибір.',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-serif font-bold mb-4">{t('faq.title')}</h1>
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
