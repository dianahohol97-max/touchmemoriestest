export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const output = 'standalone';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Wrench, ArrowLeft } from 'lucide-react';

export default function ConstructorPlaceholderPage() {
    return (
        <div className="min-h-screen bg-white flex flex-col">
            <Navigation />

            <main className="flex-1 flex flex-col items-center justify-center p-4 text-center mt-20">
                <div className="bg-gray-50 p-12 rounded-3xl max-w-2xl w-full border border-gray-100 shadow-sm">
                    <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Wrench className="h-10 w-10 text-blue-600" />
                    </div>

                    <h1 className="text-4xl font-black text-gray-900 mb-4 font-heading">
                        Конструктор в розробці
                    </h1>

                    <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                        Ми працюємо над створенням найкращого інструменту для ваших спогадів.
                        Незабаром ви зможете створювати унікальні фотоальбоми прямо тут.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button asChild size="lg" className="rounded-full px-8 py-6 text-lg font-bold">
                            <Link href="/catalog">
                                Перейти до каталогу
                            </Link>
                        </Button>

                        <Button asChild variant="outline" size="lg" className="rounded-full px-8 py-6 text-lg font-bold">
                            <Link href="/" className="flex items-center gap-2">
                                <ArrowLeft className="h-5 w-5" />
                                На головну
                            </Link>
                        </Button>
                    </div>
                </div>

                <div className="mt-12 text-gray-400 text-sm">
                    <p>© 2026 TouchMemories. Всі права захищені.</p>
                </div>
            </main>

            <Footer categories={[]} />
        </div>
    );
}
