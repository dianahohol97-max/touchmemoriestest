import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { RefreshCcw, Package, Clock, ShieldCheck } from 'lucide-react';

export default function ShippingReturnsPage() {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <Navigation />

            <main className="flex-1 pt-32 pb-20">
                <div className="container max-w-4xl mx-auto px-4">
                    <header className="text-center mb-16">
                        <h1 className="text-5xl font-black text-gray-900 mb-4 font-heading tracking-tight">
                            Обмін та повернення 🔄
                        </h1>
                        <p className="text-xl text-gray-600">
                            Ми дбаємо про якість кожного замовлення та вашу впевненість у результаті.
                        </p>
                    </header>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                        {/* Policy Section 1 */}
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                            <div className="bg-blue-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-6">
                                <ShieldCheck className="h-7 w-7 text-blue-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Гарантія якості</h2>
                            <p className="text-gray-600 leading-relaxed">
                                Якщо ви виявили виробничий брак (дефекти друку, пошкодження при склеюванні, невідповідність формату), ми безкоштовно переробимо ваше замовлення або повернемо кошти.
                            </p>
                        </div>

                        {/* Policy Section 2 */}
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                            <div className="bg-purple-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-6">
                                <RefreshCcw className="h-7 w-7 text-purple-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Повернення товарів</h2>
                            <p className="text-gray-600 leading-relaxed">
                                Відповідно до Закону України "Про захист прав споживачів", персоналізовані товари (виготовлені за індивідуальним замовленням) не підлягають поверненню, якщо вони не мають дефектів.
                            </p>
                        </div>

                        {/* Policy Section 3 */}
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                            <div className="bg-green-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-6">
                                <Package className="h-7 w-7 text-green-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Процедура обміну</h2>
                            <p className="text-gray-600 leading-relaxed">
                                Для подачі заявки на обмін зв'яжіться з нашою підтримкою протягом 14 днів після отримання, надіславши фото виявленого дефекту.
                            </p>
                        </div>

                        {/* Policy Section 4 */}
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                            <div className="bg-orange-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-6">
                                <Clock className="h-7 w-7 text-orange-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Терміни розгляду</h2>
                            <p className="text-gray-600 leading-relaxed">
                                Ми розглянемо ваше звернення протягом 1-2 робочих днів та запропонуємо оптимальне рішення для виправлення ситуації.
                            </p>
                        </div>
                    </div>

                    <div className="bg-blue-600 rounded-3xl p-10 text-white text-center">
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
