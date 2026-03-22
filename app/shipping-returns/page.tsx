import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { RefreshCcw, Package, Clock, ShieldCheck, CreditCard, Truck } from 'lucide-react';

export const metadata = {
  title: 'Доставка та оплата | Touch.Memories',
  description: 'Умови доставки по Україні та за кордон. Способи оплати: переказ, онлайн оплата. Гарантія якості та порядок обміну.',
};

export default function ShippingReturnsPage() {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <Navigation />

            <main className="flex-1 pt-32 pb-20">
                <div className="container max-w-4xl mx-auto px-4">
                    <header className="text-center mb-16">
                        <h1 className="text-5xl font-black text-gray-900 mb-4 font-heading tracking-tight">
                            Доставка та оплата
                        </h1>
                        <p className="text-xl text-gray-600">
                            Вся інформація про доставку, оплату та гарантії якості.
                        </p>
                    </header>

                    {/* Delivery & Payment Section */}
                    <div className="mb-16">
                        <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Доставка і оплата</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                            {/* Delivery */}
                            <div className="bg-white p-8 rounded-[3px] shadow-sm border border-gray-100">
                                <div className="bg-indigo-50 w-14 h-14 rounded-[3px] flex items-center justify-center mb-6">
                                    <Truck className="h-7 w-7 text-indigo-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-4">Доставка</h3>
                                <ul className="text-gray-600 leading-relaxed space-y-3">
                                    <li className="flex items-start gap-2">
                                        <span className="text-indigo-600 font-bold">•</span>
                                        <span><strong>Тернопіль — самовивіз</strong><br />Вул. Київська 2, Тернопіль. Уточнюйте наявність перед приїздом.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-indigo-600 font-bold">•</span>
                                        <span><strong>Доставка по Україні</strong><br />Нова Пошта або Укрпошта. Термін доставки залежить від перевізника.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-indigo-600 font-bold">•</span>
                                        <span><strong>Доставка за кордон</strong><br />Доставляємо в будь-який куточок світу. Термін та вартість залежать від перевізника та країни призначення.</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Payment */}
                            <div className="bg-white p-8 rounded-[3px] shadow-sm border border-gray-100">
                                <div className="bg-emerald-50 w-14 h-14 rounded-[3px] flex items-center justify-center mb-6">
                                    <CreditCard className="h-7 w-7 text-emerald-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-4">Спосіб оплати</h3>
                                <ul className="text-gray-600 leading-relaxed space-y-3">
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-600 font-bold">•</span>
                                        <span>Ми працюємо офіційно — оплата здійснюється на рахунок ФОП у Monobank.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-600 font-bold">•</span>
                                        <span><strong>Передоплата</strong><br />Всі замовлення виконуються за передоплатою. Оскільки кожен продукт виготовляється індивідуально під ваше замовлення, ми не можемо розпочати роботу без підтвердження оплати.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-600 font-bold">•</span>
                                        <span><strong>Оплата при отриманні</strong><br />Для постійних клієнтів або при попередньому узгодженні можлива оплата накладеним платежем через Нову Пошту.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-600 font-bold">•</span>
                                        <span>Реквізити для оплати надсилаються після підтвердження замовлення менеджером.</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Returns & Exchange Section */}
                    <div className="mb-16">
                        <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Обмін та повернення</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                        {/* Policy Section 1 */}
                        <div className="bg-white p-8 rounded-[3px] shadow-sm border border-gray-100">
                            <div className="bg-blue-50 w-14 h-14 rounded-[3px] flex items-center justify-center mb-6">
                                <ShieldCheck className="h-7 w-7 text-blue-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Гарантія якості</h2>
                            <p className="text-gray-600 leading-relaxed">
                                Якщо ви виявили виробничий брак (дефекти друку, пошкодження при склеюванні, невідповідність формату), ми безкоштовно переробимо ваше замовлення або повернемо кошти.
                            </p>
                        </div>

                        {/* Policy Section 2 */}
                        <div className="bg-white p-8 rounded-[3px] shadow-sm border border-gray-100">
                            <div className="bg-purple-50 w-14 h-14 rounded-[3px] flex items-center justify-center mb-6">
                                <RefreshCcw className="h-7 w-7 text-purple-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Повернення товарів</h2>
                            <p className="text-gray-600 leading-relaxed">
                                Відповідно до Закону України "Про захист прав споживачів", персоналізовані товари (виготовлені за індивідуальним замовленням) не підлягають поверненню, якщо вони не мають дефектів.
                            </p>
                        </div>


                    </div>
                    </div>

                    <div className="bg-blue-600 rounded-[3px] p-10 text-white text-center">
                        <h3 className="text-2xl font-bold mb-4">Виникли запитання?</h3>
                        <p className="mb-8 opacity-90 text-lg">Напишіть нам у Telegram або зателефонуйте, ми завжди на зв'язку.</p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <a href="https://t.me/touchmemories" className="bg-white text-blue-600 px-8 py-4 rounded-full font-bold hover:bg-gray-100 transition-colors">
                                Написати в Telegram
                            </a >
                            <a href="/contacts" className="bg-transparent border-2 border-white px-8 py-4 rounded-full font-bold hover:bg-white hover:text-blue-600 transition-all">
                                Контакти
                            </a >
                        </div>
                    </div>
                </div>
            </main>

            <Footer categories={[]} />
        </div>
    );
}
